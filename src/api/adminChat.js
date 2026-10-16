import api from "./client"

export async function createConversation(title = "New chat") {
  const res = await api.post("/admin/chat/conversations", { title })
  return res.data
}

export async function listConversations() {
  const res = await api.get("/admin/chat/conversations")
  return res.data
}

export async function getMessages(conversationId) {
  const res = await api.get(`/admin/chat/conversations/${conversationId}/messages`)
  return res.data
}

export async function sendMessage(conversationId, content) {
  const res = await api.post(`/admin/chat/conversations/${conversationId}/messages`, {
    content,
  })
  return res.data
}

export async function deleteConversation(conversationId) {
  await api.delete(`/admin/chat/conversations/${conversationId}`)
}
