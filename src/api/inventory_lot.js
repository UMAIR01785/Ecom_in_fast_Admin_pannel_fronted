import api from "./client"

export async function getInventoryLots({
  skip = 0,
  limit = 20,
  product_id,
  variant_id,
} = {}) {
  const params = { skip, limit }
  if (product_id) params.product_id = product_id
  if (variant_id) params.variant_id = variant_id
  const res = await api.get("/inventory-lots/", { params })
  return res.data
}

export async function getInventoryLot(lotId) {
  const res = await api.get(`/inventory-lots/${lotId}`)
  return res.data
}

export async function receiveInventoryLot(payload) {
  const res = await api.post("/inventory-lots/", payload)
  return res.data
}
