import { useEffect, useState } from "react"
import { getAllUsers } from "../../api/adminUsers"
import { getErrorMessage } from "../../api/client"

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [toast, setToast] = useState(null)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    let cancelled = false
    async function fetchUsers() {
      try {
        const data = await getAllUsers()
        if (!cancelled) setUsers(data)
      } catch (err) {
        if (!cancelled) showToast(getErrorMessage(err), "error")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchUsers()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = users.filter((user) => {
    const q = search.toLowerCase()
    return (
      user.first_name?.toLowerCase().includes(q) ||
      user.last_name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.username?.toLowerCase().includes(q) ||
      user.phone_number?.toLowerCase().includes(q) ||
      String(user.id).includes(search)
    )
  })

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Users</h1>
          <p>All registered customers on your store</p>
        </div>
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h2>
            All Users ({filtered.length})
          </h2>
          <div className="admin-table-search">
            <span className="search-icon">&#128269;</span>
            <input
              type="text"
              placeholder="Search by name, email, username, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-loading-spinner" />
            <p>Loading users...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <div className="admin-empty-icon">&#128101;</div>
            <p>{search ? "No users match your search." : "No users yet."}</p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>#{user.id}</div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "var(--primary, #4f46e5)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          {user.first_name?.[0]}
                          {user.last_name?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                            {user.first_name} {user.last_name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: "0.875rem" }}>@{user.username}</td>
                    <td style={{ fontSize: "0.875rem" }}>{user.email}</td>
                    <td style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                      {user.phone_number || "—"}
                    </td>
                  </tr>
                ))}
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
