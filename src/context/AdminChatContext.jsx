import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  sendMessage,
} from "../api/adminChat"
import { getErrorMessage } from "../api/client"

const ACTIVE_CHAT_KEY = "ecom_admin_active_chat"
const EMPTY_MESSAGES = []

const AdminChatContext = createContext(null)

export function AdminChatProvider({ children }) {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveIdState] = useState(() => {
    const saved = localStorage.getItem(ACTIVE_CHAT_KEY)
    return saved ? Number(saved) : null
  })
  const [messagesByConv, setMessagesByConv] = useState({})
  const [input, setInput] = useState("")
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendingConvId, setSendingConvId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [queue, setQueue] = useState([])
  const [toast, setToast] = useState(null)

  const loadedRef = useRef(false)
  const queueRef = useRef([])
  const processingRef = useRef(false)
  const activeIdRef = useRef(activeId)

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const setActiveId = useCallback((id) => {
    activeIdRef.current = id
    setActiveIdState(id)
    if (id) localStorage.setItem(ACTIVE_CHAT_KEY, String(id))
    else localStorage.removeItem(ACTIVE_CHAT_KEY)
  }, [])

  const appendMessage = useCallback((convId, message) => {
    setMessagesByConv((prev) => ({
      ...prev,
      [convId]: [...(prev[convId] || []), message],
    }))
  }, [])

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return
    loadedRef.current = true
    try {
      const data = await listConversations()
      setConversations(data)
      const saved = activeIdRef.current
      const stillExists = saved && data.some((c) => c.id === saved)
      if (!stillExists) setActiveId(data[0]?.id ?? null)
    } catch (err) {
      loadedRef.current = false
      showToast(getErrorMessage(err), "error")
    } finally {
      setLoadingConversations(false)
    }
  }, [setActiveId, showToast])

  useEffect(() => {
    if (loadingConversations) return undefined
    if (!activeId) return undefined
    if (messagesByConv[activeId]) return undefined
    let cancelled = false
    setLoadingMessages(true)
    getMessages(activeId)
      .then((data) => {
        if (!cancelled)
          setMessagesByConv((prev) => ({ ...prev, [activeId]: data }))
      })
      .catch((err) => {
        if (!cancelled) showToast(getErrorMessage(err), "error")
      })
      .finally(() => {
        if (!cancelled) setLoadingMessages(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeId, messagesByConv, loadingConversations, showToast])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true
    setSending(true)

    const dequeue = () => {
      queueRef.current = queueRef.current.slice(1)
      setQueue(queueRef.current)
    }

    try {
      while (queueRef.current.length > 0) {
        const item = queueRef.current[0]
        let convId = item.conversation_id

        if (!convId) {
          try {
            const conversation = await createConversation(
              item.content.slice(0, 160)
            )
            convId = conversation.id
            queueRef.current = queueRef.current.map((q) =>
              q.conversation_id ? q : { ...q, conversation_id: convId }
            )
            setQueue(queueRef.current)
            setConversations((prev) => [
              conversation,
              ...prev.filter((c) => c.id !== conversation.id),
            ])
            setActiveId(conversation.id)
            setMessagesByConv((prev) => ({
              ...prev,
              [convId]: prev[convId] || [],
            }))
          } catch (err) {
            showToast(getErrorMessage(err), "error")
            dequeue()
            continue
          }
        }

        dequeue()
        appendMessage(convId, {
          id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conversation_id: convId,
          role: "user",
          content: item.content,
          created_at: item.created_at,
        })

        try {
          setSendingConvId(convId)
          const assistantMessage = await sendMessage(convId, item.content)
          appendMessage(convId, assistantMessage)
          setConversations((prev) => {
            const rest = prev.filter((c) => c.id !== convId)
            const active = prev.find((c) => c.id === convId)
            if (!active) return prev
            return [{ ...active, updated_at: new Date().toISOString() }, ...rest]
          })
        } catch (err) {
          showToast(getErrorMessage(err), "error")
          try {
            const data = await getMessages(convId)
            setMessagesByConv((prev) => ({ ...prev, [convId]: data }))
          } catch {
            // keep optimistic messages
          }
        }
      }
    } finally {
      processingRef.current = false
      setSendingConvId(null)
      setSending(false)
    }
  }, [appendMessage, setActiveId, showToast])

  const enqueue = useCallback(
    (content) => {
      const trimmed = content.trim()
      if (!trimmed) return
      queueRef.current = [
        ...queueRef.current,
        {
          id: `queue-${Date.now()}-${queueRef.current.length}`,
          conversation_id: activeIdRef.current,
          content: trimmed,
          created_at: new Date().toISOString(),
        },
      ]
      setQueue(queueRef.current)
      setInput("")
      processQueue()
    },
    [processQueue]
  )

  const handleNewChat = useCallback(async () => {
    if (creating) return false
    setCreating(true)
    try {
      const conversation = await createConversation("New chat")
      setConversations((prev) => [
        conversation,
        ...prev.filter((c) => c.id !== conversation.id),
      ])
      setMessagesByConv((prev) => ({
        ...prev,
        [conversation.id]: prev[conversation.id] || [],
      }))
      setActiveId(conversation.id)
      setInput("")
      return true
    } catch (err) {
      showToast(getErrorMessage(err), "error")
      return false
    } finally {
      setCreating(false)
    }
  }, [creating, setActiveId, showToast])

  const handleDelete = useCallback(
    async (conversationId) => {
      try {
        await deleteConversation(conversationId)
        setConversations((prev) => prev.filter((c) => c.id !== conversationId))
        queueRef.current = queueRef.current.filter(
          (q) => q.conversation_id !== conversationId
        )
        setQueue(queueRef.current)
        setMessagesByConv((prev) => {
          const next = { ...prev }
          delete next[conversationId]
          return next
        })
        if (activeIdRef.current === conversationId) setActiveId(null)
        showToast("Conversation deleted", "success")
      } catch (err) {
        showToast(getErrorMessage(err), "error")
      }
    },
    [setActiveId, showToast]
  )

  const value = useMemo(
    () => ({
      conversations,
      activeId,
      messages: activeId ? messagesByConv[activeId] || EMPTY_MESSAGES : [],
      input,
      setInput,
      loadingConversations,
      loadingMessages,
      sending,
      sendingConvId,
      creating,
      queue,
      toast,
      ensureLoaded,
      setActiveId,
      enqueue,
      handleNewChat,
      handleDelete,
    }),
    [
      conversations,
      activeId,
      messagesByConv,
      input,
      loadingConversations,
      loadingMessages,
      sending,
      sendingConvId,
      creating,
      queue,
      toast,
      ensureLoaded,
      setActiveId,
      enqueue,
      handleNewChat,
      handleDelete,
    ]
  )

  return (
    <AdminChatContext.Provider value={value}>
      {children}
    </AdminChatContext.Provider>
  )
}

export function useAdminChat() {
  const context = useContext(AdminChatContext)
  if (!context)
    throw new Error("useAdminChat must be used within AdminChatProvider")
  return context
}
