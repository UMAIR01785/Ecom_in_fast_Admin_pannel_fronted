import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { getOrderDetail, updateOrderStatus } from "../../api/adminOrders"
import { getErrorMessage } from "../../api/client"
import { useAdminOrderSocket } from "../../context/AdminOrderSocketContext"

const ALLOWED_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
}

const STATUS_COLORS = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dbeafe", text: "#1e40af" },
  processing: { bg: "#e0e7ff", text: "#3730a3" },
  shipped: { bg: "#d1fae5", text: "#065f46" },
  delivered: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#fee2e2", text: "#991b1b" },
}

const PAYMENT_STATUS_COLORS = {
  pending: { bg: "#fef3c7", text: "#92400e" },
  paid: { bg: "#dcfce7", text: "#166534" },
  failed: { bg: "#fee2e2", text: "#991b1b" },
  refunded: { bg: "#e0e7ff", text: "#3730a3" },
}

export default function AdminOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { subscribe, connected } = useAdminOrderSocket()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState(null)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    return subscribe((message) => {
      if (message?.type === "order_cancelled") {
        const { order_id: orderId, status } = message
        if (String(orderId) !== String(id)) return
        setOrder((prev) => (prev ? { ...prev, status } : prev))
        showToast(`Order #${orderId} was cancelled by customer`)
        return
      }

      if (message?.event !== "order_status_updated") return

      const { order_id: orderId, status } = message.data || {}
      if (String(orderId) !== String(id)) return

      setOrder((prev) => (prev ? { ...prev, status } : prev))
    })
  }, [subscribe, id])

  useEffect(() => {
    let cancelled = false
    async function fetchOrder() {
      try {
        const data = await getOrderDetail(id)
        if (!cancelled) setOrder(data)
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchOrder()
    return () => { cancelled = true }
  }, [id])

  async function handleStatusChange(newStatus) {
    setUpdating(true)
    try {
      await updateOrderStatus(order.id, newStatus)
      showToast(`Status updated to ${newStatus}`)
      const data = await getOrderDetail(id)
      setOrder(data)
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-table-empty">
        <div className="admin-loading-spinner" />
        <p>Loading order details...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="alert alert-error">{error}</div>
        <button className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => navigate("/orders")}>
          &larr; Back to Orders
        </button>
      </div>
    )
  }

  if (!order) return null

  const style = STATUS_COLORS[order.status] || STATUS_COLORS.pending
  const shipping = order.shipping_address
  const payment = order.payment
  const paymentStyle = PAYMENT_STATUS_COLORS[payment?.status] || PAYMENT_STATUS_COLORS.pending
  const itemTotal = order.items.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  )

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Order #{order.id}</h1>
          <p style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Placed by{" "}
            <strong>{order.user?.first_name} {order.user?.last_name}</strong>{" "}
            (@{order.user?.username})
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "2px 10px",
                borderRadius: 999,
                fontSize: "0.75rem",
                fontWeight: 600,
                background: connected ? "#dcfce7" : "#f3f4f6",
                color: connected ? "#166534" : "#6b7280",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: connected ? "#16a34a" : "#9ca3af",
                }}
              />
              {connected ? "Live" : "Offline"}
            </span>
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => navigate("/orders")}>
          &larr; Back to Orders
        </button>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-detail-stack">
          <div className="profile-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
              Order Info
            </h2>
            <div className="profile-fields">
              <div className="profile-field">
                <span className="profile-field-label">Order ID</span>
                <span className="profile-field-value">#{order.id}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Placed On</span>
                <span className="profile-field-value">
                  {new Date(order.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Status</span>
                <span className="profile-field-value">
                  <span style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    background: style.bg,
                    color: style.text,
                    textTransform: "capitalize",
                  }}>
                    {order.status}
                  </span>
                </span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Payment Status</span>
                <span className="profile-field-value">
                  <span style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 999,
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    background: paymentStyle.bg,
                    color: paymentStyle.text,
                    textTransform: "capitalize",
                  }}>
                    {payment?.status || "no payment"}
                  </span>
                </span>
              </div>
              {payment && (
                <div className="profile-field">
                  <span className="profile-field-label">Payment Method</span>
                  <span className="profile-field-value" style={{ textTransform: "capitalize" }}>
                    {payment.method}
                    {payment.transaction_id ? ` • ${payment.transaction_id}` : ""}
                  </span>
                </div>
              )}
              <div className="profile-field">
                <span className="profile-field-label">Update Status</span>
                <span className="profile-field-value">
                  {(ALLOWED_TRANSITIONS[order.status] || []).length > 0 ? (
                    <select
                      key={order.status}
                      defaultValue=""
                      onChange={(e) => handleStatusChange(e.target.value)}
                      disabled={updating}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-light)",
                        fontSize: "0.875rem",
                        background: "var(--bg)",
                        color: "var(--text)",
                        cursor: updating ? "not-allowed" : "pointer",
                      }}
                    >
                      <option value="" disabled>Select status</option>
                      {(ALLOWED_TRANSITIONS[order.status] || []).map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>No further updates</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="profile-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
              Customer
            </h2>
            <div className="profile-fields">
              <div className="profile-field">
                <span className="profile-field-label">Name</span>
                <span className="profile-field-value">{order.user?.first_name} {order.user?.last_name}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Username</span>
                <span className="profile-field-value">@{order.user?.username}</span>
              </div>
              <div className="profile-field">
                <span className="profile-field-label">Email</span>
                <span className="profile-field-value">{order.user?.email}</span>
              </div>
            </div>
          </div>

          <div className="profile-card">
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--border-light)" }}>
              Shipping Address
            </h2>
            {shipping && typeof shipping === "object" ? (
              <div className="profile-fields">
                <div className="profile-field">
                  <span className="profile-field-label">Recipient</span>
                  <span className="profile-field-value">{shipping.full_name}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Phone</span>
                  <span className="profile-field-value">{shipping.phone_number}</span>
                </div>
                <div className="profile-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="profile-field-label">Address</span>
                  <span className="profile-field-value">
                    {shipping.address_line1}
                    {shipping.address_line2 ? `, ${shipping.address_line2}` : ""}
                  </span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">City</span>
                  <span className="profile-field-value">{shipping.city}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">State / Province</span>
                  <span className="profile-field-value">{shipping.state || "—"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Postal Code</span>
                  <span className="profile-field-value">{shipping.postal_code || "—"}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-field-label">Country</span>
                  <span className="profile-field-value">{shipping.country}</span>
                </div>
                <div className="profile-field" style={{ gridColumn: "1 / -1" }}>
                  <span className="profile-field-label">Landmark</span>
                  <span className="profile-field-value">{shipping.landmark || "—"}</span>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--text)", lineHeight: 1.6, margin: 0 }}>
                {shipping || "No shipping address"}
              </p>
            )}
          </div>
        </div>

        <div className="sc-summary">
          <h2 className="sc-summary-title">Order Items</h2>

          {order.items.map((item) => (
            <div key={item.id} style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 0",
              borderBottom: "1px solid var(--border-light)",
              fontSize: "0.9rem",
            }}>
              {item.product_image || item.product?.image ? (
                <img
                  src={item.product_image || item.product?.image}
                  alt={item.product_name || item.product?.name || "Product"}
                  style={{
                    width: 48,
                    height: 48,
                    objectFit: "cover",
                    borderRadius: "var(--radius-sm)",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--radius-sm)",
                  background: "var(--border-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  fontSize: "1rem",
                  flexShrink: 0,
                }}>
                  {item.product_name?.[0] || item.product?.name?.[0] || "?"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.product_name || item.product?.name || `Product #${item.product_id}`}
                </div>
                {(item.variant_size || item.variant_color || item.variant_sku) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "3px 0" }}>
                    {item.variant_size && (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        background: "var(--primary-light, #fff3e0)",
                        color: "var(--primary-dark, #e65100)",
                      }}>
                        Size: {item.variant_size}
                      </span>
                    )}
                    {item.variant_color && (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        background: "var(--primary-light, #fff3e0)",
                        color: "var(--primary-dark, #e65100)",
                      }}>
                        Color: {item.variant_color}
                      </span>
                    )}
                    {item.variant_sku && (
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", alignSelf: "center" }}>
                        {item.variant_sku}
                      </span>
                    )}
                  </div>
                )}
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                  Qty: {item.quantity} x Rs {Number(item.unit_price).toFixed(2)}
                </div>
              </div>
              <span style={{ fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                Rs {(Number(item.unit_price) * item.quantity).toFixed(2)}
              </span>
            </div>
          ))}

          <div className="sc-divider" />

          <div className="sc-summary-row">
            <span>Subtotal ({order.items.length} items)</span>
            <span>Rs {itemTotal.toFixed(2)}</span>
          </div>

          <div className="sc-summary-row">
            <span>Shipping</span>
            <span className="sc-free">Free</span>
          </div>

          <div className="sc-divider" />

          <div className="sc-summary-row sc-total">
            <span>Total</span>
            <span>Rs {Number(order.total_amount).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === "success" ? "&#10003; " : "&#9888; "}
          {toast.message}
        </div>
      )}
    </div>
  )
}
