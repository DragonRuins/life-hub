/**
 * LCARSSmartHomeQuickMenu.jsx - LCARS Header Quick Menu for Smart Home Favorites
 *
 * Authentic LCARS-styled dropdown for the header bar.
 * Black background with gold border, Antonio font labels,
 * accent bars for device state, JetBrains Mono values.
 * Follows the LCARSNotificationBell pattern from LCARSHeader.jsx.
 */
import { useState, useEffect, useRef } from 'react'
import { Home, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { infrastructure } from '../../api/client'
import useIsMobile from '../../hooks/useIsMobile'

// Domains that support toggle-style control
const TOGGLEABLE_DOMAINS = new Set(['light', 'switch', 'fan', 'lock', 'cover'])

export default function LCARSSmartHomeQuickMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState(null)
  const dropdownRef = useRef(null)
  const refreshRef = useRef(null)
  const sseRef = useRef(null)
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [dropdownTop, setDropdownTop] = useState(0)

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

  // Fallback poll every 60s while open
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
    } catch { /* silent */ }
  }

  async function toggleDropdown() {
    if (!isOpen) {
      // Compute position for mobile fixed dropdown before opening
      if (isMobile && dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect()
        setDropdownTop(rect.bottom + 8)
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

  function getAccentColor(device) {
    if (device.last_state === 'unavailable') return 'var(--lcars-tomato)'
    if (device.last_state === 'unknown') return 'var(--lcars-gray)'

    if (TOGGLEABLE_DOMAINS.has(device.domain)) {
      if (device.domain === 'lock') {
        return device.last_state === 'locked' ? 'var(--lcars-green)' : 'var(--lcars-tomato)'
      }
      return device.last_state === 'on' ? 'var(--lcars-gold)' : 'var(--lcars-gray)'
    }
    // Sensors get a subtle gray accent
    return 'var(--lcars-gray)'
  }

  const isToggleable = (domain) => TOGGLEABLE_DOMAINS.has(domain)

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Home button - black on colored header bar */}
      <button
        onClick={toggleDropdown}
        title="Environmental Controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: isMobile ? '28px' : '32px',
          height: isMobile ? '28px' : '32px',
          borderRadius: '50%',
          background: isOpen ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
          border: 'none',
          color: 'var(--lcars-text-on-color)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent' }}
      >
        <Home size={isMobile ? 16 : 18} />
      </button>

      {/* LCARS-styled dropdown */}
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
            marginTop: '8px',
            width: '340px',
          }),
          background: '#000000',
          border: '2px solid var(--lcars-gold)',
          borderRadius: '4px',
          boxShadow: '0 4px 24px rgba(255, 204, 153, 0.15)',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header bar — .lcars-bar for color inheritance */}
          <div
            className="lcars-bar"
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--lcars-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 'auto',
            }}
          >
            <span style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '0.85rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Environmental Controls
            </span>
          </div>

          {/* Device list */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
                color: 'var(--lcars-ice)',
                textTransform: 'uppercase',
              }}>
                Scanning...
              </div>
            ) : devices.length === 0 ? (
              <div style={{
                padding: '2rem 1rem',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.85rem',
                  color: 'var(--lcars-gray)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  No Favorites Registered
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem',
                  color: 'var(--lcars-gray)',
                  marginTop: '0.5rem',
                  opacity: 0.7,
                }}>
                  STAR DEVICES ON ENVIRONMENTAL CONTROLS PAGE
                </div>
              </div>
            ) : (
              devices.map((device, idx) => {
                const toggleable = isToggleable(device.domain)
                const accentColor = getAccentColor(device)
                const isCurrentlyToggling = toggling === device.id

                return (
                  <div key={device.id}>
                    {/* Segmented divider between rows */}
                    {idx > 0 && (
                      <div style={{
                        height: '1px',
                        background: 'rgba(102, 102, 136, 0.2)',
                        margin: '0 0.75rem',
                      }} />
                    )}

                    <div
                      onClick={() => toggleable && !isCurrentlyToggling && handleToggle(device)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.625rem 0.75rem',
                        cursor: toggleable ? 'pointer' : 'default',
                        opacity: isCurrentlyToggling ? 0.5 : 1,
                        transition: 'background 0.15s',
                        minHeight: isMobile ? '44px' : '38px',
                      }}
                      onMouseEnter={e => { if (toggleable) e.currentTarget.style.background = 'rgba(255, 204, 153, 0.05)' }}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Accent bar */}
                      <div style={{
                        width: '4px',
                        height: '28px',
                        background: accentColor,
                        flexShrink: 0,
                        transition: 'background 0.3s ease',
                      }} />

                      {/* Device name */}
                      <span style={{
                        flex: 1,
                        minWidth: 0,
                        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                        fontSize: '0.8rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--lcars-gray)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {device.friendly_name || device.entity_id}
                      </span>

                      {/* Value */}
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: toggleable ? '0.8rem' : '0.9rem',
                        fontWeight: 600,
                        color: toggleable ? accentColor : 'var(--lcars-ice)',
                        flexShrink: 0,
                        textTransform: 'uppercase',
                      }}>
                        {toggleable ? (device.last_state || '--') : getDisplayValue(device)}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer - thin gold bar */}
          <div style={{
            padding: '0.4rem 1rem',
            borderTop: '2px solid var(--lcars-gold)',
            textAlign: 'center',
          }}>
            <button
              onClick={() => { setIsOpen(false); navigate('/infrastructure/smarthome') }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--lcars-ice)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontFamily: "'Antonio', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              Configure <ExternalLink size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
