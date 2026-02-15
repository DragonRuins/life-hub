import { useState, useEffect, useRef } from 'react'
import { Bell, Check, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notifications } from '../api/client'

export default function NotificationBell() {
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
    } catch {
      // Silently fail for background polling
    }
  }

  async function toggleDropdown() {
    if (!isOpen) {
      // Fetch recent notifications when opening
      try {
        const data = await notifications.feed({ limit: 10 })
        setItems(data)
      } catch {
        setItems([])
      }
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

  function handleViewAll() {
    setIsOpen(false)
    navigate('/notifications')
  }

  // Format relative time (e.g., "2m ago", "1h ago")
  function formatRelativeTime(dateStr) {
    if (!dateStr) return ''
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  // Priority color mapping
  const priorityColors = {
    low: 'var(--color-overlay-0)',
    normal: 'var(--color-blue)',
    high: 'var(--color-peach)',
    critical: 'var(--color-red)',
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={toggleDropdown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: isOpen ? 'rgba(137, 180, 250, 0.08)' : 'transparent',
          border: 'none',
          color: isOpen ? 'var(--color-blue)' : 'var(--color-subtext-0)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          position: 'relative',
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)' }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = isOpen ? 'rgba(137, 180, 250, 0.08)' : 'transparent' }}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            background: 'var(--color-red)',
            color: 'var(--color-crust)',
            fontSize: '0.6rem',
            fontWeight: 700,
            borderRadius: '999px',
            minWidth: '16px',
            height: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel - opens downward from header */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '4px',
          width: '360px',
          background: 'var(--color-base)',
          border: '1px solid var(--color-surface-0)',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-surface-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-blue)',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontFamily: 'inherit',
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
                color: 'var(--color-overlay-0)',
                fontSize: '0.85rem',
              }}>
                No notifications yet
              </div>
            ) : (
              items.map(item => (
                <div
                  key={item.id}
                  onClick={() => !item.is_read && handleMarkRead(item.id)}
                  style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--color-surface-0)',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'flex-start',
                    cursor: item.is_read ? 'default' : 'pointer',
                    opacity: item.is_read ? 0.6 : 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!item.is_read) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)' }}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Priority dot */}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: priorityColors[item.priority] || priorityColors.normal,
                    marginTop: '6px',
                    flexShrink: 0,
                  }} />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {item.title && (
                      <div style={{
                        fontWeight: item.is_read ? 400 : 600,
                        fontSize: '0.85rem',
                        marginBottom: '2px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.title}
                      </div>
                    )}
                    <div style={{
                      fontSize: '0.8rem',
                      color: 'var(--color-subtext-0)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.body}
                    </div>
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-overlay-0)',
                      marginTop: '4px',
                    }}>
                      {formatRelativeTime(item.sent_at)}
                    </div>
                  </div>

                  {/* Read indicator */}
                  {item.is_read && (
                    <Check size={14} style={{ color: 'var(--color-green)', marginTop: '4px', flexShrink: 0 }} />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '0.625rem 1rem',
            borderTop: '1px solid var(--color-surface-0)',
            textAlign: 'center',
          }}>
            <button
              onClick={handleViewAll}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-blue)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              View All <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
