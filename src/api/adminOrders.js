import api from "./client"

export async function getAllOrders() {
  const res = await api.get("/admin/orders/")
  return res.data
}

export async function getOrderDetail(orderId) {
  const res = await api.get(`/admin/orders/${orderId}`)
  return res.data
}

export async function updateOrderStatus(orderId, status) {
  const res = await api.patch(`/admin/orders/${orderId}/status`, { status })
  return res.data
}
