import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  getProductsAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../api/products"
import {
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../api/categories"
import {
  getVariants,
  createVariant,
  updateVariant,
  deleteVariant,
} from "../api/productVariants"
import { queryKeys } from "../api/queryKeys"

export function useAdminProducts({ page = 1, limit = 10 } = {}) {
  return useQuery({
    queryKey: queryKeys.products.adminList({ page, limit }),
    queryFn: () => getProductsAdmin({ page, limit }),
    placeholderData: keepPreviousData,
    // products -> 5 min / 30 min (mutations invalidate on edit)
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })
}

export function useAllCategories() {
  return useQuery({
    queryKey: queryKeys.categories.adminAll(),
    queryFn: getAllCategories,
    // categories -> 10 min / 30 min (mutations invalidate on edit)
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })
}

export function useVariants(productId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.variants.byProduct(productId),
    queryFn: () => getVariants(productId),
    enabled: enabled && Boolean(productId),
    // variants -> 5 min / 30 min (mutations + websocket stock patches)
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })
}

async function loadCatalogData() {
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

  const productMap = {}
  const variantMap = {}
  for (const product of all) productMap[product.id] = product
  for (const variant of variantLists.flat()) variantMap[variant.id] = variant

  return { products: all, productMap, variantMap }
}

export function useInventoryCatalog() {
  return useQuery({
    queryKey: queryKeys.products.catalog(),
    queryFn: loadCatalogData,
    // products domain -> 5 min / 30 min (websocket invalidates on stock change)
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData) => createProduct(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ categorySlug, productSlug, formData }) =>
      updateProduct(categorySlug, productSlug, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ categorySlug, productSlug }) =>
      deleteProduct(categorySlug, productSlug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.variants.all })
    },
  })
}

export function useCreateVariant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, payload }) =>
      createVariant(productId, payload),
    onSuccess: (_data, { productId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.variants.byProduct(productId),
      })
      // Variant stock changes roll up into the product stock
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

export function useUpdateVariant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, variantId, payload }) =>
      updateVariant(productId, variantId, payload),
    onSuccess: (_data, { productId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.variants.byProduct(productId),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

export function useDeleteVariant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, variantId }) =>
      deleteVariant(productId, variantId),
    onSuccess: (_data, { productId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.variants.byProduct(productId),
      })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (formData) => createCategory(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ slug, formData }) => updateCategory(slug, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug) => deleteCategory(slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
    },
  })
}
