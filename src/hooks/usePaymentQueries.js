import { useQuery } from "@tanstack/react-query"
import { getAllPayments, getPayment } from "../api/adminPayments"
import { queryKeys } from "../api/queryKeys"

export function useAllPayments() {
  return useQuery({
    queryKey: queryKeys.payments.lists(),
    queryFn: getAllPayments,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  })
}

export function usePayment(paymentId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.payments.detail(paymentId),
    queryFn: () => getPayment(paymentId),
    enabled: enabled && Boolean(paymentId),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  })
}
