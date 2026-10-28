import { useCallback, useEffect, useMemo, useState } from "react"
import {
  getInventoryLots,
  getInventoryLot,
  receiveInventoryLot,
} from "../../api/inventory_lot"
import { getProductsAdmin } from "../../api/products"
import { getVariants } from "../../api/productVariants"
import { getErrorMessage } from "../../api/client"
import { useAdminOrderSocket } from "../../context/AdminOrderSocketContext"

const PAGE_SIZE = 20

function formatDate(value) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function expiryStatus(value) {
  if (!value) {
    return { label: "No Expiry", bg: "#f1f5f9", text: "#475569" }
  }
  const diff = new Date(value).getTime() - Date.now()
  if (diff <= 0) {
    return { label: "Expired", bg: "#fee2e2", text: "#991b1b" }
  }
  if (diff <= 7 * 24 * 60 * 60 * 1000) {
    return { label: "Expiring Soon", bg: "#fef3c7", text: "#92400e" }
  }
  return { label: "Valid", bg: "#dcfce7", text: "#166534" }
}

const EMPTY_FORM = {
  lot_number: "",
  product_id: "",
  variant_id: "",
  quantity: "",
  expires_at: "",
}

export default function AdminInventoryLot() {
  const { subscribe } = useAdminOrderSocket()

  const [lots, setLots] = useState([])
  const [loading, setLoading] = useState(true)
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [search, setSearch] = useState("")
  const [toast, setToast] = useState(null)

  const [products, setProducts] = useState([])
  const [productMap, setProductMap] = useState({})
  const [variantMap, setVariantMap] = useState({})

  const [showReceive, setShowReceive] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  function showToast(message, type = "success") {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchLots = useCallback(async (nextSkip = 0) => {
    setLoading(true)
    try {
      const data = await getInventoryLots({
        skip: nextSkip,
        limit: PAGE_SIZE,
      })
      setLots(data)
      setHasMore(data.length === PAGE_SIZE)
    } catch (err) {
      setLots([])
      setHasMore(false)
      showToast(getErrorMessage(err), "error")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    try {
      const all = []
      for (let page = 1; page <= 5; page += 1) {
        const data = await getProductsAdmin({ page, limit: 100 })
        const items = Array.isArray(data) ? data : data?.items || []
        all.push(...items)
        const totalPages = Array.isArray(data)
          ? 1
          : Number(data?.total_pages ?? 1) || 1
        if (page >= totalPages || items.length === 0) break
      }

      const variantLists = await Promise.all(
        all.map(async (product) => {
          try {
            return await getVariants(product.id)
          } catch {
            return []
          }
        })
      )

      const pMap = {}
      const vMap = {}
      for (const product of all) pMap[product.id] = product
      for (const variant of variantLists.flat()) vMap[variant.id] = variant

      setProducts(all)
      setProductMap(pMap)
      setVariantMap(vMap)
    } catch {
      setProducts([])
    }
  }, [])

  useEffect(() => {
    fetchLots(0)
    loadCatalog()
  }, [fetchLots, loadCatalog])

  useEffect(() => {
    return subscribe((message) => {
      if (message?.type !== "inventory_updated") return
      fetchLots(skip)
    })
  }, [subscribe, fetchLots, skip])

  function ownerLabel(lot) {
    if (lot.variant_id) {
      const variant = variantMap[lot.variant_id]
      if (!variant) return `Variant #${lot.variant_id}`
      const product = productMap[variant.product_id]
      const variantName = [variant.size, variant.color]
        .filter(Boolean)
        .join(" / ")
      return `${product ? product.name : `Product #${variant.product_id}`}${
        variantName ? ` (${variantName})` : ""
      }`
    }
    const product = productMap[lot.product_id]
    return product ? product.name : `Product #${lot.product_id}`
  }

  const filtered = lots.filter((lot) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      String(lot.id).includes(q) ||
      lot.lot_number?.toLowerCase().includes(q) ||
      ownerLabel(lot).toLowerCase().includes(q)
    )
  })

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === Number(form.product_id)) || null,
    [products, form.product_id]
  )

  const selectedProductVariants = useMemo(() => {
    if (!selectedProduct) return []
    return Object.values(variantMap).filter(
      (v) => v.product_id === selectedProduct.id
    )
  }, [variantMap, selectedProduct])

  function openReceive() {
    setForm(EMPTY_FORM)
    setFormError("")
    setShowReceive(true)
  }

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function handleReceive(e) {
    e.preventDefault()
    setFormError("")

    const lotNumber = form.lot_number.trim()
    const quantity = Number(form.quantity)

    if (!lotNumber) {
      setFormError("Lot number is required.")
      return
    }
    if (!form.product_id) {
      setFormError("Select a product.")
      return
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setFormError("Quantity must be a whole number greater than 0.")
      return
    }

    const payload = {
      lot_number: lotNumber,
      quantity,
      expires_at: form.expires_at
        ? new Date(form.expires_at).toISOString()
        : null,
    }

    const hasVariants = selectedProductVariants.length > 0

    if (hasVariants) {
      if (!form.variant_id) {
        setFormError("This product uses variants. Select a variant.")
        return
      }
      payload.variant_id = Number(form.variant_id)
    } else {
      payload.product_id = Number(form.product_id)
    }

    setSaving(true)
    try {
      await receiveInventoryLot(payload)
      setShowReceive(false)
      setForm(EMPTY_FORM)
      showToast(
        `Lot "${lotNumber}" received · ${quantity} unit${
          quantity === 1 ? "" : "s"
        } added to stock`
      )
      fetchLots(skip)
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function openDetail(lot) {
    setDetail(lot)
    setDetailLoading(true)
    try {
      const fresh = await getInventoryLot(lot.id)
      setDetail(fresh)
    } catch (err) {
      showToast(getErrorMessage(err), "error")
    } finally {
      setDetailLoading(false)
    }
  }

  function goToPrev() {
    const next = Math.max(0, skip - PAGE_SIZE)
    setSkip(next)
    fetchLots(next)
  }

  function goToNext() {
    const next = skip + PAGE_SIZE
    setSkip(next)
    fetchLots(next)
  }

  const detailStatus = detail ? expiryStatus(detail.expires_at) : null

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <h1>Inventory Lots</h1>
          <p>Track stock batches and receive new inventory against products</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openReceive}>
          + Receive Stock
        </button>
      </div>

      <div className="admin-table-wrapper">
        <div className="admin-table-header">
          <h2>
            All Lots ({filtered.length})
            {skip > 0 && (
              <span
                style={{
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  marginLeft: 8,
                  fontSize: "0.85rem",
                }}
              >
                page {skip / PAGE_SIZE + 1}
              </span>
            )}
          </h2>
          <div className="admin-table-search">
            <span className="search-icon">&#128269;</span>
            <input
              type="text"
              placeholder="Search by lot number, ID, product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="admin-table-empty">
            <div className="admin-loading-spinner" />
            <p>Loading inventory lots...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="admin-table-empty">
            <div className="admin-empty-icon">&#128230;</div>
            <p>
              {search
                ? "No lots match your search."
                : "No inventory lots yet. Receive stock to create the first lot."}
            </p>
          </div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Lot</th>
                  <th>Product / Variant</th>
                  <th>Received</th>
                  <th>Remaining</th>
                  <th>Expiry</th>
                  <th>Received At</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lot) => {
                  const status = expiryStatus(lot.expires_at)
                  const depleted = lot.quantity_remaining === 0
                  const remainingPct = lot.quantity_received
                    ? Math.round(
                        (lot.quantity_remaining / lot.quantity_received) * 100
                      )
                    : 0
                  return (
                    <tr key={lot.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>#{lot.id}</div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                          }}
                        >
                          {lot.lot_number}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.875rem" }}>
                        {ownerLabel(lot)}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {lot.quantity_received}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {lot.quantity_remaining}
                          <span
                            style={{
                              fontWeight: 500,
                              color: "var(--text-muted)",
                              fontSize: "0.8rem",
                              marginLeft: 6,
                            }}
                          >
                            ({remainingPct}%)
                          </span>
                        </div>
                        {depleted && (
                          <span
                            style={{
                              display: "inline-block",
                              marginTop: 4,
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              background: "#f1f5f9",
                              color: "#475569",
                            }}
                          >
                            Depleted
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 12px",
                            borderRadius: 999,
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            background: status.bg,
                            color: status.text,
                          }}
                        >
                          {status.label}
                        </span>
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            marginTop: 4,
                          }}
                        >
                          {formatDate(lot.expires_at)}
                        </div>
                      </td>
                      <td style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                        {formatDate(lot.received_at)}
                      </td>
                      <td>
                        <div
                          className="admin-actions"
                          style={{ justifyContent: "flex-end" }}
                        >
                          <button
                            className="admin-action-btn"
                            title="View Lot"
                            onClick={() => openDetail(lot)}
                          >
                            &#128065;
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {(skip > 0 || hasMore) && !loading && (
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "flex-end",
              padding: "12px 20px",
              borderTop: "1px solid var(--border-light)",
            }}
          >
            <button
              className="btn btn-outline btn-sm"
              onClick={goToPrev}
              disabled={skip === 0}
            >
              Previous
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={goToNext}
              disabled={!hasMore}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showReceive && (
        <div
          className="admin-modal-overlay"
          onClick={() => !saving && setShowReceive(false)}
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Receive Stock</h2>
              <button
                className="admin-modal-close"
                onClick={() => setShowReceive(false)}
                disabled={saving}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleReceive}>
              <div className="admin-modal-body">
                {formError && <div className="alert alert-error">{formError}</div>}

                <div className="admin-form-group">
                  <label htmlFor="lot-number">Lot Number *</label>
                  <input
                    id="lot-number"
                    name="lot_number"
                    type="text"
                    placeholder="e.g. LOT-2026-001"
                    value={form.lot_number}
                    onChange={handleFormChange}
                    maxLength={100}
                    required
                    disabled={saving}
                  />
                </div>

                <div className="admin-form-group">
                  <label htmlFor="lot-product">Product *</label>
                  <select
                    id="lot-product"
                    name="product_id"
                    value={form.product_id}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        product_id: e.target.value,
                        variant_id: "",
                      }))
                    }
                    required
                    disabled={saving}
                  >
                    <option value="">Select a product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedProduct && selectedProductVariants.length > 0 && (
                  <div className="admin-form-group">
                    <label htmlFor="lot-variant">Variant *</label>
                    <select
                      id="lot-variant"
                      name="variant_id"
                      value={form.variant_id}
                      onChange={handleFormChange}
                      required
                      disabled={saving}
                    >
                      <option value="">Select a variant</option>
                      {selectedProductVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {[variant.size, variant.color]
                            .filter(Boolean)
                            .join(" / ") || variant.sku}
                          {variant.stock !== undefined
                            ? ` — stock ${variant.stock}`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <p
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        marginTop: 6,
                      }}
                    >
                      This product uses variants, so stock is received against a
                      specific variant.
                    </p>
                  </div>
                )}

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label htmlFor="lot-quantity">Quantity *</label>
                    <input
                      id="lot-quantity"
                      name="quantity"
                      type="number"
                      min={1}
                      step={1}
                      placeholder="e.g. 100"
                      value={form.quantity}
                      onChange={handleFormChange}
                      required
                      disabled={saving}
                    />
                  </div>

                  <div className="admin-form-group">
                    <label htmlFor="lot-expires">Expiry (optional)</label>
                    <input
                      id="lot-expires"
                      name="expires_at"
                      type="datetime-local"
                      value={form.expires_at}
                      onChange={handleFormChange}
                      disabled={saving}
                    />
                  </div>
                </div>

                <p
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    lineHeight: 1.6,
                    marginTop: 4,
                  }}
                >
                  Receiving stock creates a new lot and increases the product's
                  available stock. Orders consume lots first-in-first-out by
                  expiry.
                </p>
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowReceive(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? "Receiving..." : "Receive Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div
          className="admin-modal-overlay"
          onClick={() => !detailLoading && setDetail(null)}
        >
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Lot #{detail.id}</h2>
              <button
                className="admin-modal-close"
                onClick={() => setDetail(null)}
                disabled={detailLoading}
              >
                &times;
              </button>
            </div>

            <div className="admin-modal-body">
              {detailLoading ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                    padding: "24px 0",
                  }}
                >
                  <div className="admin-loading-spinner" />
                  <p style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
                    Loading lot...
                  </p>
                </div>
              ) : (
                <div className="profile-fields">
                  <div className="profile-field">
                    <span className="profile-field-label">Lot Number</span>
                    <span
                      className="profile-field-value"
                      style={{ fontFamily: "monospace" }}
                    >
                      {detail.lot_number}
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field-label">Status</span>
                    <span className="profile-field-value">
                      <span
                        style={{
                          display: "inline-block",
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: detailStatus.bg,
                          color: detailStatus.text,
                        }}
                      >
                        {detailStatus.label}
                      </span>
                    </span>
                  </div>
                  <div className="profile-field" style={{ gridColumn: "1 / -1" }}>
                    <span className="profile-field-label">Product / Variant</span>
                    <span className="profile-field-value">
                      {ownerLabel(detail)}
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field-label">Received Qty</span>
                    <span className="profile-field-value">
                      {detail.quantity_received}
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field-label">Remaining Qty</span>
                    <span className="profile-field-value">
                      {detail.quantity_remaining}
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field-label">Expiry</span>
                    <span className="profile-field-value">
                      {formatDate(detail.expires_at)}
                    </span>
                  </div>
                  <div className="profile-field">
                    <span className="profile-field-label">Received At</span>
                    <span className="profile-field-value">
                      {formatDate(detail.received_at)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => setDetail(null)}
                disabled={detailLoading}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.type === "success" ? "&#10003; " : "&#9888; "}
          {toast.message}
        </div>
      )}
    </div>
  )
}
