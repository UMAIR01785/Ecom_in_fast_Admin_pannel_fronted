import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  getAllRefunds,
  reviewRefund,
  completeCodRefund,
} from "../../api/adminRefunds"
import { getErrorMessage } from "../../api/client"

const STATUS_COLORS = {
  requested: { bg: "#fef3c7", text: "#92400e" },
  approved: { bg: "#dbeafe", text: "#1e40af" },
  rejected: { bg: "#fee2e2", text: "#991b1b" },
  processing: { bg: "#e0e7ff", text: "#3730a3" },
  completed: { bg: "#dcfce7", text: "#166534" },
  failed: { bg: "#fee2e2", text: "#991b1b" },
}

const STATUS_LABELS = {
  requested: "Requested",
  approved: "Approved",
  rejected: "Rejected",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
}

function formatDate(value) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function AdminRefunds() {
  const [refunds, setRefunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [toast, setToast] = useState(null)
  const [selected, setSelected] = useState(null)
  const [adminNote, setAdminNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    let cancelled = false
    async function fetchRefunds() {
      try {
        const data = await getAllRefunds()
        if (!cancelled) setRefunds(data)
      } catch (err) {
        if (!cancelled) showToast(getErrorMessage(err), "error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchRefunds()
    return () => {
      cancelled = true
    }
  }, [])

  function openReview(refund) {
    setSelected(refund)
    setAdminNote(refund.admin_note || "")
  }

  async function handleReview(decision) {
    if (!selected) return
    const confirmText =
      decision === "approve"
        ? "Approve this refund? Card refunds are sent back to the customer immediately."
        : "Reject this refund request?"
    if (!window.confirm(confirmText)) return

    setSubmitting(true)
    try {
      const updated = await reviewRefund(
        selected.id,
        decision,
        adminNote.trim() || null
      )
      setRefunds((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setSelected(null)
      setAdminNote("")
      showToast(
        decision === "approve"
          ? `Refund #${updated.id} approved`
          : `Refund #${updated.id} rejected`
      )
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCompleteCod() {
    if (!selected) return
    if (
      !window.confirm(
        "Confirm that the cash has already been returned to the customer?"
      )
    )
      return

    setSubmitting(true)
    try {
      const updated = await completeCodRefund(selected.id)
      setRefunds((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
      setSelected(null)
      showToast(`Refund #${updated.id} marked as completed`)
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setSubmitting(false)
    }
  }

  const statuses = [...new Set(refunds.map((r) => r.status))]

  const filtered = refunds.filter((refund) => {
    const q = search.toLowerCase()
    const matchesSearch =
      String(refund.id).includes(search) ||
      String(refund.order_id).includes(search) ||
      refund.reason?.toLowerCase().includes(q)
    const matchesStatus = !statusFilter || refund.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const totals = filtered.reduce((sum, r) => sum + Number(r.amount), 0)

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Refunds</h1>
          <p>Review customer refund requests and mark COD refunds as paid</p>
        </div>
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h2>
            All Refunds ({filtered.length})
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
                  {STATUS_LABELS[s] || s}
                </option>
              ))}
            </select>
            <div className="admin-table-search">
              <span className="search-icon">&#128269;</span>
              <input
                type="text"
                placeholder="Search by refund ID, order, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-loading-spinner" />
            <p>Loading refunds...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <div className="admin-empty-icon">&#128176;</div>
            <p>{search || statusFilter ? "No refunds match your filters." : "No refund requests yet."}</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Refund</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Requested</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((refund) => {
                  const style = STATUS_COLORS[refund.status] || STATUS_COLORS.requested
                  return (
                    <tr key={refund.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>#{refund.id}</div>
                      </td>
                      <td>
                        <Link
                          to={`/orders/${refund.order_id}`}
                          style={{ fontWeight: 600, fontSize: "0.875rem" }}
                        >
                          #{refund.order_id}
                        </Link>
                      </td>
                      <td style={{ fontSize: "0.875rem" }}>
                        User #{refund.requested_by}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        Rs {Number(refund.amount).toFixed(2)}
                      </td>
                      <td
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                          maxWidth: 260,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={refund.reason}
                      >
                        {refund.reason}
                      </td>
                      <td style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        {formatDate(refund.requested_at)}
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
                          {STATUS_LABELS[refund.status] || refund.status}
                        </span>
                      </td>
                      <td>
                        <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            className="admin-action-btn"
                            title={refund.status === "requested" ? "Review Refund" : "View Refund"}
                            onClick={() => openReview(refund)}
                          >
                            {refund.status === "requested" ? "&#9998;" : "&#128065;"}
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

      {selected && (
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
          onClick={() => !submitting && setSelected(null)}
        >
          <div
            className="profile-card"
            style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>
                Refund #{selected.id}
              </h2>
              <button
                className="admin-action-btn"
                title="Close"
                onClick={() => setSelected(null)}
                disabled={submitting}
              >
                &#10005;
              </button>
            </div>

            <div className="profile-fields">
              <div className="profile-field">
                <span className="profile-field-label">Order</span>
                <span className="profile-field-value">
                  <Link to={`/orders/${selected.order_id}`}>#{selected.order_id}</Link>
                </span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Customer</span>
                <span className="profile-field-value">User #{selected.requested_by}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Amount</span>
                <span className="profile-field-value">Rs {Number(selected.amount).toFixed(2)}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Status</span>
                <span className="profile-field-value" style={{ textTransform: "capitalize" }}>
                  {STATUS_LABELS[selected.status] || selected.status}
                </span>
              </div>
              <div className="profile-field" style={{ gridColumn: "1 / -1" }}>
                <span className="profile-field-label">Reason</span>
                <span className="profile-field-value">{selected.reason}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Requested</span>
                <span className="profile-field-value">{formatDate(selected.requested_at)}</span>
              </div>
              {selected.reviewed_at && (
                <div className="profile-field">
                  <span className="profile-field-label">Reviewed</span>
                  <span className="profile-field-value">{formatDate(selected.reviewed_at)}</span>
                </div>
              )}
              {selected.completed_at && (
                <div className="profile-field">
                  <span className="profile-field-label">Completed</span>
                  <span className="profile-field-value">{formatDate(selected.completed_at)}</span>
                </div>
              )}
              {selected.stripe_refund_id && (
                <div className="profile-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="profile-field-label">Stripe Refund ID</span>
                  <span className="profile-field-value" style={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {selected.stripe_refund_id}
                  </span>
                </div>
              )}
            </div>

            {selected.status === "requested" && (
              <div style={{ marginTop: 16 }}>
                <label
                  htmlFor="admin-note"
                  style={{ display: "block", fontWeight: 600, fontSize: "0.9rem", marginBottom: 8 }}
                >
                  Admin Note (optional)
                </label>
                <textarea
                  id="admin-note"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Reason for approving or rejecting"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-light)",
                    background: "var(--bg)",
                    color: "var(--text)",
                    fontSize: "0.9rem",
                    fontFamily: "inherit",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 16 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleReview("reject")}
                    disabled={submitting}
                    style={{
                      borderColor: "#fca5a5",
                      color: "#991b1b",
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? "Working..." : "Reject"}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => handleReview("approve")}
                    disabled={submitting}
                    style={{
                      background: "#4f46e5",
                      color: "#fff",
                      border: "1px solid #4f46e5",
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? "Working..." : "Approve"}
                  </button>
                </div>
              </div>
            )}

            {selected.status === "approved" && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 12px" }}>
                  This refund was approved. Once the cash has been returned to the
                  customer, mark it as completed.
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn btn-sm"
                    onClick={handleCompleteCod}
                    disabled={submitting}
                    style={{
                      background: "#16a34a",
                      color: "#fff",
                      border: "1px solid #16a34a",
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? "Working..." : "Mark COD Refund as Paid"}
                  </button>
                </div>
              </div>
            )}
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
