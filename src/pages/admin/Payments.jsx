import { useEffect, useState } from "react"
import { getAllPayments, getPayment } from "../../api/adminPayments"
import { getErrorMessage } from "../../api/client"

const STATUS_COLORS = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  succeeded: { bg: "#dcfce7", text: "#166534" },
  completed: { bg: "#dcfce7", text: "#166534" },
  paid: { bg: "#dcfce7", text: "#166534" },
  failed: { bg: "#fee2e2", text: "#991b1b" },
  cancelled: { bg: "#fee2e2", text: "#991b1b" },
  refunded: { bg: "#e0e7ff", text: "#3730a3" },
}

const ORDER_STATUS_COLORS = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dbeafe", text: "#1e40af" },
  processing: { bg: "#e0e7ff", text: "#3730a3" },
  shipped: { bg: "#d1fae5", text: "#065f46" },
  delivered: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#fee2e2", text: "#991b1b" },
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [toast, setToast] = useState(null)
  const [selected, setSelected] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    let cancelled = false
    async function fetchPayments() {
      try {
        const data = await getAllPayments()
        if (!cancelled) setPayments(data)
      } catch (err) {
        if (!cancelled) showToast(getErrorMessage(err), "error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchPayments()
    return () => {
      cancelled = true
    }
  }, [])

  async function openDetail(paymentId) {
    setDetailLoading(true)
    setSelected(null)
    try {
      const data = await getPayment(paymentId)
      setSelected(data)
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setDetailLoading(false)
    }
  }

  const statuses = [...new Set(payments.map((p) => p.payment_status))]

  const filtered = payments.filter((payment) => {
    if (payment.order_status === "cancelled") return false
    const q = search.toLowerCase()
    const matchesSearch =
      String(payment.payment_id).includes(search) ||
      String(payment.order_id).includes(search) ||
      payment.customer_name?.toLowerCase().includes(q) ||
      payment.customer_email?.toLowerCase().includes(q) ||
      payment.transaction_id?.toLowerCase().includes(q)
    const matchesStatus = !statusFilter || payment.payment_status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totals = filtered.reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Payments</h1>
          <p>Track all customer payments and transactions</p>
        </div>
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h2>
            All Payments ({filtered.length})
            <span style={{ fontWeight: 500, color: "var(--text-muted)", marginLeft: 8 }}>
              Rs {totals.toFixed(2)}
            </span>
          </h2>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-light)",
                fontSize: "0.875rem",
                background: "var(--bg)",
                color: "var(--text)",
              }}
            >
              <option value="">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <div className="admin-table-search">
              <span className="search-icon">&#128269;</span>
              <input
                type="text"
                placeholder="Search by payment ID, order, customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-loading-spinner" />
            <p>Loading payments...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <div className="admin-empty-icon">&#128179;</div>
            <p>{search || statusFilter ? "No payments match your filters." : "No payments yet."}</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Method</th>
                  <th>Transaction</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => {
                  const style = STATUS_COLORS[payment.payment_status] || STATUS_COLORS.pending
                  return (
                    <tr key={payment.payment_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>#{payment.payment_id}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                          #{payment.order_id}
                        </div>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            background: (ORDER_STATUS_COLORS[payment.order_status] || ORDER_STATUS_COLORS.pending).bg,
                            color: (ORDER_STATUS_COLORS[payment.order_status] || ORDER_STATUS_COLORS.pending).text,
                            textTransform: "capitalize",
                          }}
                        >
                          {payment.order_status}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                          {payment.customer_name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {payment.customer_email}
                        </div>
                      </td>
                      <td style={{ textTransform: "capitalize", fontSize: "0.875rem" }}>
                        {payment.payment_method}
                      </td>
                      <td style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                        {payment.transaction_id || "—"}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        Rs {Number(payment.amount).toFixed(2)}
                      </td>
                      <td style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        {new Date(payment.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 12px",
                            borderRadius: 999,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            background: style.bg,
                            color: style.text,
                            textTransform: "capitalize",
                          }}
                        >
                          {payment.payment_status}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            className="admin-action-btn"
                            title="View Payment"
                            onClick={() => openDetail(payment.payment_id)}
                          >
                            &#128065;
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
      </div>

      {(selected || detailLoading) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={() => !detailLoading && setSelected(null)}
        >
          <div
            className="profile-card"
            style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                {detailLoading ? "Loading payment..." : `Payment #${selected?.payment_id}`}
              </h2>
              <button
                className="admin-action-btn"
                title="Close"
                onClick={() => setSelected(null)}
                disabled={detailLoading}
              >
                &#10005;
              </button>
            </div>

            {detailLoading ? (
              <div className="admin-table-empty">
                <div className="admin-loading-spinner" />
              </div>
            ) : selected ? (
              <div className="profile-fields">
                <div className="profile-field">
                  <span className="profile-field-label">Order</span>
                  <span className="profile-field-value">#{selected.order_id}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Customer</span>
                  <span className="profile-field-value">
                    {selected.customer_name} ({selected.customer_email})
                  </span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Phone</span>
                  <span className="profile-field-value">{selected.customer_phone || "—"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Amount</span>
                  <span className="profile-field-value">Rs {Number(selected.amount).toFixed(2)}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Method</span>
                  <span className="profile-field-value" style={{ textTransform: "capitalize" }}>
                    {selected.payment_method}
                  </span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Status</span>
                  <span className="profile-field-value" style={{ textTransform: "capitalize" }}>
                    {selected.payment_status}
                  </span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Transaction ID</span>
                  <span className="profile-field-value" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {selected.transaction_id || "—"}
                  </span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Session ID</span>
                  <span className="profile-field-value" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {selected.session_id || "—"}
                  </span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Created</span>
                  <span className="profile-field-value">
                    {new Date(selected.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ) : null}
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
