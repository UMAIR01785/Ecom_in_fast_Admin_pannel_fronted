import { Link } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import ReportsSection from "../../components/admin/ReportsSection"

export default function Dashboard() {
  const { user } = useAuth()

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

      <ReportsSection />
    </div>
  )
}
