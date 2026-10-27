import { useEffect, useRef, useState } from "react"
import {
  getProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../api/products"
import { getAllCategories } from "../../api/categories"
import {
  getVariants,
  createVariant,
  updateVariant,
  deleteVariant,
} from "../../api/productVariants"
import { getErrorMessage } from "../../api/client"
import { useAdminOrderSocket } from "../../context/AdminOrderSocketContext"
import { convertToWebp } from "../../utils/image"

const emptyForm = {
  name: "",
  description: "",
  price: "",
  stock: "",
  category_slugs: [],
  is_active: true,
}

const PAGE_SIZE = 10

function getPageItems(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const items = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) items.push("…")
  for (let i = start; i <= end; i++) items.push(i)
  if (end < total - 1) items.push("…")

  items.push(total)
  return items
}

export default function AdminProducts() {
  const { subscribe } = useAdminOrderSocket()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState({ total: 0, totalPages: 1 })

  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingCategorySlug, setEditingCategorySlug] = useState(null)
  const [editingProductSlug, setEditingProductSlug] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [existingImage, setExistingImage] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingCategorySlug, setDeletingCategorySlug] = useState(null)
  const [deletingProductSlug, setDeletingProductSlug] = useState(null)
  const [deletingName, setDeletingName] = useState("")
  const [deleting, setDeleting] = useState(false)

  const [toast, setToast] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  const emptyVariantForm = {
    sku: "",
    size: "",
    color: "",
    price: "",
    stock: "",
    is_active: true,
  }

  const [variantsProduct, setVariantsProduct] = useState(null)
  const [variants, setVariants] = useState([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [variantSummaries, setVariantSummaries] = useState({})
  const variantSummariesRef = useRef({})

  useEffect(() => {
    variantSummariesRef.current = variantSummaries
  }, [variantSummaries])
  const [showVariantForm, setShowVariantForm] = useState(false)
  const [editingVariantId, setEditingVariantId] = useState(null)
  const [variantForm, setVariantForm] = useState(emptyVariantForm)
  const [variantError, setVariantError] = useState("")
  const [variantSaving, setVariantSaving] = useState(false)

  const [showVariantDeleteModal, setShowVariantDeleteModal] = useState(false)
  const [deletingVariant, setDeletingVariant] = useState(null)
  const [deletingVariantBusy, setDeletingVariantBusy] = useState(false)
  const [showDeactivated, setShowDeactivated] = useState(false)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  function syncVariantSummary(productId, data) {
    const next = { ...variantSummariesRef.current, [productId]: data }
    variantSummariesRef.current = next
    setVariantSummaries(next)
  }

  async function loadVariantSummaries(items) {
    const entries = await Promise.all(
      items.map(async (product) => {
        try {
          const data = await getVariants(product.id)
          return [product.id, data]
        } catch {
          return [product.id, []]
        }
      })
    )
    setVariantSummaries(Object.fromEntries(entries))
  }

  async function fetchProducts(pageToFetch) {
    setLoading(true)
    try {
      const prodData = await getProductsAdmin({
        page: pageToFetch,
        limit: PAGE_SIZE,
      })
      const items = Array.isArray(prodData) ? prodData : prodData?.items || []
      const total = Array.isArray(prodData)
        ? items.length
        : Number(prodData?.total ?? items.length) || 0
      const totalPages = Array.isArray(prodData)
        ? 1
        : Number(prodData?.total_pages ?? 1) || 1

      if (items.length === 0 && pageToFetch > 1) {
        setPage(Math.max(1, Math.min(pageToFetch - 1, totalPages)))
        return
      }

      setProducts(items)
      setMeta({ total, totalPages })
      loadVariantSummaries(items)
    } catch {
      setProducts([])
      setMeta({ total: 0, totalPages: 1 })
    } finally {
      setLoading(false)
    }
  }

  async function fetchCategories() {
    try {
      const catData = await getAllCategories()
      setCategories(catData)
    } catch (err) {
      console.error("Failed to load categories:", err)
      showToast("Failed to load categories. " + (err?.response?.data?.detail || err.message), "error")
    }
  }

  function fetchData() {
    fetchProducts(page)
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    fetchProducts(page)
  }, [page])

  useEffect(() => {
    return subscribe((message) => {
      if (message?.type !== "inventory_updated") return

      const stockById = new Map(
        (message.products || []).map((p) => [p.product_id, p.stock])
      )
      if (stockById.size > 0) {
        setProducts((prev) =>
          prev.map((p) =>
            stockById.has(p.id) ? { ...p, stock: stockById.get(p.id) } : p
          )
        )
      }

      const incoming = message.variants || []
      if (incoming.length === 0) return

      const prev = variantSummariesRef.current
      const next = { ...prev }
      const touched = new Map()

      incoming.forEach((v) => {
        const list = touched.has(v.product_id)
          ? touched.get(v.product_id)
          : (prev[v.product_id] ? [...prev[v.product_id]] : [])
        touched.set(v.product_id, list)

        const normalized = {
          id: v.variant_id,
          product_id: v.product_id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price: v.price,
          stock: v.stock,
          is_active: v.is_active,
        }
        const idx = list.findIndex((item) => item.id === normalized.id)
        if (idx >= 0) list[idx] = normalized
        else if (normalized.is_active !== false) list.push(normalized)
      })

      touched.forEach((list, productId) => {
        next[productId] = [...list].sort(
          (a, b) =>
            String(a.size).localeCompare(String(b.size)) ||
            String(a.color).localeCompare(String(b.color))
        )
      })

      variantSummariesRef.current = next
      setVariantSummaries(next)

      if (variantsProduct && touched.has(variantsProduct.id)) {
        setVariants(next[variantsProduct.id])
      }
    })
  }, [subscribe, variantsProduct])

  function openCreate() {
    setEditingId(null)
    setEditingCategorySlug(null)
    setEditingProductSlug(null)
    setForm(emptyForm)
    setImage(null)
    setPreview(null)
    setExistingImage(null)
    setError("")
    setShowModal(true)
  }

  function openEdit(product) {
    setEditingId(product.id)
    const categorySlugs = product.category_slugs || []
    setEditingCategorySlug(
      categorySlugs[0] || ""
    )
    setEditingProductSlug(product.slug)
    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      stock: String(product.stock),
      category_slugs: categorySlugs,
      is_active: product.is_active,
    })
    setImage(null)
    setPreview(null)
    setExistingImage(product.image)
    setError("")
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingId(null)
    setEditingCategorySlug(null)
    setEditingProductSlug(null)
    setForm(emptyForm)
    setImage(null)
    setPreview(null)
    setExistingImage(null)
    setError("")
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleImageChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const webpFile = await convertToWebp(file, { maxSize: 1280 })
      setImage(webpFile)
      setPreview(URL.createObjectURL(webpFile))
    } catch (err) {
      setError(err.message || "Failed to process image.")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleRemoveImage() {
    setImage(null)
    setPreview(null)
    setExistingImage(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")

    if (!form.name.trim()) {
      setError("Product name is required.")
      return
    }
    if (!form.price || Number(form.price) <= 0) {
      setError("Valid price is required.")
      return
    }
    if (form.stock === "" || Number(form.stock) < 0) {
      setError("Stock is required and cannot be negative.")
      return
    }
    if (form.category_slugs.length === 0) {
      setError("Please select at least one category.")
      return
    }

    setSaving(true)

    try {
      const formData = new FormData()
      formData.append("name", form.name.trim())
      formData.append("price", Number(form.price))
      formData.append("stock", Number(form.stock))
      form.category_slugs.forEach((categorySlug) => {
        formData.append("category_slugs", categorySlug)
      })

      if (form.description.trim()) {
        formData.append("description", form.description.trim())
      }

      formData.append("is_active", form.is_active)

      if (image) {
        formData.append("image", image)
      }

      if (editingCategorySlug && editingProductSlug) {
        await updateProduct(editingCategorySlug, editingProductSlug, formData)
        showToast("Product updated successfully")
      } else {
        await createProduct(formData)
        showToast("Product created successfully")
      }

      closeModal()
      fetchData()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function openDeleteModal(product) {
    setDeletingCategorySlug(product.category_slugs?.[0] || "")
    setDeletingProductSlug(product.slug)
    setDeletingName(product.name)
    setShowDeleteModal(true)
  }

  function closeDeleteModal() {
    setShowDeleteModal(false)
    setDeletingCategorySlug(null)
    setDeletingProductSlug(null)
    setDeletingName("")
  }

  async function handleDelete() {
    if (!deletingCategorySlug || !deletingProductSlug) return
    setDeleting(true)
    try {
      await deleteProduct(deletingCategorySlug, deletingProductSlug)
      showToast("Product deleted successfully")
      closeDeleteModal()
      fetchData()
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setDeleting(false)
    }
  }

  async function openVariants(product) {
    setVariantsProduct(product)
    setVariants([])
    setShowVariantForm(false)
    setEditingVariantId(null)
    setVariantForm(emptyVariantForm)
    setVariantError("")
    setShowDeactivated(false)
    setVariantsLoading(true)
    try {
      const data = await getVariants(product.id)
      setVariants(data)
      syncVariantSummary(product.id, data)
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setVariantsLoading(false)
    }
  }

  function closeVariants() {
    setVariantsProduct(null)
    setVariants([])
    setShowVariantForm(false)
    setEditingVariantId(null)
    setVariantForm(emptyVariantForm)
    setVariantError("")
    setShowDeactivated(false)
  }

  function openCreateVariant() {
    setEditingVariantId(null)
    setVariantForm(emptyVariantForm)
    setVariantError("")
    setShowVariantForm(true)
  }

  function openEditVariant(variant) {
    setEditingVariantId(variant.id)
    setVariantForm({
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      price: variant.price != null ? String(variant.price) : "",
      stock: String(variant.stock),
      is_active: variant.is_active,
    })
    setVariantError("")
    setShowVariantForm(true)
  }

  function cancelVariantForm() {
    setShowVariantForm(false)
    setEditingVariantId(null)
    setVariantForm(emptyVariantForm)
    setVariantError("")
  }

  function handleVariantFormChange(e) {
    setVariantForm({ ...variantForm, [e.target.name]: e.target.value })
  }

  async function handleVariantSubmit(e) {
    e.preventDefault()
    setVariantError("")

    if (!variantForm.sku.trim()) {
      setVariantError("SKU is required.")
      return
    }
    if (!variantForm.size.trim()) {
      setVariantError("Size is required.")
      return
    }
    if (!variantForm.color.trim()) {
      setVariantError("Color is required.")
      return
    }
    if (variantForm.stock === "" || Number(variantForm.stock) < 0) {
      setVariantError("Stock is required and cannot be negative.")
      return
    }
    if (variantForm.price !== "" && Number(variantForm.price) <= 0) {
      setVariantError("Price must be greater than 0, or left empty to inherit the product price.")
      return
    }

    setVariantSaving(true)
    try {
      const payload = {
        sku: variantForm.sku.trim(),
        size: variantForm.size.trim(),
        color: variantForm.color.trim(),
        price: variantForm.price === "" ? null : Number(variantForm.price),
        stock: Number(variantForm.stock),
        is_active: variantForm.is_active,
      }

      if (editingVariantId) {
        await updateVariant(variantsProduct.id, editingVariantId, payload)
        showToast("Variant updated successfully")
      } else {
        await createVariant(variantsProduct.id, payload)
        showToast("Variant created successfully")
      }

      cancelVariantForm()
      const data = await getVariants(variantsProduct.id)
      setVariants(data)
      syncVariantSummary(variantsProduct.id, data)
    } catch (err) {
      setVariantError(getErrorMessage(err))
    } finally {
      setVariantSaving(false)
    }
  }

  function openVariantDeleteModal(variant) {
    setDeletingVariant(variant)
    setShowVariantDeleteModal(true)
  }

  function closeVariantDeleteModal() {
    setShowVariantDeleteModal(false)
    setDeletingVariant(null)
  }

  async function handleVariantDelete() {
    if (!deletingVariant || !variantsProduct) return
    setDeletingVariantBusy(true)
    try {
      await deleteVariant(variantsProduct.id, deletingVariant.id)
      showToast("Variant deactivated successfully")
      closeVariantDeleteModal()
      const data = await getVariants(variantsProduct.id)
      setVariants(data)
      syncVariantSummary(variantsProduct.id, data)
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setDeletingVariantBusy(false)
    }
  }

  function getCategoryName(categorySlugs) {
    return categorySlugs
      ?.map((slug) => categories.find((category) => category.slug === slug)?.name)
      .filter(Boolean)
      .join(", ") || "N/A"
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  )

  const deactivatedVariantCount = variants.filter((v) => !v.is_active).length
  const visibleVariants = showDeactivated
    ? variants
    : variants.filter((v) => v.is_active)

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Products</h1>
          <p>Manage your product inventory</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + New Product
        </button>
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h2>
            {search
              ? `Search results (${filtered.length})`
              : `All Products (${meta.total})`}
          </h2>
          <div className="admin-table-search">
            <span className="search-icon">&#128269;</span>
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-loading-spinner" />
            <p>Loading products...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <div className="admin-empty-icon">&#128230;</div>
            <p>{search ? "No products match your search." : "No products yet."}</p>
            {!search && (
              <button className="btn btn-primary btn-sm" onClick={openCreate}>
                Create First Product
              </button>
            )}
          </div>
        ) : (
          <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Variants</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const summary = variantSummaries[product.id]
                const activeVariants = summary
                  ? summary.filter((v) => v.is_active)
                  : []
                const sizes = [...new Set(activeVariants.map((v) => v.size))]
                const colors = [...new Set(activeVariants.map((v) => v.color))]

                return (
                <tr key={product.id}>
                  <td>
                    <div className="admin-table-category">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt=""
                          className="admin-table-category-img"
                          style={{ cursor: "zoom-in" }}
                          onClick={() => setLightbox({ image: product.image, name: product.name })}
                        />
                      ) : (
                        <div className="admin-table-category-img admin-table-category-placeholder">
                          {product.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="admin-table-category-name">{product.name}</div>
                        <div className="admin-table-category-slug">/{product.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                    {getCategoryName(product.category_slugs)}
                  </td>
                  <td>
                    {!summary ? (
                      <span className="admin-variant-summary-empty">&mdash;</span>
                    ) : activeVariants.length === 0 ? (
                      <span className="admin-variant-summary-empty">None</span>
                    ) : (
                      <div className="admin-variant-summary">
                        <span className="admin-variant-line">
                          {sizes.join(", ")}
                        </span>
                        <span className="admin-variant-line muted">
                          {colors.join(", ")}
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    Rs {Number(product.price).toFixed(2)}
                  </td>
                  <td>
                    <span className={`status-badge ${product.stock > 0 ? "active" : "inactive"}`}>
                      <span className="status-badge-dot" />
                      {product.stock}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${product.is_active ? "active" : "inactive"}`}>
                      <span className="status-badge-dot" />
                      {product.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                      <button
                        className="admin-action-btn"
                        title="View"
                        onClick={() => setLightbox({ image: product.image, name: product.name })}
                      >
                        &#128065;
                      </button>
                      <button
                        className="admin-action-btn"
                        title="Variants"
                        onClick={() => openVariants(product)}
                      >
                        &#9638;
                      </button>
                      <button
                        className="admin-action-btn"
                        title="Edit"
                        onClick={() => openEdit(product)}
                      >
                        &#9998;
                      </button>
                      <button
                        className="admin-action-btn danger"
                        title="Delete"
                        onClick={() => openDeleteModal(product)}
                      >
                        &#128465;
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}

        {!loading && !search && meta.total > 0 && (
          <div className="admin-pagination">
            <span className="admin-pagination-info">
              Showing {(page - 1) * PAGE_SIZE + 1}&ndash;{Math.min(page * PAGE_SIZE, meta.total)} of {meta.total} products
            </span>

            {meta.totalPages > 1 && (
              <div className="admin-pagination-pages">
                <button
                  type="button"
                  className="admin-page-btn"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  &larr; Prev
                </button>

                {getPageItems(page, meta.totalPages).map((item, idx) =>
                  item === "…" ? (
                    <span key={`gap-${idx}`} className="admin-page-ellipsis">…</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={`admin-page-btn ${page === item ? "active" : ""}`}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="admin-page-btn"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                >
                  Next &rarr;
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="admin-modal-overlay" onClick={closeModal}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>{editingId ? "Edit Product" : "New Product"}</h2>
              <button className="admin-modal-close" onClick={closeModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="admin-modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="admin-form-group">
                  <label htmlFor="prod-name">Product Name *</label>
                  <input
                    id="prod-name"
                    name="name"
                    type="text"
                    placeholder="e.g. iPhone 17 Pro Max"
                    value={form.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="prod-desc">Description</label>
                  <textarea
                    id="prod-desc"
                    name="description"
                    placeholder="Optional product description"
                    value={form.description}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label htmlFor="prod-price">Price (PKR) *</label>
                    <input
                      id="prod-price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={form.price}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="admin-form-group">
                    <label htmlFor="prod-stock">Stock *</label>
                    <input
                      id="prod-stock"
                      name="stock"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.stock}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>

                <div className="admin-form-group">
                  <span className="admin-form-label">Categories *</span>
                  <div className="admin-category-options">
                    {categories.map((cat) => (
                      <label key={cat.id} className="admin-form-checkbox">
                        <input
                          type="checkbox"
                          checked={form.category_slugs.includes(cat.slug)}
                          onChange={(e) => setForm({
                            ...form,
                            category_slugs: e.target.checked
                              ? [...form.category_slugs, cat.slug]
                              : form.category_slugs.filter((slug) => slug !== cat.slug),
                          })}
                        />
                        <span>{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="admin-form-group">
                  <label htmlFor="prod-active">Status</label>
                  <label className="admin-form-checkbox">
                    <input
                      id="prod-active"
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                    />
                    <span>{form.is_active ? "Active" : "Inactive"}</span>
                  </label>
                </div>

                <div className="admin-form-group">
                  <label>Image</label>
                  <div className="admin-image-upload">
                    {preview || existingImage ? (
                      <div className="admin-image-preview">
                        <img src={preview || existingImage} alt="Preview" />
                        <button
                          type="button"
                          className="admin-image-preview-remove"
                          onClick={handleRemoveImage}
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <label className="admin-image-drop" htmlFor="prod-image">
                        <input
                          ref={fileInputRef}
                          id="prod-image"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleImageChange}
                          hidden
                        />
                        <span className="admin-image-drop-icon">&#128247;</span>
                        <span className="admin-image-drop-text">Click to upload</span>
                        <span className="admin-image-drop-hint">JPEG, PNG, WebP (max 5 MB)</span>
                      </label>
                    )}
                  </div>
                </div>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={saving}
                >
                  {saving
                    ? editingId ? "Saving..." : "Creating..."
                    : editingId ? "Save Changes" : "Create Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="admin-modal-overlay" onClick={closeDeleteModal}>
          <div className="admin-modal admin-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Delete Product</h2>
              <button className="admin-modal-close" onClick={closeDeleteModal}>
                &times;
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                Are you sure you want to delete <strong style={{ color: "var(--text)" }}>{deletingName}</strong>?
                This action cannot be undone.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {variantsProduct && (
        <div className="admin-modal-overlay" onClick={closeVariants}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>
                Variants — <span style={{ color: "var(--text-muted)" }}>{variantsProduct.name}</span>
              </h2>
              <button className="admin-modal-close" onClick={closeVariants}>
                &times;
              </button>
            </div>

            <div className="admin-modal-body">
              {variantError && <div className="alert alert-error">{variantError}</div>}

              {showVariantForm && (
                <form onSubmit={handleVariantSubmit} style={{ marginBottom: "1.25rem" }}>
                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="var-sku">SKU *</label>
                      <input
                        id="var-sku"
                        name="sku"
                        type="text"
                        placeholder="e.g. TEE-BLK-L"
                        value={variantForm.sku}
                        onChange={handleVariantFormChange}
                        required
                      />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="var-size">Size *</label>
                      <input
                        id="var-size"
                        name="size"
                        type="text"
                        placeholder="e.g. L"
                        value={variantForm.size}
                        onChange={handleVariantFormChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="var-color">Color *</label>
                      <input
                        id="var-color"
                        name="color"
                        type="text"
                        placeholder="e.g. Black"
                        value={variantForm.color}
                        onChange={handleVariantFormChange}
                        required
                      />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="var-price">Price (PKR)</label>
                      <input
                        id="var-price"
                        name="price"
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Empty = product price"
                        value={variantForm.price}
                        onChange={handleVariantFormChange}
                      />
                    </div>
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <label htmlFor="var-stock">Stock *</label>
                      <input
                        id="var-stock"
                        name="stock"
                        type="number"
                        min="0"
                        placeholder="0"
                        value={variantForm.stock}
                        onChange={handleVariantFormChange}
                        required
                      />
                    </div>
                    <div className="admin-form-group">
                      <label htmlFor="var-active">Status</label>
                      <label className="admin-form-checkbox">
                        <input
                          id="var-active"
                          type="checkbox"
                          checked={variantForm.is_active}
                          onChange={(e) =>
                            setVariantForm({ ...variantForm, is_active: e.target.checked })
                          }
                        />
                        <span>{variantForm.is_active ? "Active" : "Inactive"}</span>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={cancelVariantForm}
                      disabled={variantSaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={variantSaving}
                    >
                      {variantSaving ? "Saving..." : editingVariantId ? "Save Changes" : "Create Variant"}
                    </button>
                  </div>
                </form>
              )}

              {variantsLoading ? (
                <div className="admin-table-empty">
                  <div className="admin-loading-spinner" />
                  <p>Loading variants...</p>
                </div>
              ) : variants.length === 0 && !showVariantForm ? (
                <div className="admin-table-empty">
                  <div className="admin-empty-icon">&#9638;</div>
                  <p>No variants yet for this product.</p>
                  <button className="btn btn-primary btn-sm" onClick={openCreateVariant}>
                    + Add First Variant
                  </button>
                </div>
              ) : visibleVariants.length === 0 && !showVariantForm ? (
                <div className="admin-table-empty">
                  <div className="admin-empty-icon">&#9638;</div>
                  <p>All variants for this product are deactivated.</p>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowDeactivated(true)}
                  >
                    Show deactivated ({deactivatedVariantCount})
                  </button>
                </div>
              ) : (
                <>
                {deactivatedVariantCount > 0 && (
                  <label className="admin-variant-toggle">
                    <input
                      type="checkbox"
                      checked={showDeactivated}
                      onChange={(e) => setShowDeactivated(e.target.checked)}
                    />
                    Show deactivated ({deactivatedVariantCount})
                  </label>
                )}
                <div className="admin-table-wrapper">
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>SKU</th>
                          <th>Size</th>
                          <th>Color</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleVariants.map((variant) => (
                          <tr key={variant.id}>
                            <td style={{ fontWeight: 600 }}>{variant.sku}</td>
                            <td>{variant.size}</td>
                            <td>{variant.color}</td>
                            <td>
                              {variant.price != null
                                ? `Rs ${Number(variant.price).toFixed(2)}`
                                : (
                                  <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                    Rs {Number(variantsProduct.price).toFixed(2)}*
                                  </span>
                                )}
                            </td>
                            <td>
                              <span className={`status-badge ${variant.stock > 0 ? "active" : "inactive"}`}>
                                <span className="status-badge-dot" />
                                {variant.stock}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${variant.is_active ? "active" : "inactive"}`}>
                                <span className="status-badge-dot" />
                                {variant.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                                <button
                                  className="admin-action-btn"
                                  title="Edit Variant"
                                  onClick={() => openEditVariant(variant)}
                                >
                                  &#9998;
                                </button>
                                <button
                                  className="admin-action-btn danger"
                                  title="Deactivate Variant"
                                  onClick={() => openVariantDeleteModal(variant)}
                                >
                                  &#128465;
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                </>
              )}
            </div>

            <div className="admin-modal-footer">
              {!showVariantForm && (
                <button className="btn btn-primary btn-sm" onClick={openCreateVariant}>
                  + Add Variant
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={closeVariants}
                disabled={variantSaving}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showVariantDeleteModal && deletingVariant && (
        <div className="admin-modal-overlay" onClick={closeVariantDeleteModal}>
          <div className="admin-modal admin-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Deactivate Variant</h2>
              <button className="admin-modal-close" onClick={closeVariantDeleteModal}>
                &times;
              </button>
            </div>
            <div className="admin-modal-body">
              <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", lineHeight: 1.6 }}>
                Deactivate variant <strong style={{ color: "var(--text)" }}>{deletingVariant.sku}</strong>?
                It will no longer be purchasable. Inventory history is kept.
              </p>
            </div>
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={closeVariantDeleteModal}
                disabled={deletingVariantBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleVariantDelete}
                disabled={deletingVariantBusy}
              >
                {deletingVariantBusy ? "Deactivating..." : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div
          className="admin-modal-overlay"
          onClick={() => setLightbox(null)}
          style={{ cursor: "zoom-out", background: "rgba(15, 23, 42, 0.8)" }}
        >
          <div style={{ textAlign: "center" }}>
            {lightbox.image ? (
              <img
                src={lightbox.image}
                alt={lightbox.name}
                style={{
                  maxWidth: "90vw",
                  maxHeight: "80vh",
                  borderRadius: 8,
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 240,
                  height: 240,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--bg)",
                  borderRadius: 8,
                  fontSize: "4rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  margin: "0 auto",
                }}
              >
                {lightbox.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )}
            <p style={{ color: "#fff", marginTop: 12, fontWeight: 600 }}>{lightbox.name}</p>
          </div>
        </div>
      )}

      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === "success" ? "&#10003; " : "&#9888; "}
          {toast.message}
        </div>
      )}
    </div>
  )
}
