import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  getInventoryLots,
  getInventoryLot,
  receiveInventoryLot,
} from "../api/inventory_lot"
import { queryKeys } from "../api/queryKeys"

export function useInventoryLots({ skip = 0, limit = 20 } = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.lots({ skip, limit }),
    queryFn: () => getInventoryLots({ skip, limit }),
    staleTime: 15_000,
    gcTime: 10 * 60_000,
  })
}

export function useInventoryLot(lotId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.inventory.lot(lotId),
    queryFn: () => getInventoryLot(lotId),
    enabled: enabled && Boolean(lotId),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  })
}

export function useReceiveInventoryLot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload) => receiveInventoryLot(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
  })
}
