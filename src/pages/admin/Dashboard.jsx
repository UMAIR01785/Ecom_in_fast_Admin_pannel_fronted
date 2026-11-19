import { Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import ReportsSection from "../../components/admin/ReportsSection"
import { useAllRefunds } from "../../hooks/useRefundQueries"

export default function Dashboard() {
  const { user } = useAuth()
  const refundsQuery = useAllRefunds()
  const pendingRefunds = (refundsQuery.data ?? []).filter(
    (r) => r.status === "requested"
  )

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Welcome back, {user?.first_name || "Admin"}</h1>
          <p>Here&apos;s what&apos;s happening with your store.</p>
        </div>
        <Link to="/categories?create=true" className="btn btn-primary btn-sm">
          + New Category
        </Link>
      </div>

      {pendingRefunds.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            padding: "16px 20px",
            marginBottom: 24,
            borderRadius: 12,
            background: "#fffbeb",
            border: "1px solid #fde68a",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, color: "#92400e", fontSize: "1rem" }}>
              {pendingRefunds.length} refund request{pendingRefunds.length > 1 ? "s" : ""} waiting for review
            </div>
            <div style={{ fontSize: "0.875rem", color: "#a16207", marginTop: 4 }}>
              {pendingRefunds.slice(0, 3).map((r) => `#${r.id} (Order #${r.order_id})`).join(", ")}
              {pendingRefunds.length > 3 ? ` and ${pendingRefunds.length - 3} more` : ""}
            </div>
          </div>
          <Link
            to="/refunds"
            className="btn btn-sm"
            style={{
              background: "#f59e0b",
              color: "#fff",
              border: "1px solid #f59e0b",
              whiteSpace: "nowrap",
            }}
          >
            Review Refunds
          </Link>
        </div>
      )}

      <ReportsSection />
    </div>
  )
}
