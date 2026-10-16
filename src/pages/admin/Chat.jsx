import { useEffect, useRef } from "react"
import { useAdminChat } from "../../context/AdminChatContext"
import { formatAiContent } from "../../utils/formatAiContent"

export default function AdminChat() {
  const {
    conversations,
    activeId,
    messages,
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
  } = useAdminChat()

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const visibleQueue = queue.filter((item) => item.conversation_id === activeId)

  useEffect(() => {
    ensureLoaded()
  }, [ensureLoaded])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, queue, sending])

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
    <div>
      <div className="admin-page-header">
        <div>
          <h1>AI Chat Assistant</h1>
          <p>Ask about orders, payments, and products in your store</p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleNewChatClick}
          disabled={creating}
        >
          {creating ? "Creating..." : "+ New Chat"}
        </button>
      </div>

      <div className="admin-chat-layout">
        <aside className="admin-chat-sidebar">
          <div className="admin-chat-sidebar-title">Conversations</div>
          <div className="admin-chat-conversation-list">
            {loadingConversations ? (
              <div className="admin-chat-sidebar-empty">
                <div className="admin-loading-spinner" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="admin-chat-sidebar-empty">
                <p>No conversations yet.</p>
                <p>Start a new chat to begin.</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`admin-chat-conversation-item${
                    conversation.id === activeId ? " active" : ""
                  }`}
                  onClick={() => setActiveId(conversation.id)}
                >
                  <div className="admin-chat-conversation-info">
                    <span className="admin-chat-conversation-title">
                      {conversation.title}
                    </span>
                    <span className="admin-chat-conversation-date">
                      {new Date(conversation.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <button
                    className="admin-chat-conversation-delete"
                    title="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(conversation.id)
                    }}
                  >
                    &#10005;
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="admin-chat-panel">
          {!activeId ? (
            <div className="admin-chat-empty">
              <div className="admin-empty-icon">&#128172;</div>
              <h2>How can I help?</h2>
              <p>
                Start a new chat or ask about orders, payments, and products in
                your store.
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleNewChatClick}
                disabled={creating}
              >
                {creating ? "Creating..." : "+ New Chat"}
              </button>
            </div>
          ) : (
            <>
              <div className="admin-chat-messages">
                {loadingMessages ? (
                  <div className="admin-chat-messages-loading">
                    <div className="admin-loading-spinner" />
                    <p>Loading messages...</p>
                  </div>
                ) : messages.length === 0 && visibleQueue.length === 0 ? (
                  <div className="admin-chat-messages-loading">
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
                <div ref={messagesEndRef} />
              </div>

              <form className="admin-chat-composer" onSubmit={handleSend}>
                <textarea
                  ref={textareaRef}
                  className="admin-chat-input"
                  rows={1}
                  placeholder={
                    sending
                      ? "AI is replying... your next message will be queued"
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
                >
                  {sending ? (visibleQueue.length > 0 ? `Queue (${visibleQueue.length})` : "...") : "Send"}
                </button>
              </form>
            </>
          )}
        </section>
      </div>

      {toast && (
        <div className={`admin-toast ${toast.type}`}>{toast.message}</div>
      )}
    </div>
  )
}
