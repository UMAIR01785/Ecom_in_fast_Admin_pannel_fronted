import { useState } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { getErrorMessage } from "../api/client"
import { SITE_URL } from "../config"

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { isAuthenticated, isAdmin, login, logout } = useAuth()
  const navigate = useNavigate()

  if (isAuthenticated && isAdmin) return <Navigate to="/" replace />

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      await login(form.email, form.password)

      const stored = localStorage.getItem("ecom_user")
      const profile = stored ? JSON.parse(stored) : null

      if (profile?.role !== "admin") {
        logout()
        setError("This account does not have admin access.")
        return
      }

      navigate("/")
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Admin Login</h1>
        <p className="auth-subtitle">Sign in to the ShopSphere admin dashboard.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="admin@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 28 }}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-block"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-footer">
          Not an admin? <a href={SITE_URL}>Back to the shop</a>
        </p>
      </div>
    </main>
  )
}
