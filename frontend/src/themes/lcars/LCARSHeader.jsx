/**
 * LCARSHeader.jsx - LCARS Top Horizontal Bar
 *
 * The top bar connects to the sidebar via the top-left elbow.
 * Contains: app title, decorative pills, pulsing status dot,
 * notification bell, and settings gear dropdown.
 */
import { useState, useEffect, useRef } from 'react'
import { Bell, Settings, Monitor, Check, ExternalLink, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from './ThemeProvider'
import { notifications, vehicles as vehiclesApi } from '../../api/client'

export default function LCARSHeader() {
  const [gearOpen, setGearOpen] = useState(false)
  const [vehicleList, setVehicleList] = useState([])
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    localStorage.getItem('dashboard_vehicle_id') || 'all'
  )
  const gearRef = useRef(null)
  const navigate = useNavigate()
  const { theme, setTheme, isLCARS } = useTheme()

  // Fetch vehicle list when gear dropdown opens
  useEffect(() => {
    if (gearOpen && vehicleList.length === 0) {
      vehiclesApi.list().then(setVehicleList).catch(() => {})
    }
  }, [gearOpen])

  // Close gear dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) {
        setGearOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleVehicleSelect(id) {
    setSelectedVehicleId(id)
    localStorage.setItem('dashboard_vehicle_id', id)
    window.dispatchEvent(new Event('vehicle-selection-changed'))
  }

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
          Life Hub
        </span>
      </div>

      {/* Decorative colored segments (hidden on mobile) */}
      <div className="lcars-header-decor" style={{ width: '60px', background: 'var(--lcars-african-violet)' }} />
      <div className="lcars-header-decor" style={{ width: '40px', background: 'var(--lcars-ice)' }} />

      {/* Controls area (notification + settings) on colored bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'var(--lcars-sunflower)',
          padding: '0 0.75rem',
          borderRadius: '0 0 30px 0',
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

        {/* Custom LCARS notification bell (replaces NotificationBell component
            because the original is styled for dark backgrounds) */}
        <LCARSNotificationBell />

        {/* Settings Gear */}
        <div ref={gearRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setGearOpen(!gearOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: gearOpen ? 'rgba(0, 0, 0, 0.2)' : 'transparent',
              border: 'none',
              color: '#000000',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.15)'}
            onMouseLeave={e => { if (!gearOpen) e.currentTarget.style.background = 'transparent' }}
          >
            <Settings size={18} />
          </button>

          {/* Gear Dropdown */}
          {gearOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              width: '220px',
              background: '#000000',
              border: '2px solid var(--lcars-sunflower)',
              borderRadius: '4px',
              boxShadow: '0 4px 24px rgba(255, 204, 153, 0.15)',
              zIndex: 1000,
              overflow: 'hidden',
            }}>
              <DropdownButton onClick={() => { setGearOpen(false); navigate('/notifications') }}>
                Notifications
              </DropdownButton>

              {/* Vehicle Selector */}
              {vehicleList.length > 0 && (
                <div style={{ borderTop: '1px solid var(--lcars-gray)' }}>
                  <div style={{
                    padding: '0.5rem 1rem 0.25rem',
                    fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    color: 'var(--lcars-gray)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    Dashboard Vehicle
                  </div>
                  <DropdownButton onClick={() => handleVehicleSelect('all')}>
                    <span style={{
                      color: selectedVehicleId === 'all' ? 'var(--lcars-sunflower)' : 'var(--lcars-space-white)',
                      fontWeight: selectedVehicleId === 'all' ? 700 : 400,
                    }}>
                      All Fleet
                    </span>
                  </DropdownButton>
                  {vehicleList.map(v => (
                    <DropdownButton key={v.id} onClick={() => handleVehicleSelect(String(v.id))}>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        color: selectedVehicleId === String(v.id) ? 'var(--lcars-sunflower)' : 'var(--lcars-space-white)',
                        fontWeight: selectedVehicleId === String(v.id) ? 700 : 400,
                      }}>
                        {v.is_primary && <Star size={11} fill="var(--lcars-butterscotch)" style={{ color: 'var(--lcars-butterscotch)', flexShrink: 0 }} />}
                        {v.year} {v.make} {v.model}
                      </span>
                    </DropdownButton>
                  ))}
                </div>
              )}

              <DropdownButton
                onClick={() => { setTheme(isLCARS ? 'catppuccin' : 'lcars'); setGearOpen(false) }}
                borderTop
              >
                <Monitor size={16} />
                Theme: {isLCARS ? 'LCARS' : 'Catppuccin'}
              </DropdownButton>
            </div>
          )}
        </div>
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


/**
 * Dropdown button used in the LCARS header gear menu.
 * Light text on dark background.
 */
function DropdownButton({ children, onClick, borderTop }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        padding: '0.625rem 1rem',
        background: 'none',
        border: 'none',
        borderTop: borderTop ? '1px solid var(--lcars-gray)' : 'none',
        color: 'var(--lcars-space-white)',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontFamily: "'Antonio', sans-serif",
        textAlign: 'left',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 204, 153, 0.1)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  )
}
