import api from "./client"

export async function getAllPayments() {
  const res = await api.get("/admin/payments/")
  return res.data
}

export async function getPayment(paymentId) {
  const res = await api.get(`/admin/payments/${paymentId}`)
  return res.data
}
