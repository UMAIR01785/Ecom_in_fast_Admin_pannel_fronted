import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getAllRefunds,
  reviewRefund,
  receiveReturn,
  completeCodRefund,
} from "../api/adminRefunds"
import { queryKeys } from "../api/queryKeys"

export function useAllRefunds({ refetchInterval } = {}) {
  return useQuery({
    queryKey: queryKeys.refunds.lists(),
    queryFn: getAllRefunds,
    // refunds -> 1 min / 10 min (order-adjacent operational data)
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchInterval,
  })
}

export function useReviewRefund() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ refundId, decision, adminNote }) =>
      reviewRefund(refundId, decision, adminNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}

export function useReceiveReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ refundId, restockable }) =>
      receiveReturn(refundId, restockable),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      // Restocked units change product stock and inventory reports
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}

export function useCompleteCodRefund() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (refundId) => completeCodRefund(refundId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.refunds.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}
