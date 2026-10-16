import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import api from "../api/client"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("ecom_token"))
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("ecom_user")
    if (!stored) return null
    const parsed = JSON.parse(stored)
    // Clear stale cache that doesn't have role field
    if (!parsed.role) {
      localStorage.removeItem("ecom_user")
      return null
    }
    return parsed
  })
  const fetchedRef = useRef(false)

  useEffect(() => {
    function handleSessionExpired() {
      setToken(null)
      setUser(null)
    }
    window.addEventListener("auth:session-expired", handleSessionExpired)
    return () => window.removeEventListener("auth:session-expired", handleSessionExpired)
  }, [])

  // Persist token to localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem("ecom_token", token)
    } else {
      localStorage.removeItem("ecom_token")
      localStorage.removeItem("ecom_user")
      setUser(null)
      fetchedRef.current = false
    }
  }, [token])

  // Fetch user profile when token is available and user not yet loaded
  useEffect(() => {
    if (!token || user || fetchedRef.current) return

    let cancelled = false
    fetchedRef.current = true

    async function fetchUser() {
      try {
        const res = await api.get("/profile")
        if (!cancelled) {
          setUser(res.data)
          localStorage.setItem("ecom_user", JSON.stringify(res.data))
        }
      } catch {
        if (!cancelled) setToken(null)
      }
    }

    fetchUser()
    return () => { cancelled = true }
  }, [token, user])

  const login = useCallback(async (email, password) => {
    const res = await api.post("/accounts/login", { email, password })
    setToken(res.data.access_token)

    // Fetch profile with the new token
    try {
      const profileRes = await api.get("/profile", {
        headers: { Authorization: `Bearer ${res.data.access_token}` },
      })
      setUser(profileRes.data)
      localStorage.setItem("ecom_user", JSON.stringify(profileRes.data))
    } catch {
      // Will retry on next render
    }

    return res.data
  }, [])

  const register = useCallback(async (userData) => {
    const res = await api.post("/accounts/register", userData)
    return res.data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post("/accounts/logout")
    } catch (error) {
      console.error("Failed to invalidate the backend session:", error)
    } finally {
      setToken(null)
      setUser(null)
      localStorage.removeItem("ecom_user")
    }
  }, [])

  const fetchUser = useCallback(async () => {
    if (!token) return
    try {
      const res = await api.get("/profile")
      setUser(res.data)
      localStorage.setItem("ecom_user", JSON.stringify(res.data))
    } catch {
      setToken(null)
    }
  }, [token])

  const isAdmin = user?.role === "admin"

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token),
    isAdmin,
    login,
    register,
    logout,
    fetchUser,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
