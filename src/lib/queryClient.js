import { QueryClient } from "@tanstack/react-query"

// Retry policy:
// - 4xx client errors are never retried (except 408 timeout / 429 rate limit)
// - Network failures and 5xx server errors are retried up to 2 times
//   (3 attempts total) with exponential backoff + jitter.
function shouldRetry(failureCount, error) {
  if (failureCount >= 2) return false
  const status = error?.response?.status
  if (status && status >= 400 && status < 500) {
    return status === 408 || status === 429
  }
  return true
}

// Backoff: exponential with jitter, capped at 30s.
// On 429 the server's rate-limit reset time (Retry-After header) wins,
// capped at 60s so a bad header can't park a query forever.
function retryDelay(failureCount, error) {
  if (error?.response?.status === 429) {
    const retryAfter = error?.response?.headers?.["retry-after"]
    const seconds = Number(retryAfter)
    if (retryAfter && Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 60_000)
    }
  }
  const base = Math.min(1000 * 2 ** failureCount, 30_000)
  return base + Math.random() * 250
}

// Module-level singleton: created once, outside React, so it is never
// recreated during rendering and the cache survives route changes.
// Per-domain staleTime/gcTime policies live on the individual hooks.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: shouldRetry,
      retryDelay,
      // Only refetches on focus/reconnect when the data is actually stale,
      // so navigation within the staleTime window never re-hits the API.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      // Mutations are user-initiated writes — never auto-retry them.
      retry: false,
    },
  },
})
