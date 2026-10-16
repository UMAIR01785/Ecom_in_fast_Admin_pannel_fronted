import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useAuth } from "./AuthContext"

const AdminOrderSocketContext = createContext(null)

function getAdminOrdersWsUrl(token) {
  const base = import.meta.env.VITE_API_URL || "http://localhost:8000"
  const wsBase = base.replace(/^http/, "ws")
  return `${wsBase}/ws/admin/orders?token=${encodeURIComponent(token)}`
}

export function AdminOrderSocketProvider({ children }) {
  const { token, isAuthenticated, isAdmin } = useAuth()
  const [connected, setConnected] = useState(false)
  const listenersRef = useRef(new Set())
  const wsRef = useRef(null)
  const retryTimerRef = useRef(null)
  const stoppedRef = useRef(false)
  const activeRef = isAuthenticated && isAdmin && Boolean(token)

  useEffect(() => {
    if (!activeRef) {
      stoppedRef.current = true
      clearTimeout(retryTimerRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
      return
    }

    stoppedRef.current = false
    let retryDelay = 1000

    function connect() {
      if (stoppedRef.current) return

      const ws = new WebSocket(getAdminOrdersWsUrl(token))
      wsRef.current = ws

      ws.onopen = () => {
        retryDelay = 1000
        setConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          listenersRef.current.forEach((listener) => listener(message))
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = (event) => {
        setConnected(false)
        if (stoppedRef.current || event.code === 1008) return

        const delay = retryDelay
        retryDelay = Math.min(retryDelay * 2, 15000)
        retryTimerRef.current = setTimeout(connect, delay)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      stoppedRef.current = true
      clearTimeout(retryTimerRef.current)
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      setConnected(false)
    }
  }, [activeRef, token])

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const value = {
    connected,
    subscribe,
  }

  return (
    <AdminOrderSocketContext.Provider value={value}>
      {children}
    </AdminOrderSocketContext.Provider>
  )
}

export function useAdminOrderSocket() {
  const context = useContext(AdminOrderSocketContext)
  if (!context) {
    throw new Error("useAdminOrderSocket must be used within AdminOrderSocketProvider")
  }
  return context
}
