import api from "./client"

function rangeParams({ startDate, endDate } = {}) {
  const params = {}
  if (startDate) params.start_date = startDate
  if (endDate) params.end_date = endDate
  return params
}

export async function getReportOverview({ startDate, endDate, threshold } = {}) {
  const params = rangeParams({ startDate, endDate })
  if (threshold !== undefined && threshold !== null && threshold !== "") {
    params.low_stock_threshold = threshold
  }
  const res = await api.get("/admin/reports/overview", { params })
  return res.data
}

export async function getReportSales({ startDate, endDate } = {}) {
  const res = await api.get("/admin/reports/sales", {
    params: rangeParams({ startDate, endDate }),
  })
  return res.data
}

export async function getReportTopProducts({ startDate, endDate, limit = 10 } = {}) {
  const params = rangeParams({ startDate, endDate })
  params.limit = limit
  const res = await api.get("/admin/reports/top-products", { params })
  return res.data
}

export async function getReportPayments({ startDate, endDate } = {}) {
  const res = await api.get("/admin/reports/payments", {
    params: rangeParams({ startDate, endDate }),
  })
  return res.data
}

export async function getReportInventory({ threshold, limit = 20 } = {}) {
  const params = {}
  if (threshold !== undefined && threshold !== null && threshold !== "") {
    params.threshold = threshold
  }
  params.limit = limit
  const res = await api.get("/admin/reports/inventory", { params })
  return res.data
}
