/**
 * LCARSHeader.jsx - LCARS Top Horizontal Bar
 *
 * The top bar connects to the sidebar via the top-left elbow.
 * Contains: app title, decorative pills, pulsing status dot,
 * notification bell, theme toggle button, and settings link.
 */
import { useState, useEffect, useRef } from 'react'
import { Bell, Settings, Palette, Check, ExternalLink } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTheme } from './ThemeProvider'
import { notifications } from '../../api/client'

export default function LCARSHeader() {
  const { setTheme, isLCARS } = useTheme()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: '100%',
        background: '#000000',
        gap: '3px',
      }}
    >
      {/* Main header bar (sunflower color) */}
      <div
        style={{
          flex: 1,
          background: 'var(--lcars-sunflower)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 1rem',
          gap: '0.75rem',
        }}
      >
        {/* App title */}
        <span
          style={{
            flex: 1,
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '1.1rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: '#000000',
            paddingLeft: '0.5rem',
          }}
        >
          Datacore
        </span>
      </div>

      {/* Decorative colored segments (hidden on mobile) */}
      <div className="lcars-header-decor" style={{ width: '60px', background: 'var(--lcars-african-violet)' }} />
      <div className="lcars-header-decor" style={{ width: '40px', background: 'var(--lcars-ice)' }} />

      {/* Controls area (notification + theme toggle + settings) on colored bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--lcars-sunflower)',
          padding: '0 0.75rem',
          borderRadius: '0 30px 30px 0',
        }}
      >
        {/* Pulsing status indicator */}
        <div
          className="lcars-pulse"
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--lcars-green)',
            flexShrink: 0,
          }}
        />

        {/* Custom LCARS notification bell */}
        <LCARSNotificationBell />

        {/* Theme Toggle Button */}
        <button
          onClick={() => setTheme(isLCARS ? 'catppuccin' : 'lcars')}
          title={`Switch to ${isLCARS ? 'Catppuccin' : 'LCARS'} theme`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'transparent',
            border: 'none',
            color: '#000000',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Palette size={18} />
        </button>

        {/* Settings Link (direct navigation, no dropdown) */}
        <Link
          to="/settings"
          title="Settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'transparent',
            color: '#000000',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Settings size={18} />
        </Link>
      </div>
    </div>
  )
}


/**
 * LCARS-styled notification bell for the header bar.
 * Built specifically for the colored header background (black icon on colored bar).
 * Replicates the notification functionality from NotificationBell but with
 * LCARS-appropriate styling.
 */
function LCARSNotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [items, setItems] = useState([])
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  // Poll for unread count every 30 seconds
  useEffect(() => {
    fetchUnreadCount()
    const timer = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(timer)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function fetchUnreadCount() {
    try {
      const data = await notifications.unreadCount()
      setUnreadCount(data.count)
    } catch { /* silent */ }
  }

  async function toggleDropdown() {
    if (!isOpen) {
      try {
        const data = await notifications.feed({ limit: 10 })
        setItems(data)
      } catch { setItems([]) }
    }
    setIsOpen(!isOpen)
  }

  async function handleMarkRead(id) {
    try {
      await notifications.markRead(id)
      setItems(items.map(item => item.id === id ? { ...item, is_read: true } : item))
      setUnreadCount(Math.max(0, unreadCount - 1))
    } catch { }
  }

  async function handleMarkAllRead() {
    try {
      await notifications.markAllRead()
      setItems(items.map(item => ({ ...item, is_read: true })))
      setUnreadCount(0)
    } catch { }
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return ''
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button - black on colored background */}
      <button
        onClick={toggleDropdown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: isOpen ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
          border: 'none',
          color: '#000000',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)'}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            background: 'var(--lcars-tomato)',
            color: '#000000',
            fontSize: '0.55rem',
            fontWeight: 700,
            borderRadius: '999px',
            minWidth: '14px',
            height: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 2px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown - LCARS styled on black background */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          width: 'min(360px, calc(100vw - 1rem))',
          background: '#000000',
          border: '2px solid var(--lcars-sunflower)',
          borderRadius: '4px',
          boxShadow: '0 4px 24px rgba(255, 204, 153, 0.15)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '0.625rem 1rem',
            borderBottom: '1px solid var(--lcars-gray)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--lcars-sunflower)',
          }}>
            <span style={{
              fontWeight: 600,
              fontSize: '0.85rem',
              fontFamily: "'Antonio', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#000000',
            }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#000000',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontFamily: "'Antonio', sans-serif",
                  textTransform: 'uppercase',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: 'var(--lcars-gray)',
                fontSize: '0.85rem',
                fontFamily: "'Antonio', sans-serif",
                textTransform: 'uppercase',
              }}>
                No notifications
              </div>
            ) : (
              items.map(item => (
                <div
                  key={item.id}
                  onClick={() => !item.is_read && handleMarkRead(item.id)}
                  style={{
                    padding: '0.625rem 1rem',
                    borderBottom: '1px solid rgba(102, 102, 136, 0.3)',
                    display: 'flex',
                    gap: '0.625rem',
                    alignItems: 'flex-start',
                    cursor: item.is_read ? 'default' : 'pointer',
                    opacity: item.is_read ? 0.5 : 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!item.is_read) e.currentTarget.style.background = 'rgba(255, 204, 153, 0.05)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: item.is_read ? 'var(--lcars-gray)' : 'var(--lcars-butterscotch)',
                    marginTop: '6px',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.title && (
                      <div style={{
                        fontWeight: item.is_read ? 400 : 600,
                        fontSize: '0.82rem',
                        color: 'var(--lcars-space-white)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.title}
                      </div>
                    )}
                    <div style={{
                      fontSize: '0.78rem',
                      color: 'var(--lcars-sunflower)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.body}
                    </div>
                    <div style={{
                      fontSize: '0.68rem',
                      color: 'var(--lcars-gray)',
                      marginTop: '2px',
                    }}>
                      {formatRelativeTime(item.sent_at)}
                    </div>
                  </div>
                  {item.is_read && (
                    <Check size={12} style={{ color: 'var(--lcars-green)', marginTop: '4px', flexShrink: 0 }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '0.5rem 1rem',
            borderTop: '1px solid var(--lcars-gray)',
            textAlign: 'center',
          }}>
            <button
              onClick={() => { setIsOpen(false); navigate('/notifications') }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--lcars-ice)',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontFamily: "'Antonio', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              View All <ExternalLink size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
