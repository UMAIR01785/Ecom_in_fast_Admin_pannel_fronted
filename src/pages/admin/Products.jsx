import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  getProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../../api/products"
import { getAllCategories } from "../../api/categories"
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

export default function AdminProducts() {
  const { subscribe } = useAdminOrderSocket()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

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

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchData() {
    try {
      const prodData = await getProductsAdmin()
      setProducts(prodData)
    } catch {
      // silent
    }

    try {
      const catData = await getAllCategories()
      setCategories(catData)
    } catch (err) {
      console.error("Failed to load categories:", err)
      showToast("Failed to load categories. " + (err?.response?.data?.detail || err.message), "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    return subscribe((message) => {
      if (message?.type !== "inventory_updated") return
      const stockById = new Map(
        (message.products || []).map((p) => [p.product_id, p.stock])
      )
      if (stockById.size === 0) return
      setProducts((prev) =>
        prev.map((p) =>
          stockById.has(p.id) ? { ...p, stock: stockById.get(p.id) } : p
        )
      )
    })
  }, [subscribe])

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

  function getCategoryName(categorySlugs) {
    return categorySlugs
      ?.map((slug) => categories.find((category) => category.slug === slug)?.name)
      .filter(Boolean)
      .join(", ") || "N/A"
  }

  function getCategorySlug(categorySlugs) {
    return categorySlugs?.[0] || ""
  }

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.slug.toLowerCase().includes(search.toLowerCase())
  )

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
          <h2>All Products ({filtered.length})</h2>
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
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id}>
                  <td>
                    <div className="admin-table-category">
                      {product.image ? (
                        <img src={product.image} alt="" className="admin-table-category-img" />
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
                      <Link
                        to={`/${getCategorySlug(product.category_slugs)}/${product.slug}`}
                        className="admin-action-btn"
                        title="View"
                        target="_blank"
                      >
                        &#128065;
                      </Link>
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
              ))}
            </tbody>
          </table>
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

      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === "success" ? "&#10003; " : "&#9888; "}
          {toast.message}
        </div>
      )}
    </div>
  )
}
