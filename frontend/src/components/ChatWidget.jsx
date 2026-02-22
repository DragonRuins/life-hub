/**
 * ChatWidget.jsx - Catppuccin-themed floating AI chat popup
 *
 * Bottom-right floating chat interface with:
 *   - Circular trigger button with MessageSquare icon
 *   - Popup panel with messages, input, thread list
 *   - SSE streaming with tool use indicators
 *   - Thread management (list, switch, delete, rename)
 *
 * Uses the shared useChat hook for all state/logic.
 */
import { useState, useEffect, useRef } from 'react'
import { MessageSquare, Plus, List, X, Send, Trash2, Square, Loader2 } from 'lucide-react'
import useIsMobile from '../hooks/useIsMobile'
import { formatDate } from '../utils/formatDate'
import ChatMarkdown from './ChatMarkdown'

export default function ChatWidget({ chat }) {
  const {
    conversations, activeConversation, isStreaming, streamingText,
    toolStatus, isOpen, error, showThreadList,
    toggle, loadConversations, selectConversation,
    startNewConversation, sendMessage, deleteConversation,
    renameConversation, stopStreaming, setError, setShowThreadList,
  } = chat

  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const isMobile = useIsMobile()

  // Load conversations when panel opens
  useEffect(() => {
    if (isOpen) {
      loadConversations()
    }
  }, [isOpen, loadConversations])

  // Auto-scroll to bottom when messages change or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages, streamingText])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !showThreadList) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, showThreadList])

  function handleSend() {
    if (!input.trim() || isStreaming) return
    sendMessage(input.trim())
    setInput('')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const messages = activeConversation?.messages || []

  return (
    <>
      {/* ── Floating Chat Button ──────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={toggle}
          title="AI Assistant"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'var(--color-blue)',
            border: 'none',
            color: 'var(--color-crust)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            zIndex: 1100,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08)'
            e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.4)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)'
          }}
        >
          <MessageSquare size={22} />
        </button>
      )}

      {/* ── Chat Panel ────────────────────────────────────────── */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? '0' : '1.5rem',
            right: isMobile ? '0' : '1.5rem',
            width: isMobile ? '100%' : 'min(420px, calc(100vw - 2rem))',
            height: isMobile ? '100dvh' : 'min(600px, calc(100dvh - 3rem))',
            background: 'var(--color-base)',
            border: isMobile ? 'none' : '1px solid var(--color-surface-0)',
            borderRadius: isMobile ? '0' : '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* ── Header ──────────────────────────────────────── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0.625rem 0.75rem',
            borderBottom: '1px solid var(--color-surface-0)',
            background: 'var(--color-mantle)',
            gap: '0.5rem',
            flexShrink: 0,
          }}>
            <MessageSquare size={16} style={{ color: 'var(--color-blue)', flexShrink: 0 }} />
            <span style={{
              flex: 1,
              fontWeight: 600,
              fontSize: '0.9rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {activeConversation?.title || 'AI Assistant'}
            </span>

            {/* New Chat */}
            <HeaderButton
              icon={<Plus size={16} />}
              title="New Chat"
              onClick={startNewConversation}
            />

            {/* Thread List Toggle */}
            <HeaderButton
              icon={<List size={16} />}
              title="Conversations"
              onClick={() => setShowThreadList(!showThreadList)}
              active={showThreadList}
            />

            {/* Close */}
            <HeaderButton
              icon={<X size={16} />}
              title="Close"
              onClick={toggle}
            />
          </div>

          {/* ── Thread List Overlay ─────────────────────────── */}
          {showThreadList && (
            <div style={{
              flex: 1,
              overflowY: 'auto',
              background: 'var(--color-mantle)',
            }}>
              {conversations.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'var(--color-subtext-0)',
                  fontSize: '0.85rem',
                }}>
                  No conversations yet
                </div>
              ) : (
                conversations.map(conv => (
                  <ThreadItem
                    key={conv.id}
                    conversation={conv}
                    isActive={activeConversation?.id === conv.id}
                    onSelect={() => selectConversation(conv.id)}
                    onDelete={() => deleteConversation(conv.id)}
                  />
                ))
              )}
            </div>
          )}

          {/* ── Messages Area ──────────────────────────────── */}
          {!showThreadList && (
            <>
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}>
                {messages.length === 0 && !isStreaming && (
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-subtext-0)',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                    padding: '2rem',
                  }}>
                    Ask me anything about your data — vehicles, notes, projects, and more.
                  </div>
                )}

                {messages.map((msg, i) => (
                  <MessageBubble key={msg.id || i} message={msg} />
                ))}

                {/* Streaming response */}
                {isStreaming && (
                  <div style={{
                    alignSelf: 'flex-start',
                    maxWidth: '85%',
                  }}>
                    {toolStatus && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.625rem',
                        marginBottom: '0.375rem',
                        fontSize: '0.75rem',
                        color: 'var(--color-blue)',
                        background: 'rgba(137, 180, 250, 0.08)',
                        borderRadius: '8px',
                      }}>
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        {toolStatus}
                      </div>
                    )}
                    {streamingText && (
                      <div style={{
                        background: 'var(--color-surface-0)',
                        borderRadius: '12px 12px 12px 4px',
                        padding: '0.625rem 0.75rem',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                      }}>
                        <ChatMarkdown content={streamingText} />
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '14px',
                          background: 'var(--color-blue)',
                          borderRadius: '1px',
                          marginLeft: '2px',
                          animation: 'blink 1s step-end infinite',
                          verticalAlign: 'text-bottom',
                        }} />
                      </div>
                    )}
                    {!streamingText && !toolStatus && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.625rem 0.75rem',
                        fontSize: '0.75rem',
                        color: 'var(--color-subtext-0)',
                      }}>
                        <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                        Thinking...
                      </div>
                    )}
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(243, 139, 168, 0.1)',
                    border: '1px solid rgba(243, 139, 168, 0.3)',
                    borderRadius: '8px',
                    color: 'var(--color-red)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <span>{error}</span>
                    <button
                      onClick={() => setError(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-red)',
                        cursor: 'pointer',
                        padding: '2px',
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* ── Input Area ──────────────────────────────── */}
              <div style={{
                padding: '0.625rem 0.75rem',
                paddingBottom: isMobile ? 'calc(0.625rem + env(safe-area-inset-bottom, 0px))' : '0.625rem',
                borderTop: '1px solid var(--color-surface-0)',
                background: 'var(--color-mantle)',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'flex-end',
                flexShrink: 0,
              }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your data..."
                  rows={1}
                  style={{
                    flex: 1,
                    resize: 'none',
                    background: 'var(--color-surface-0)',
                    border: '1px solid var(--color-surface-1)',
                    borderRadius: '10px',
                    padding: '0.5rem 0.75rem',
                    color: 'var(--color-text)',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    lineHeight: 1.4,
                    maxHeight: '120px',
                    outline: 'none',
                    transition: 'border-color 0.15s ease',
                  }}
                  onInput={e => {
                    // Auto-grow textarea
                    e.target.style.height = 'auto'
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--color-blue)'}
                  onBlur={e => e.target.style.borderColor = 'var(--color-surface-1)'}
                />

                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    title="Stop"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'var(--color-red)',
                      border: 'none',
                      color: 'var(--color-crust)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Square size={14} />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    title="Send (Enter)"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: input.trim() ? 'var(--color-blue)' : 'var(--color-surface-1)',
                      border: 'none',
                      color: input.trim() ? 'var(--color-crust)' : 'var(--color-overlay-0)',
                      cursor: input.trim() ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <Send size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Animations (injected once) ─────────────────────── */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}


/**
 * Individual message bubble.
 * User messages: right-aligned, blue background.
 * Assistant messages: left-aligned, surface background, rendered as markdown.
 */
function MessageBubble({ message }) {
  const isUser = message.role === 'user'

  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
    }}>
      <div style={{
        background: isUser ? 'var(--color-blue)' : 'var(--color-surface-0)',
        color: isUser ? 'var(--color-crust)' : 'var(--color-text)',
        borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        padding: '0.625rem 0.75rem',
        fontSize: '0.85rem',
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>
        {isUser ? (
          message.content
        ) : (
          <ChatMarkdown content={message.content} />
        )}
      </div>
    </div>
  )
}


