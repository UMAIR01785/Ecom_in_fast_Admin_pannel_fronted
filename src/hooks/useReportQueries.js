import { useQuery } from "@tanstack/react-query"
import {
  getReportOverview,
  getReportSales,
  getReportTopProducts,
  getReportPayments,
  getReportInventory,
} from "../api/adminReports"
import { queryKeys } from "../api/queryKeys"

function rangeParams({ startDate, endDate } = {}) {
  const params = {}
  if (startDate) params.start_date = startDate
  if (endDate) params.end_date = endDate
  return params
}

export function useReportOverview({ startDate, endDate, threshold } = {}) {
  const params = rangeParams({ startDate, endDate })
  if (threshold !== undefined && threshold !== null && threshold !== "") {
    params.low_stock_threshold = threshold
  }
  return useQuery({
    queryKey: queryKeys.reports.overview(params),
    queryFn: () => getReportOverview({ startDate, endDate, threshold }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  })
}

export function useReportSales({ startDate, endDate } = {}) {
  const params = rangeParams({ startDate, endDate })
  return useQuery({
    queryKey: queryKeys.reports.sales(params),
    queryFn: () => getReportSales({ startDate, endDate }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  })
}

export function useReportTopProducts({ startDate, endDate, limit = 10 } = {}) {
  const params = { ...rangeParams({ startDate, endDate }), limit }
  return useQuery({
    queryKey: queryKeys.reports.topProducts(params),
    queryFn: () => getReportTopProducts({ startDate, endDate, limit }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  })
}

export function useReportPayments({ startDate, endDate } = {}) {
  const params = rangeParams({ startDate, endDate })
  return useQuery({
    queryKey: queryKeys.reports.payments(params),
    queryFn: () => getReportPayments({ startDate, endDate }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  })
}

export function useReportInventory({ threshold, limit = 20 } = {}) {
  const params = {}
  if (threshold !== undefined && threshold !== null && threshold !== "") {
    params.threshold = threshold
  }
  params.limit = limit
  return useQuery({
    queryKey: queryKeys.reports.inventory(params),
    queryFn: () => getReportInventory({ threshold, limit }),
    staleTime: 30_000,
    gcTime: 10 * 60_000,
  })
}
