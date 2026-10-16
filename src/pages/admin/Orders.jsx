import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { getAllOrders, updateOrderStatus } from "../../api/adminOrders"
import { getErrorMessage } from "../../api/client"
import { useAdminOrderSocket } from "../../context/AdminOrderSocketContext"
import { addressLine, addressSearchText } from "../../utils/orderAddress"

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

export default function AdminOrders() {
  const { subscribe, connected } = useAdminOrderSocket()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [toast, setToast] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [highlightId, setHighlightId] = useState(null)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function fetchOrders() {
    try {
      const data = await getAllOrders()
      setOrders(data)
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    return subscribe((message) => {
      if (message?.type === "new_order" || message?.event === "order_created") {
        fetchOrders()
        showToast(`New order #${message.order_id} received`)
        return
      }

      if (message?.type === "order_cancelled") {
        const { order_id: orderId, status } = message
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        )
        setHighlightId(orderId)
        setTimeout(() => setHighlightId(null), 3000)
        showToast(`Order #${orderId} was cancelled by customer`)
        return
      }

      if (message?.event === "order_status_updated") {
        const { order_id: orderId, status } = message.data || {}
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        )
      }
    })
  }, [subscribe])

  useEffect(() => {
    fetchOrders()
  }, [])

  async function handleStatusChange(orderId, newStatus) {
    setUpdatingId(orderId)
    try {
      await updateOrderStatus(orderId, newStatus)
      showToast(`Order #${orderId} status updated to ${newStatus}`)
      await fetchOrders()
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = orders.filter((order) => {
    const q = search.toLowerCase()
    const matchesSearch =
      String(order.id).includes(search) ||
      addressSearchText(order.shipping_address).includes(q) ||
      order.user?.username?.toLowerCase().includes(q) ||
      order.user?.first_name?.toLowerCase().includes(q) ||
      order.user?.last_name?.toLowerCase().includes(q)
    const matchesStatus = !statusFilter || order.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Orders</h1>
          <p style={{ display: "flex", alignItems: "center", gap: 8 }}>
            Manage customer orders
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
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h2>All Orders ({filtered.length})</h2>
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
              {Object.keys(ALLOWED_TRANSITIONS).map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
            <div className="admin-table-search">
              <span className="search-icon">&#128269;</span>
              <input
                type="text"
                placeholder="Search by order ID, name, or address..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-loading-spinner" />
            <p>Loading orders...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <div className="admin-empty-icon">&#128230;</div>
            <p>{search || statusFilter ? "No orders match your filters." : "No orders yet."}</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Shipping</th>
                <th>Items</th>
                <th>Total</th>
                <th>Date</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
                {filtered.map((order) => {
                const style = STATUS_COLORS[order.status] || STATUS_COLORS.pending
                const highlighted = highlightId === order.id
                return (
                  <tr
                    key={order.id}
                    style={
                      highlighted
                        ? {
                            background: "#fef2f2",
                            outline: "1px solid #fecaca",
                            transition: "background 0.3s",
                          }
                        : undefined
                    }
                  >
                    <td>
                      <div style={{ fontWeight: 600 }}>#{order.id}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                        {order.user?.first_name} {order.user?.last_name}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        @{order.user?.username}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {addressLine(order.shipping_address) || "—"}
                      </div>
                    </td>
                    <td>
                      <span className="status-badge active">
                        <span className="status-badge-dot" />
                        {order.items?.length || 0}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      Rs {Number(order.total_amount).toFixed(2)}
                    </td>
                    <td style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                      {new Date(order.created_at).toLocaleDateString("en-US", {
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
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                        <Link
                          to={`/orders/${order.id}`}
                          className="admin-action-btn"
                          title="View Details"
                        >
                          &#128065;
                        </Link>
                        {(ALLOWED_TRANSITIONS[order.status] || []).length > 0 ? (
                          <select
                            key={order.id + "-" + order.status}
                            defaultValue=""
                            onChange={(e) => handleStatusChange(order.id, e.target.value)}
                            disabled={updatingId === order.id}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border-light)",
                              fontSize: "0.8rem",
                              background: "var(--bg)",
                              color: "var(--text)",
                              cursor: updatingId === order.id ? "not-allowed" : "pointer",
                            }}
                          >
                            <option value="" disabled>Update</option>
                            {(ALLOWED_TRANSITIONS[order.status] || []).map((s) => (
                              <option key={s} value={s}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>—</span>
                        )}
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

      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === "success" ? "&#10003; " : "&#9888; "}
          {toast.message}
        </div>
      )}
    </div>
  )
}
