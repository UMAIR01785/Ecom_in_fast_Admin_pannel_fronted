import { useCallback, useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  IndianRupee,
  ShoppingCart,
  Users,
} from "lucide-react"
import {
  getReportInventory,
  getReportOverview,
  getReportPayments,
  getReportSales,
  getReportTopProducts,
} from "../../api/adminReports"
import { getErrorMessage } from "../../api/client"
import { useAdminOrderSocket } from "../../context/AdminOrderSocketContext"
import { Badge } from "../../components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"

const CHART = {
  primary: "#ff6d00",
  grid: "#f0f0f8",
  tick: "#8b8ba3",
  tooltipBorder: "#e8e8f0",
}

const ORDER_STATUS_META = {
  pending: { label: "Pending", color: "#f59e0b" },
  confirmed: { label: "Confirmed", color: "#0ea5e9" },
  processing: { label: "Processing", color: "#6366f1" },
  shipped: { label: "Shipped", color: "#8b5cf6" },
  delivered: { label: "Delivered", color: "#10b981" },
  cancelled: { label: "Cancelled", color: "#f43f5e" },
}

const PAYMENT_STATUS_COLORS = {
  pending: "#f59e0b",
  paid: "#10b981",
  succeeded: "#10b981",
  completed: "#10b981",
  failed: "#f43f5e",
  cancelled: "#f43f5e",
  refunded: "#6366f1",
}

const money = (value) =>
  `Rs ${Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`

