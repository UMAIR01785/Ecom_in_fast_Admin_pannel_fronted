import { useEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../../api/categories"
import { getErrorMessage } from "../../api/client"
import { convertToWebp } from "../../utils/image"

const emptyForm = { name: "", description: "" }

export default function AdminCategories() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [showModal, setShowModal] = useState(false)
  const [editingSlug, setEditingSlug] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [isActive, setIsActive] = useState(true)
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [existingImage, setExistingImage] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSlug, setDeletingSlug] = useState(null)
  const [deletingName, setDeletingName] = useState("")
  const [deleting, setDeleting] = useState(false)

  const [toast, setToast] = useState(null)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchCategories() {
    try {
      const data = await getAllCategories()
      setCategories(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      openCreate()
      searchParams.delete("create")
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams])

  function openCreate() {
    setEditingSlug(null)
    setForm(emptyForm)
    setIsActive(true)
    setImage(null)
    setPreview(null)
    setExistingImage(null)
    setError("")
    setShowModal(true)
  }

  function openEdit(slug) {
    const cat = categories.find((c) => c.slug === slug)
    if (!cat) return

    setEditingSlug(slug)
    setForm({ name: cat.name, description: cat.description || "" })
    setIsActive(cat.is_active)
    setImage(null)
    setPreview(null)
    setExistingImage(cat.image)
    setError("")
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditingSlug(null)
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
      setError("Category name is required.")
      return
    }

    setSaving(true)

    try {
      const formData = new FormData()
      formData.append("name", form.name.trim())

      if (form.description.trim()) {
        formData.append("description", form.description.trim())
      }

      if (editingSlug) {
        formData.append("is_active", isActive)
      }

      if (image) {
        formData.append("image", image)
      }

      if (editingSlug) {
        await updateCategory(editingSlug, formData)
        showToast("Category updated successfully")
      } else {
        await createCategory(formData)
        showToast("Category created successfully")
      }

      closeModal()
      fetchCategories()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(cat) {
    try {
      const formData = new FormData()
      formData.append("is_active", !cat.is_active)

      await updateCategory(cat.slug, formData)
      showToast(`Category ${cat.is_active ? "deactivated" : "activated"}`)
      fetchCategories()
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    }
  }

  function openDeleteModal(cat) {
    setDeletingSlug(cat.slug)
    setDeletingName(cat.name)
    setShowDeleteModal(true)
  }

  function closeDeleteModal() {
    setShowDeleteModal(false)
    setDeletingSlug(null)
    setDeletingName("")
  }

  async function handleDelete() {
    if (!deletingSlug) return
    setDeleting(true)
    try {
      await deleteCategory(deletingSlug)
      showToast("Category deleted successfully")
      closeDeleteModal()
      fetchCategories()
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setDeleting(false)
    }
  }

  const filtered = categories.filter(
    (cat) =>
      cat.name.toLowerCase().includes(search.toLowerCase()) ||
      cat.slug.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Categories</h1>
          <p>Manage your product categories</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openCreate}>
          + New Category
        </button>
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h2>All Categories ({filtered.length})</h2>
          <div className="admin-table-search">
            <span className="search-icon">&#128269;</span>
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-loading-spinner" />
            <p>Loading categories...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <div className="admin-empty-icon">&#128193;</div>
            <p>{search ? "No categories match your search." : "No categories yet."}</p>
            {!search && (
              <button className="btn btn-primary btn-sm" onClick={openCreate}>
                Create First Category
              </button>
            )}
          </div>
        ) : (
          <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((cat) => (
                <tr key={cat.id}>
                  <td>
                    <div className="admin-table-category">
                      {cat.image ? (
                        <img src={cat.image} alt="" className="admin-table-category-img" />
                      ) : (
                        <div className="admin-table-category-img admin-table-category-placeholder">
                          {cat.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="admin-table-category-name">{cat.name}</div>
                        <div className="admin-table-category-slug">/{cat.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)", maxWidth: 220 }}>
                    <span className="admin-description-clamp">
                      {cat.description || "--"}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleStatus(cat)}
                      className="admin-status-toggle"
                      title={`Click to ${cat.is_active ? "deactivate" : "activate"}`}
                    >
                      <span className={`status-badge ${cat.is_active ? "active" : "inactive"}`}>
                        <span className="status-badge-dot" />
                        {cat.is_active ? "Active" : "Inactive"}
                      </span>
                    </button>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                    {new Date(cat.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                      <Link
                        to={`/${cat.slug}`}
                        className="admin-action-btn"
                        title="View"
                        target="_blank"
                      >
                        &#128065;
                      </Link>
                      <button
                        className="admin-action-btn"
                        title="Edit"
                        onClick={() => openEdit(cat.slug)}
                      >
                        &#9998;
                      </button>
                      <button
                        className="admin-action-btn danger"
                        title="Delete"
                        onClick={() => openDeleteModal(cat)}
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
              <h2>{editingSlug ? "Edit Category" : "New Category"}</h2>
              <button className="admin-modal-close" onClick={closeModal}>
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="admin-modal-body">
                {error && <div className="alert alert-error">{error}</div>}

                <div className="admin-form-group">
                  <label htmlFor="cat-name">Category Name *</label>
                  <input
                    id="cat-name"
                    name="name"
                    type="text"
                    placeholder="e.g. Electronics"
                    value={form.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="cat-desc">Description</label>
                  <textarea
                    id="cat-desc"
                    name="description"
                    placeholder="Optional short description"
                    value={form.description}
                    onChange={handleFormChange}
                  />
                </div>

                {editingSlug && (
                  <div className="admin-form-group">
                    <label className="admin-form-checkbox">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <span>Active</span>
                    </label>
                  </div>
                )}

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
                      <label className="admin-image-drop" htmlFor="cat-image">
                        <input
                          ref={fileInputRef}
                          id="cat-image"
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
                    ? editingSlug ? "Saving..." : "Creating..."
                    : editingSlug ? "Save Changes" : "Create Category"}
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
              <h2>Delete Category</h2>
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
