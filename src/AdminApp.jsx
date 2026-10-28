import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { AdminOrderSocketProvider } from "./context/AdminOrderSocketContext"
import { AdminChatProvider } from "./context/AdminChatContext"
import AdminLayout from "./components/admin/AdminLayout"
import Login from "./pages/Login"
import Dashboard from "./pages/admin/Dashboard"
import AdminCategories from "./pages/admin/Categories"
import AdminProducts from "./pages/admin/Products"
import AdminInventoryLot from "./pages/admin/inventory_lot"
import AdminOrders from "./pages/admin/Orders"
import AdminOrderDetail from "./pages/admin/OrderDetail"
import AdminPayments from "./pages/admin/Payments"
import AdminRefunds from "./pages/admin/Refunds"
import AdminUsers from "./pages/admin/Users"
import AdminChat from "./pages/admin/Chat"
import { SITE_URL } from "./config"

function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to={SITE_URL} replace />
  return children
}

function AdminApp() {
  return (
    <AuthProvider>
      <AdminOrderSocketProvider>
        <AdminChatProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route
                path="/"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="inventory-lot" element={<AdminInventoryLot />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="orders/:id" element={<AdminOrderDetail />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="refunds" element={<AdminRefunds />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="chat" element={<AdminChat />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AdminChatProvider>
      </AdminOrderSocketProvider>
    </AuthProvider>
  )
}

export default AdminApp
