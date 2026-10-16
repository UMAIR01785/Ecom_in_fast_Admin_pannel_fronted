import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Maximize2, MessageSquare, Plus, Send, X } from "lucide-react"
import { useAdminChat } from "../../context/AdminChatContext"
import { formatAiContent } from "../../utils/formatAiContent"

export default function FloatingChatWidget() {
  const {
    activeId,
    messages,
    input,
    setInput,
    loadingMessages,
    sending,
    sendingConvId,
    creating,
    queue,
    toast,
    ensureLoaded,
    enqueue,
    handleNewChat,
  } = useAdminChat()

  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const onChatPage = location.pathname === "/chat"
  const visibleQueue = queue.filter((item) => item.conversation_id === activeId)

  useEffect(() => {
    if (open) ensureLoaded()
  }, [open, ensureLoaded])

  useEffect(() => {
    if (!open) return undefined
    const timer = setTimeout(() => textareaRef.current?.focus(), 60)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [open, messages, queue, sending])

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  async function handleNewChatClick() {
    const created = await handleNewChat()
    if (created) textareaRef.current?.focus()
  }

  function handleSend(e) {
    e.preventDefault()
    const content = input.trim()
    if (!content) return
    enqueue(content)
    textareaRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div className="admin-float-chat">
      {open && (
        <div
          className="admin-float-panel"
          role="dialog"
          aria-label="AI chat assistant"
        >
          <div className="admin-float-header">
            <div className="admin-float-header-info">
              <span className="admin-float-header-avatar">
                <MessageSquare size={16} />
              </span>
              <div className="admin-float-header-text">
                <strong>AI Assistant</strong>
                <span>Ask about orders, payments &amp; products</span>
              </div>
            </div>
            <div className="admin-float-header-actions">
              <button
                type="button"
                onClick={handleNewChatClick}
                disabled={creating}
                title="New chat"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  navigate("/chat")
                }}
                title="Open full page"
              >
                <Maximize2 size={14} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="admin-float-messages">
            {!activeId ? (
              <div className="admin-float-empty">
                <div className="admin-empty-icon">&#128172;</div>
                <p>Start a chat to ask about your store.</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleNewChatClick}
                  disabled={creating}
                >
                  {creating ? "Creating..." : "+ New Chat"}
                </button>
              </div>
            ) : loadingMessages ? (
              <div className="admin-float-empty">
                <div className="admin-loading-spinner" />
                <p>Loading messages...</p>
              </div>
            ) : (
              <>
                {messages.length === 0 && visibleQueue.length === 0 ? (
                  <div className="admin-float-empty">
                    <div className="admin-empty-icon">&#128172;</div>
                    <p>Send a message to start the conversation.</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`admin-chat-bubble-row ${message.role}`}
                    >
                      <div className="admin-chat-bubble-avatar">
                        {message.role === "user" ? "A" : "AI"}
                      </div>
                      <div className="admin-chat-bubble">
                        <div className="admin-chat-bubble-meta">
                          <span>
                            {message.role === "user" ? "You" : "Assistant"}
                          </span>
                          <span>
                            {new Date(message.created_at).toLocaleTimeString(
                              "en-US",
                              { hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        </div>
                        <div className="admin-chat-bubble-content">
                          {message.role === "assistant"
                            ? formatAiContent(message.content)
                            : message.content}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {visibleQueue.map((item) => (
                  <div key={item.id} className="admin-chat-bubble-row user">
                    <div className="admin-chat-bubble-avatar">A</div>
                    <div className="admin-chat-bubble">
                      <div className="admin-chat-bubble-meta">
                        <span>You</span>
                        <span>Queued</span>
                      </div>
                      <div className="admin-chat-bubble-content">
                        {item.content}
                      </div>
                    </div>
                  </div>
                ))}

                {sending && sendingConvId === activeId && (
                  <div className="admin-chat-bubble-row assistant">
                    <div className="admin-chat-bubble-avatar">AI</div>
                    <div className="admin-chat-bubble">
                      <div className="admin-chat-bubble-meta">
                        <span>Assistant</span>
                      </div>
                      <div className="admin-chat-typing">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form className="admin-float-composer" onSubmit={handleSend}>
            <textarea
              ref={textareaRef}
              className="admin-chat-input"
              rows={1}
              placeholder={
                sending
                  ? "AI is replying... your message will be queued"
                  : "Ask about orders, payments, products..."
              }
              maxLength={10000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm admin-chat-send"
              disabled={!input.trim()}
              title="Send"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className={`admin-float-fab${open ? " open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close AI chat" : "Open AI chat"}
        aria-expanded={open}
        title="Chat with AI"
      >
        {open ? <X size={24} /> : <MessageSquare size={24} />}
        {!open && (sending || queue.length > 0) && (
          <span
            className={`admin-float-badge${queue.length > 0 ? "" : " pulse"}`}
            title={
              queue.length > 0
                ? `${queue.length} message(s) queued`
                : "AI is replying"
            }
          >
            {queue.length > 0 ? queue.length : ""}
          </span>
        )}
      </button>

      {open && !onChatPage && toast && (
        <div className={`admin-toast ${toast.type}`}>{toast.message}</div>
      )}
    </div>
  )
}
