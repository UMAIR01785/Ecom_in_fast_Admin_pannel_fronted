import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  withCredentials: true,
})

let isRefreshing = false
let pendingQueue = []

function processQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  pendingQueue = []
}

const AUTH_PATHS = ["/accounts/login", "/accounts/refresh", "/accounts/logout"]

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ecom_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error?.response?.status
    const url = originalRequest?.url || ""
    const isAuthPath = AUTH_PATHS.some((p) => url.includes(p))

    if (status === 401 && !isAuthPath && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await api.post("/accounts/refresh")
        const newToken = res.data.access_token
        localStorage.setItem("ecom_token", newToken)
        processQueue(null, newToken)
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem("ecom_token")
        localStorage.removeItem("ecom_user")
        window.dispatchEvent(new Event("auth:session-expired"))
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export function getErrorMessage(error) {
  const detail = error?.response?.data?.detail

  if (!detail) {
    return error?.message === "Network Error"
      ? "Cannot connect to the server. Is the backend running?"
      : "Something went wrong. Please try again."
  }

  if (typeof detail === "string") {
    return detail
  }

  if (Array.isArray(detail)) {
    return detail
      .map((err) => {
        const field = err.loc?.[err.loc.length - 1]
        return field ? `${field}: ${err.msg}` : err.msg
      })
      .join(", ")
  }

  return "Something went wrong. Please try again."
}

export default api
