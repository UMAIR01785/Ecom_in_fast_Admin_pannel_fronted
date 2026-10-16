import api from "./client"

export async function getCategories() {
  const res = await api.get("/categories/")
  return res.data
}

export async function getCategory(slug) {
  const res = await api.get(`/categories/${slug}`)
  return res.data
}

export async function createCategory(formData) {
  const res = await api.post("/categories/admin", formData)
  return res.data
}

export async function updateCategory(slug, formData) {
  const res = await api.patch(`/categories/admin/${slug}`, formData)
  return res.data
}

export async function deleteCategory(slug) {
  const res = await api.delete(`/categories/admin/${slug}`)
  return res.data
}

export async function getAllCategories() {
  const res = await api.get("/categories/admin/all")
  return res.data
}
