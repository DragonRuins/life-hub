/**
 * SmartHomeQuickMenu.jsx - Header Quick Menu for Smart Home Favorites
 *
 * Dropdown menu (Catppuccin theme) accessible from the header bar.
 * Shows favorited smart home devices with toggle controls for
 * actionable devices and readouts for sensors. Follows the same
 * ref-based dropdown + click-outside pattern as NotificationBell.
 */
import { useState, useEffect, useRef } from 'react'
import { Home, ExternalLink, Lightbulb, ToggleLeft, Wind, Lock, Thermometer, Eye, Tv, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { infrastructure } from '../api/client'
import useIsMobile from '../hooks/useIsMobile'

// Icon mapping for common HA domains
const DOMAIN_ICONS = {
  light: Lightbulb,
  switch: ToggleLeft,
  fan: Wind,
  lock: Lock,
  sensor: Thermometer,
  binary_sensor: Eye,
  climate: Thermometer,
  cover: ToggleLeft,
  media_player: Tv,
}

// Domains that support toggle-style control
const TOGGLEABLE_DOMAINS = new Set(['light', 'switch', 'fan', 'lock', 'cover'])

export default function SmartHomeQuickMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(null) // device id being toggled
  const [dropdownTop, setDropdownTop] = useState(0)
  const dropdownRef = useRef(null)
  const refreshRef = useRef(null)
  const sseRef = useRef(null)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

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

  // Auto-refresh states every 60s while open (fallback)
  useEffect(() => {
    if (isOpen) {
      refreshRef.current = setInterval(fetchFavorites, 60000)
    } else {
      clearInterval(refreshRef.current)
    }
    return () => clearInterval(refreshRef.current)
  }, [isOpen])

  // SSE: subscribe while dropdown is open for instant state updates
  useEffect(() => {
    if (isOpen) {
      sseRef.current = infrastructure.smarthome.stream.connect(
        (event) => {
          if (event.type !== 'state_changed') return
          setDevices(prev => prev.map(d =>
            d.entity_id === event.entity_id
              ? { ...d, last_state: event.state, last_attributes: event.attributes }
              : d
          ))
        },
        () => {}
      )
    } else {
      sseRef.current?.close()
      sseRef.current = null
    }
    return () => { sseRef.current?.close(); sseRef.current = null }
  }, [isOpen])

  async function fetchFavorites() {
    try {
      const data = await infrastructure.smarthome.favorites()
      setDevices(data)
    } catch {
      // Silent fail for background refresh
    }
  }

  async function toggleDropdown() {
    if (!isOpen) {
      // Compute position for mobile fixed dropdown before opening
      if (isMobile && dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect()
        setDropdownTop(rect.bottom + 4)
      }
      setLoading(true)
      await fetchFavorites()
      setLoading(false)
    }
    setIsOpen(!isOpen)
  }

  async function handleToggle(device) {
    if (toggling) return
    setToggling(device.id)
    try {
      // Determine action based on domain + current state
      let action = 'toggle'
      if (device.domain === 'lock') {
        action = device.last_state === 'locked' ? 'unlock' : 'lock'
      }

      const updated = await infrastructure.smarthome.devices.control(device.id, { action })
      setDevices(prev => prev.map(d => d.id === device.id ? updated : d))
    } catch (err) {
      console.error('Control failed:', err)
    } finally {
      setToggling(null)
    }
  }

  // Format display value for sensor devices
  function getDisplayValue(device) {
    const attrs = device.last_attributes || {}
    const unit = attrs.unit_of_measurement || ''
    const state = device.last_state || '--'

    if (device.domain === 'sensor' && state && !isNaN(state)) {
      const num = parseFloat(state)
      const formatted = Number.isInteger(num) ? num.toString() : num.toFixed(1)
      return unit ? `${formatted} ${unit}` : formatted
    }
    return state
  }

  // State color for toggleable devices
  function getStateColor(device) {
    if (device.last_state === 'unavailable') return 'var(--color-red)'
    if (device.last_state === 'unknown') return 'var(--color-overlay-0)'
    if (device.domain === 'lock') {
      return device.last_state === 'locked' ? 'var(--color-green)' : 'var(--color-peach)'
    }
    return device.last_state === 'on' ? 'var(--color-green)' : 'var(--color-overlay-0)'
  }

  const isToggleable = (domain) => TOGGLEABLE_DOMAINS.has(domain)

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Home button */}
      <button
        onClick={toggleDropdown}
        title="Smart Home"
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
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)' }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = isOpen ? 'rgba(137, 180, 250, 0.08)' : 'transparent' }}
      >
        <Home size={18} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          ...(isMobile ? {
            position: 'fixed',
            top: dropdownTop + 'px',
            left: '0.5rem',
            right: '0.5rem',
            width: 'auto',
          } : {
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            width: 'min(320px, calc(100vw - 1rem))',
          }),
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
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Smart Home</span>
            <button
              onClick={() => { setIsOpen(false); navigate('/infrastructure/smarthome') }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-blue)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <ExternalLink size={11} />
            </button>
          </div>

          {/* Device List */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: 'var(--color-overlay-0)',
                fontSize: '0.85rem',
              }}>
                Loading...
              </div>
            ) : devices.length === 0 ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: 'var(--color-overlay-0)',
                fontSize: '0.85rem',
              }}>
                <Star size={20} style={{ marginBottom: '0.5rem', opacity: 0.4 }} />
                <div>No favorites yet</div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  Star devices on the Smart Home page
                </div>
              </div>
            ) : (
              devices.map(device => {
                const Icon = DOMAIN_ICONS[device.domain] || Eye
                const toggleable = isToggleable(device.domain)
                const stateColor = getStateColor(device)
                const isCurrentlyToggling = toggling === device.id

                return (
                  <div
                    key={device.id}
                    onClick={() => toggleable && !isCurrentlyToggling && handleToggle(device)}
                    style={{
                      padding: '0.625rem 1rem',
                      borderBottom: '1px solid var(--color-surface-0)',
                      display: 'flex',
                      gap: '0.625rem',
                      alignItems: 'center',
                      cursor: toggleable ? 'pointer' : 'default',
                      transition: 'background 0.15s',
                      opacity: isCurrentlyToggling ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (toggleable) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)' }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* State indicator dot */}
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: stateColor,
                      flexShrink: 0,
                    }} />

                    {/* Icon */}
                    <Icon size={16} style={{ color: 'var(--color-subtext-0)', flexShrink: 0 }} />

                    {/* Name */}
                    <div style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.85rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {device.friendly_name || device.entity_id}
                    </div>

                    {/* State value */}
                    <span style={{
                      fontSize: '0.75rem',
                      fontFamily: "'JetBrains Mono', monospace",
                      color: stateColor,
                      fontWeight: 600,
                      flexShrink: 0,
                      textTransform: 'uppercase',
                    }}>
                      {toggleable ? (device.last_state || '--') : getDisplayValue(device)}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '0.625rem 1rem',
            borderTop: '1px solid var(--color-surface-0)',
            textAlign: 'center',
          }}>
            <button
              onClick={() => { setIsOpen(false); navigate('/infrastructure/smarthome') }}
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
              Manage <ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
