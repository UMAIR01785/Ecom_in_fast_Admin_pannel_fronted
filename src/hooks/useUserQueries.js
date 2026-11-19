import { useQuery } from "@tanstack/react-query"
import { getAllUsers } from "../api/adminUsers"
import { queryKeys } from "../api/queryKeys"

export function useAllUsers() {
  return useQuery({
    queryKey: queryKeys.users.lists(),
    queryFn: getAllUsers,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  })
}