/**
 * Thread list item showing conversation title, date, and delete button.
 */
function ThreadItem({ conversation, isActive, onSelect, onDelete }) {
  const date = conversation.updated_at
    ? formatDate(conversation.updated_at)
    : ''

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.625rem 0.75rem',
        cursor: 'pointer',
        borderBottom: '1px solid var(--color-surface-0)',
        background: isActive ? 'rgba(137, 180, 250, 0.08)' : 'transparent',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.04)'
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.background = 'transparent'
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.85rem',
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'var(--color-blue)' : 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {conversation.title || 'Untitled'}
        </div>
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--color-subtext-0)',
          marginTop: '2px',
        }}>
          {date} · {conversation.message_count || 0} messages
        </div>
      </div>

      <button
        onClick={e => {
          e.stopPropagation()
          onDelete()
        }}
        title="Delete"
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-overlay-0)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--color-red)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--color-overlay-0)'}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}


/**
 * Small header button used in the chat panel header bar.
 */
function HeaderButton({ icon, title, onClick, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        background: active ? 'rgba(137, 180, 250, 0.1)' : 'transparent',
        border: 'none',
        color: active ? 'var(--color-blue)' : 'var(--color-subtext-0)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'all 0.1s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.1)'}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {icon}
    </button>
  )
}
