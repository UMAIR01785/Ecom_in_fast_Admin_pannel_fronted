import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAllOrders,
  getOrderDetail,
  updateOrderStatus,
} from "../api/adminOrders"
import { queryKeys } from "../api/queryKeys"

export function useAllOrders() {
  return useQuery({
    queryKey: queryKeys.orders.lists(),
    queryFn: getAllOrders,
    // orders -> 1 min / 10 min (mutations + websocket patches keep it live)
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  })
}

export function useAdminOrder(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.orders.detail(id),
    queryFn: () => getOrderDetail(id),
    enabled: enabled && Boolean(id),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  })
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ orderId, status }) => updateOrderStatus(orderId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}
