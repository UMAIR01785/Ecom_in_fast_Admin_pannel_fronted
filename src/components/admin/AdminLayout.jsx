import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"
import { useAdminChat } from "../../context/AdminChatContext"
import FloatingChatWidget from "./FloatingChatWidget"

const links = [
  { to: "/", label: "Dashboard", icon: "\u25A6", end: true },
  { to: "/categories", label: "Categories", icon: "\u2630" },
  { to: "/products", label: "Products", icon: "\u2630" },
  { to: "/orders", label: "Orders", icon: "\u2630" },
  { to: "/payments", label: "Payments", icon: "\u2630" },
  { to: "/users", label: "Users", icon: "\u2630" },
  { to: "/chat", label: "Chat", icon: "\u2630" },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { queue, sending } = useAdminChat()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate("/login")
  }

  return (
    <div className="admin-layout">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <NavLink to="/" className="admin-topbar-logo">
            ShopSphere
          </NavLink>
          <span className="admin-topbar-badge">Admin</span>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-topbar-user">
            <div className="admin-topbar-avatar">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <span className="admin-topbar-name">{user?.first_name}</span>
          </div>
          <button onClick={handleLogout} className="admin-topbar-logout">
            Logout
          </button>
        </div>
      </header>

      <div className="admin-body">
        <aside className="admin-sidebar">
          <nav className="admin-sidebar-nav">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `admin-sidebar-link${isActive ? " active" : ""}`
                }
              >
                <span className="icon">{link.icon}</span>
                {link.label}
                {link.to === "/chat" && (sending || queue.length > 0) && (
                  <span
                    className={`admin-sidebar-badge${
                      queue.length > 0 ? "" : " pulse"
                    }`}
                    title={
                      queue.length > 0
                        ? `${queue.length} message(s) queued`
                        : "AI is replying"
                    }
                  >
                    {queue.length > 0 ? queue.length : "•"}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="admin-main">
          <Outlet />
        </main>
      </div>

      <FloatingChatWidget />
    </div>
  )
}
