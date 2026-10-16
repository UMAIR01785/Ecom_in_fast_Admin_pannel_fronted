import api from "./client"

export async function getProducts() {
  const res = await api.get("/products/")
  return res.data
}

export async function getProductsAdmin() {
  const res = await api.get("/products/admin/products")
  return res.data
}

export async function getProductsByCategory(categorySlug) {
  const res = await api.get(`/products/${categorySlug}`)
  return res.data
}

export async function getProduct(categorySlug, productSlug) {
  const res = await api.get(`/products/${categorySlug}/${productSlug}`)
  return res.data
}

export async function createProduct(formData) {
  const res = await api.post("/products/", formData)
  return res.data
}

export async function updateProduct(categorySlug, productSlug, formData) {
  const res = await api.put(`/products/${categorySlug}/${productSlug}`, formData)
  return res.data
}

export async function deleteProduct(categorySlug, productSlug) {
  const res = await api.delete(`/products/${categorySlug}/${productSlug}`)
  return res.data
}