const moneyExact = (value) =>
  `Rs ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

function compactMoney(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1e6) return `Rs ${(n / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `Rs ${(n / 1e3).toFixed(1)}K`
  return `Rs ${n.toFixed(0)}`
}

function toISODate(date) {
  return date.toISOString().slice(0, 10)
}

function daysAgoISO(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return toISODate(d)
}

function shortLabel(dateKey) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function eachDateKey(start, end) {
  if (!start || !end) return []
  const out = []
  const d = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  if (Number.isNaN(d.getTime()) || Number.isNaN(last.getTime()) || d > last)
    return []
  while (d <= last && out.length <= 366) {
    out.push(toISODate(d))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return out
}

function StatCard({ title, value, icon: Icon, hint }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <span className="rounded-lg bg-primary-100 p-2 text-primary-dark">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">
        {value}
      </div>
      {hint && (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </Card>
  )
}

export default function ReportsSection() {
  const { subscribe } = useAdminOrderSocket()
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [threshold, setThreshold] = useState("5")
  const [query, setQuery] = useState({ startDate: "", endDate: "", threshold: 5 })

  const [overview, setOverview] = useState(null)
  const [sales, setSales] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [payments, setPayments] = useState(null)
  const [inventory, setInventory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  function showToast(message, type = "error") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async (q) => {
    setLoading(true)
    const results = await Promise.allSettled([
      getReportOverview(q),
      getReportSales(q),
      getReportTopProducts({ ...q, limit: 10 }),
      getReportPayments(q),
      getReportInventory({ threshold: q.threshold, limit: 20 }),
    ])

    const [ov, sl, tp, pay, inv] = results
    if (ov.status === "fulfilled") {
      setOverview(ov.value)
      setStartDate(ov.value.start_date)
      setEndDate(ov.value.end_date)
    } else {
      showToast(getErrorMessage(ov.reason))
    }
    if (sl.status === "fulfilled") setSales(sl.value)
    if (tp.status === "fulfilled") setTopProducts(tp.value.products || [])
    if (pay.status === "fulfilled") setPayments(pay.value)
    if (inv.status === "fulfilled") setInventory(inv.value)
    setLoading(false)
  }, [])

  useEffect(() => {
    load(query)
  }, [load, query])

  useEffect(() => {
    return subscribe((message) => {
      if (message?.type !== "inventory_updated") return
      const stockById = new Map(
        (message.products || []).map((p) => [p.product_id, p.stock])
      )
      if (stockById.size === 0) return
      setTopProducts((prev) =>
        prev.map((p) =>
          stockById.has(p.product_id)
            ? { ...p, current_stock: stockById.get(p.product_id) }
            : p
        )
      )
      setInventory((prev) =>
        prev
          ? {
              ...prev,
              low_stock_products: prev.low_stock_products.map((p) =>
                stockById.has(p.product_id)
                  ? { ...p, stock: stockById.get(p.product_id) }
                  : p
              ),
            }
          : prev
      )
    })
  }, [subscribe])

  function applyFilters(e) {
    e?.preventDefault()
    if (startDate && endDate && startDate > endDate) {
      showToast("Start date cannot be after end date")
      return
    }
    setQuery({
      startDate,
      endDate,
      threshold: Math.min(Math.max(Number(threshold) || 5, 0), 10000),
    })
  }

  function applyPreset(start, end) {
    setStartDate(start)
    setEndDate(end)
    setQuery((prev) => ({ ...prev, startDate: start, endDate: end }))
  }

  const presetRanges = [
    { label: "7 days", start: daysAgoISO(6) },
    { label: "30 days", start: daysAgoISO(29) },
    { label: "90 days", start: daysAgoISO(89) },
  ]

  const chartData = (() => {
    if (!sales) return []
    const rows = sales.sales || []
    const days = eachDateKey(sales.start_date, sales.end_date)
    if (days.length === 0 || days.length > 366) {
      return rows.map((row) => ({
        key: row.date,
        label: shortLabel(row.date),
        revenue: row.revenue,
        payments: row.payment_count,
      }))
    }
    const byDate = new Map(rows.map((row) => [row.date, row]))
    return days.map((key) => {
      const row = byDate.get(key)
      return {
        key,
        label: shortLabel(key),
        revenue: row?.revenue ?? 0,
        payments: row?.payment_count ?? 0,
      }
    })
  })()

  const statusData = overview
    ? Object.entries(ORDER_STATUS_META)
        .map(([status, meta]) => ({
          status,
          label: meta.label,
          color: meta.color,
          value: overview.order_statuses?.[status] ?? 0,
        }))
        .filter((row) => row.value > 0)
    : []
  const statusTotal = statusData.reduce((sum, row) => sum + row.value, 0)

  const paymentRows = payments?.groups || []
  const paymentTotals = paymentRows.reduce(
    (sum, row) => sum + Number(row.amount_total || 0),
    0
  )
  const paymentCount = paymentRows.reduce(
    (sum, row) => sum + Number(row.payment_count || 0),
    0
  )

  const lowStockProducts = inventory?.low_stock_products || []

  const stats = overview
    ? [
        {
          title: "Revenue",
          value: money(overview.total_revenue),
          icon: IndianRupee,
          hint: overview.revenue_definition,
        },
        {
          title: "Orders",
          value: overview.total_orders,
          icon: ShoppingCart,
          hint: `${overview.start_date} → ${overview.end_date}`,
        },
        {
          title: "Customers",
          value: overview.total_customers,
          icon: Users,
          hint: "Registered customers",
        },
        {
          title: "Low Stock",
          value: overview.low_stock_products,
          icon: AlertTriangle,
          hint: `${overview.active_products} active · ${overview.total_products} total products`,
        },
      ]
    : []

  return (
    <section>
      <div style={{ marginBottom: 16 }}>
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            letterSpacing: "-0.4px",
          }}
        >
          Reports
        </h2>
        <p
          style={{
            color: "var(--text-muted)",
            marginTop: 4,
            fontSize: "0.9rem",
          }}
        >
          Sales, orders, payments and inventory insights
          {overview && (
            <span style={{ marginLeft: 8 }}>
              {overview.start_date} → {overview.end_date}
            </span>
          )}
        </p>
      </div>

      <form
        onSubmit={applyFilters}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          marginBottom: 20,
          padding: "14px 16px",
          background: "var(--bg)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md, 12px)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Start date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            End date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Low stock threshold
          </label>
          <input
            type="number"
            min="0"
            max="10000"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            style={{ ...inputStyle, width: 110 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {presetRanges.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => applyPreset(preset.start, toISODate(new Date()))}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => applyPreset("", "")}
          >
            Default (30d)
          </button>
        </div>

        <button type="submit" className="btn btn-primary btn-sm">
          {loading ? "Loading..." : "Apply"}
        </button>
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !overview ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="p-5">
                <div className="admin-loading-spinner" />
              </Card>
            ))}
          </>
        ) : (
          stats.map((stat) => <StatCard key={stat.title} {...stat} />)
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Sales Revenue</CardTitle>
            <CardDescription>
              Paid orders per day (cancelled orders excluded)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {loading && !sales ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading chart...
                </p>
              ) : chartData.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No sales in this period.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="reportSalesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={CHART.primary} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke={CHART.grid}
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: CHART.tick }}
                      interval="preserveStartEnd"
                      minTickGap={28}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12, fill: CHART.tick }}
                      tickFormatter={compactMoney}
                      width={72}
                    />
                    <Tooltip
                      cursor={{ stroke: CHART.tooltipBorder }}
                      formatter={(value, name) =>
                        name === "payments"
                          ? [`${value} payments`, "Payments"]
                          : [money(value), "Revenue"]
                      }
                      contentStyle={{
                        borderRadius: 10,
                        border: `1px solid ${CHART.tooltipBorder}`,
                        fontSize: 12,
                        boxShadow: "0 4px 16px rgba(26, 26, 46, 0.08)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke={CHART.primary}
                      strokeWidth={2.5}
                      fill="url(#reportSalesFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order Statuses</CardTitle>
            <CardDescription>Orders placed in this period</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && !overview ? (
              <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                Loading chart...
              </p>
            ) : statusTotal === 0 ? (
              <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
                No orders in this period.
              </p>
            ) : (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius="62%"
                      outerRadius="100%"
                      paddingAngle={2}
                      stroke="none"
                    >
                      {statusData.map((row) => (
                        <Cell key={row.status} fill={row.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value} orders`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            <ul className="mt-4 space-y-2">
              {statusData.map((row) => (
                <li
                  key={row.status}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.label}
                  </span>
                  <span className="font-medium tabular-nums text-muted-foreground">
                    {row.value}
                    {statusTotal
                      ? ` · ${Math.round((row.value / statusTotal) * 100)}%`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>
                Best performers for the selected period
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading && topProducts.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                Loading products...
              </p>
            ) : topProducts.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No sales in this period.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Gross Value</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product, index) => (
                    <TableRow key={product.product_id}>
                      <TableCell className="text-muted-foreground">
                        {index + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.product_name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {product.quantity_sold}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money(product.item_gross_value)}
                      </TableCell>
                      <TableCell className="text-right">
                        <StockBadge stock={product.current_stock} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Payments Breakdown</CardTitle>
              <CardDescription>
                {paymentCount} payment{paymentCount === 1 ? "" : "s"} ·{" "}
                {moneyExact(paymentTotals)}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !payments ? (
              <p className="py-6 text-sm text-muted-foreground">
                Loading payments...
              </p>
            ) : paymentRows.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No payments in this period.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentRows.map((row) => (
                    <TableRow key={`${row.method}-${row.status}`}>
                      <TableCell className="font-medium uppercase">
                        {row.method}
                      </TableCell>
                      <TableCell>
                        <span
                          className="status-badge"
                          style={{
                            background: `${
                              PAYMENT_STATUS_COLORS[row.status] || "#8b8ba3"
                            }22`,
                            color: PAYMENT_STATUS_COLORS[row.status] || "#8b8ba3",
                          }}
                        >
                          <span
                            className="status-badge-dot"
                            style={{
                              background:
                                PAYMENT_STATUS_COLORS[row.status] || "#8b8ba3",
                            }}
                          />
                          {row.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.payment_count}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {moneyExact(row.amount_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Inventory Health</CardTitle>
            <CardDescription>
              Active products at or below threshold ({inventory?.threshold ?? threshold})
            </CardDescription>
          </div>
          {inventory && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge variant="success">
                {inventory.active_products} active
              </Badge>
              <Badge variant="warning">
                {inventory.low_stock_count} low stock
              </Badge>
              <Badge variant="destructive">
                {inventory.out_of_stock_products} out of stock
              </Badge>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {loading && !inventory ? (
            <p className="py-6 text-sm text-muted-foreground">
              Loading inventory...
            </p>
          ) : lowStockProducts.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              All active products are above the threshold. Nice!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockProducts.map((product) => (
                  <TableRow key={product.product_id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneyExact(product.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.stock}
                    </TableCell>
                    <TableCell className="text-right">
                      <StockBadge stock={product.stock} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {toast && (
        <div className={`admin-toast ${toast.type}`}>{toast.message}</div>
      )}
    </section>
  )
}

function StockBadge({ stock }) {
  if (stock === null || stock === undefined) return <span>—</span>
  if (stock <= 0) return <Badge variant="destructive">Out of stock</Badge>
  if (stock < 10) return <Badge variant="warning">Low · {stock}</Badge>
  return <Badge variant="success">In stock · {stock}</Badge>
}

const inputStyle = {
  padding: "7px 10px",
  borderRadius: "var(--radius-sm, 8px)",
  border: "1px solid var(--border-light)",
  fontSize: "0.875rem",
  background: "var(--bg)",
  color: "var(--text)",
}
