/**
 * LCARSChatTerminal.jsx - LCARS-themed AI chat terminal popup
 *
 * Full LCARS terminal experience for the AI assistant.
 * Shares the useChat hook with ChatWidget for identical state/logic,
 * but uses LCARS visual language: Antonio font, pill buttons, elbows,
 * black background with colored borders, scan-line animations.
 */
import { useState, useEffect, useRef } from 'react'
import { Plus, List, X, Send, Trash2, Square, Loader2 } from 'lucide-react'
import useIsMobile from '../../hooks/useIsMobile'
import { formatDate } from '../../utils/formatDate'
import ChatMarkdown from '../../components/ChatMarkdown'

export default function LCARSChatTerminal({ chat }) {
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

  // Auto-scroll to bottom
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
  const antonio = "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif"

  if (!isOpen) return null

  return (
    <>
      {/* ── LCARS Terminal Panel ─────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          bottom: isMobile ? '0' : 'calc(36px + 0.75rem)',
          right: isMobile ? '0' : '1.5rem',
          width: isMobile ? '100%' : 'min(420px, calc(100vw - 2rem))',
          height: isMobile ? '100dvh' : 'min(600px, calc(100dvh - 36px - 1.5rem))',
          background: '#000000',
          border: isMobile ? 'none' : '2px solid var(--lcars-butterscotch)',
          borderRadius: isMobile ? '0' : '4px',
          boxShadow: '0 4px 24px rgba(255, 153, 0, 0.15)',
          zIndex: 1100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header Bar ────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0',
          background: 'var(--lcars-butterscotch)',
          flexShrink: 0,
          minHeight: '36px',
        }}>
          {/* Small decorative elbow */}
          <div style={{
            width: '12px',
            height: '100%',
            background: 'var(--lcars-rust)',
            borderRadius: '0 0 12px 0',
            flexShrink: 0,
          }} />

          <span style={{
            flex: 1,
            fontFamily: antonio,
            fontSize: '0.9rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: '#000000',
            padding: '0 0.5rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {activeConversation?.title || 'Computer Interface'}
          </span>

          {/* Header buttons */}
          <LCARSPillButton
            label="NEW"
            color="var(--lcars-ice)"
            onClick={startNewConversation}
          />
          <LCARSPillButton
            label="LOG"
            color={showThreadList ? 'var(--lcars-rust)' : 'var(--lcars-tanoi)'}
            onClick={() => setShowThreadList(!showThreadList)}
          />
          <LCARSPillButton
            label="END"
            color="var(--lcars-tomato)"
            onClick={toggle}
          />
        </div>

        {/* ── Thread List ───────────────────────────────────── */}
        {showThreadList && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
          }}>
            {conversations.length === 0 ? (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--lcars-gray)',
                fontFamily: antonio,
                fontSize: '0.85rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                No sessions logged
              </div>
            ) : (
              conversations.map(conv => (
                <LCARSThreadItem
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

        {/* ── Messages Area ─────────────────────────────────── */}
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
                  color: 'var(--lcars-gray)',
                  fontFamily: antonio,
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  padding: '2rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Ready for query input
                </div>
              )}

              {messages.map((msg, i) => (
                <LCARSMessageBubble key={msg.id || i} message={msg} />
              ))}

              {/* Streaming response */}
              {isStreaming && (
                <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                  {toolStatus && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.375rem 0.625rem',
                      marginBottom: '0.375rem',
                      fontFamily: antonio,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--lcars-butterscotch)',
                      background: 'rgba(255, 255, 255, 0.04)',
                      borderLeft: '3px solid var(--lcars-butterscotch)',
                      borderRadius: '2px',
                    }}>
                      <Loader2 size={12} className="lcars-spin" />
                      {toolStatus.replace('...', '').toUpperCase()}...
                    </div>
                  )}
                  {streamingText && (
                    <div style={{ display: 'flex', gap: 0 }}>
                      {/* C-bracket for streaming */}
                      <div style={{
                        width: '8px',
                        flexShrink: 0,
                        borderTop: '2px solid var(--lcars-ice)',
                        borderBottom: '2px solid var(--lcars-ice)',
                        borderLeft: '3px solid var(--lcars-ice)',
                        borderRadius: '6px 0 0 6px',
                      }} />
                      <div style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.04)',
                        padding: '0.625rem 0.75rem',
                        fontSize: '0.85rem',
                        lineHeight: 1.5,
                        color: 'var(--lcars-space-white)',
                      }}>
                        <ChatMarkdown content={streamingText} />
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '14px',
                          background: 'var(--lcars-butterscotch)',
                          borderRadius: '1px',
                          marginLeft: '2px',
                          animation: 'lcars-blink 1s step-end infinite',
                          verticalAlign: 'text-bottom',
                        }} />
                      </div>
                    </div>
                  )}
                  {!streamingText && !toolStatus && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.625rem 0.75rem',
                      fontFamily: antonio,
                      fontSize: '0.75rem',
                      color: 'var(--lcars-gray)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      <Loader2 size={14} className="lcars-spin" />
                      Processing...
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderLeft: '3px solid var(--lcars-tomato)',
                  background: 'rgba(255, 68, 68, 0.08)',
                  color: 'var(--lcars-tomato)',
                  fontFamily: antonio,
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
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
                      color: 'var(--lcars-tomato)',
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

            {/* ── Input Area ────────────────────────────────── */}
            <div style={{
              padding: '0.5rem 0.75rem',
              paddingBottom: isMobile ? 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' : '0.5rem',
              borderTop: '2px solid var(--lcars-butterscotch)',
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
                placeholder="ENTER QUERY..."
                rows={1}
                style={{
                  flex: 1,
                  resize: 'none',
                  background: '#000000',
                  border: '1px solid var(--lcars-gray)',
                  borderRadius: '4px',
                  padding: '0.5rem 0.75rem',
                  color: 'var(--lcars-space-white)',
                  fontFamily: antonio,
                  fontSize: '0.85rem',
                  letterSpacing: '0.03em',
                  lineHeight: 1.4,
                  maxHeight: '120px',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onInput={e => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onFocus={e => e.target.style.borderColor = 'var(--lcars-sunflower)'}
                onBlur={e => e.target.style.borderColor = 'var(--lcars-gray)'}
              />

              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  title="Stop"
                  style={{
                    height: '36px',
                    padding: '0 0.75rem',
                    borderRadius: '18px',
                    background: 'var(--lcars-tomato)',
                    border: 'none',
                    color: '#000000',
                    cursor: 'pointer',
                    fontFamily: antonio,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    flexShrink: 0,
                  }}
                >
                  <Square size={12} />
                  STOP
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  title="Send"
                  style={{
                    height: '36px',
                    padding: '0 0.75rem',
                    borderRadius: '18px',
                    background: input.trim() ? 'var(--lcars-sunflower)' : 'var(--lcars-gray)',
                    border: 'none',
                    color: '#000000',
                    cursor: input.trim() ? 'pointer' : 'default',
                    fontFamily: antonio,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    flexShrink: 0,
                    opacity: input.trim() ? 1 : 0.5,
                    transition: 'background 0.15s ease, opacity 0.15s ease',
                  }}
                >
                  <Send size={12} />
                  SEND
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── LCARS-specific animations ────────────────────────── */}
      <style>{`
        @keyframes lcars-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .lcars-spin {
          animation: lcars-spin-anim 1s linear infinite;
        }
        @keyframes lcars-spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}


/**
 * LCARS-styled message bubble with C-shaped bracket separator.
 * Each message gets a subtle grey background and a short C bracket
 * on the left (assistant/ice) or right (user/butterscotch) side.
 */
function LCARSMessageBubble({ message }) {
  const isUser = message.role === 'user'
  const antonio = "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif"
  const accentColor = isUser ? 'var(--lcars-butterscotch)' : 'var(--lcars-ice)'

  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '85%',
    }}>
      {/* Role label */}
      <div style={{
        fontFamily: antonio,
        fontSize: '0.6rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: accentColor,
        marginBottom: '2px',
        textAlign: isUser ? 'right' : 'left',
      }}>
        {isUser ? 'USER' : 'COMPUTER'}
      </div>
      {/* Message body with C-bracket and grey background */}
      <div style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 0,
      }}>
        {/* C-shaped bracket */}
        <div style={{
          width: '8px',
          minHeight: '100%',
          flexShrink: 0,
          borderTop: `2px solid ${accentColor}`,
          borderBottom: `2px solid ${accentColor}`,
          borderLeft: isUser ? 'none' : `3px solid ${accentColor}`,
          borderRight: isUser ? `3px solid ${accentColor}` : 'none',
          borderRadius: isUser ? '0 6px 6px 0' : '6px 0 0 6px',
        }} />
        {/* Content */}
        <div style={{
          flex: 1,
          background: isUser ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.04)',
          padding: '0.5rem 0.75rem',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'var(--lcars-space-white)',
          wordBreak: 'break-word',
        }}>
          {isUser ? (
            message.content
          ) : (
            <ChatMarkdown content={message.content} />
          )}
        </div>
      </div>
    </div>
  )
}


/**
 * LCARS thread list item with pill-shaped layout.
 */
function LCARSThreadItem({ conversation, isActive, onSelect, onDelete }) {
  const antonio = "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif"
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
        padding: '0.5rem 0.75rem',
        cursor: 'pointer',
        borderBottom: '1px solid rgba(102, 102, 136, 0.2)',
        borderLeft: isActive ? '3px solid var(--lcars-butterscotch)' : '3px solid transparent',
        background: isActive ? 'rgba(255, 153, 0, 0.05)' : 'transparent',
        transition: 'background 0.1s ease',
      }}
      onMouseEnter={e => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255, 204, 153, 0.03)'
      }}
      onMouseLeave={e => {
        if (!isActive) e.currentTarget.style.background = 'transparent'
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: antonio,
          fontSize: '0.82rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          color: isActive ? 'var(--lcars-butterscotch)' : 'var(--lcars-space-white)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {conversation.title || 'Untitled Session'}
        </div>
        <div style={{
          fontFamily: antonio,
          fontSize: '0.65rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: '2px',
        }}>
          {date} — {conversation.message_count || 0} entries
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
          color: 'var(--lcars-gray)',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          flexShrink: 0,
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-tomato)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}


/**
 * Small LCARS pill button for the header bar.
 */
function LCARSPillButton({ label, color, onClick }) {
  const antonio = "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif"

  return (
    <button
      onClick={onClick}
      style={{
        height: '24px',
        padding: '0 0.5rem',
        margin: '0 2px',
        borderRadius: '12px',
        background: color,
        border: 'none',
        color: '#000000',
        cursor: 'pointer',
        fontFamily: antonio,
        fontSize: '0.6rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        flexShrink: 0,
        transition: 'filter 0.15s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.2)'}
      onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
    >
      {label}
    </button>
  )
}
