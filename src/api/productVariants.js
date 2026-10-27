import api from "./client"

export async function getVariants(productId) {
  const res = await api.get(`/products/${productId}/variants`)
  return res.data
}

export async function createVariant(productId, payload) {
  const res = await api.post(`/products/${productId}/variants`, payload)
  return res.data
}

export async function updateVariant(productId, variantId, payload) {
  const res = await api.patch(`/products/${productId}/variants/${variantId}`, payload)
  return res.data
}

export async function deleteVariant(productId, variantId) {
  const res = await api.delete(`/products/${productId}/variants/${variantId}`)
  return res.data
}
