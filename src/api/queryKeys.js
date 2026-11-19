export const queryKeys = {
  products: {
    all: ["products"],
    adminLists: () => ["products", "admin"],
    adminList: (params) => ["products", "admin", params],
    byCategory: (slug) => ["products", "byCategory", slug],
    detail: (categorySlug, productSlug) => [
      "products",
      "detail",
      categorySlug,
      productSlug,
    ],
    catalog: () => ["products", "catalog"],
  },
  categories: {
    all: ["categories"],
    lists: () => ["categories", "list"],
    adminAll: () => ["categories", "adminAll"],
    detail: (slug) => ["categories", "detail", slug],
  },
  variants: {
    all: ["variants"],
    byProduct: (productId) => ["variants", "product", String(productId)],
  },
  inventory: {
    all: ["inventory"],
    lots: (params) => ["inventory", "lots", params],
    lot: (id) => ["inventory", "lot", String(id)],
  },
  orders: {
    all: ["orders"],
    lists: () => ["orders", "list"],
    detail: (id) => ["orders", "detail", String(id)],
  },
  payments: {
    all: ["payments"],
    lists: () => ["payments", "list"],
    detail: (id) => ["payments", "detail", String(id)],
  },
  refunds: {
    all: ["refunds"],
    lists: () => ["refunds", "list"],
  },
  users: {
    all: ["users"],
    lists: () => ["users", "list"],
  },
  reports: {
    all: ["reports"],
    overview: (params) => ["reports", "overview", params],
    sales: (params) => ["reports", "sales", params],
    topProducts: (params) => ["reports", "topProducts", params],
    payments: (params) => ["reports", "payments", params],
    inventory: (params) => ["reports", "inventory", params],
  },
  profile: {
    all: ["profile"],
  },
}
