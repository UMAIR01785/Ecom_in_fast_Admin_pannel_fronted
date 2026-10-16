import api from "./client"

export async function getAllUsers() {
  const res = await api.get("/admin/users/")
  return res.data
}
