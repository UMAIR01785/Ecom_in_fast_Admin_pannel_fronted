import api from "./client"

export async function getAllRefunds() {
  const res = await api.get("/admin/refunds")
  return res.data
}

export async function reviewRefund(refundId, decision, admin_note) {
  const res = await api.patch(`/admin/refunds/${refundId}/review`, {
    decision,
    admin_note,
  })
  return res.data
}

export async function receiveReturn(refundId, restockable) {
  const res = await api.post(`/admin/refunds/${refundId}/receive-return`, {
    restockable,
  })
  return res.data
}

export async function completeCodRefund(refundId) {
  const res = await api.post(`/admin/refunds/${refundId}/complete-cod`)
  return res.data
}
