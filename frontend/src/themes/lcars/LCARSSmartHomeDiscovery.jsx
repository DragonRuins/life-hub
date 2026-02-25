/**
 * LCARSSmartHomeDiscovery.jsx - LCARS-Themed HA Entity Discovery Modal
 *
 * Purpose-built LCARS replacement for the Catppuccin SmartHomeDiscovery.
 * Same props and API logic, but with black/gold LCARS visual language:
 * gold border, Antonio headers, pill buttons, accent bars, monospace values.
 */
import { useState, useEffect } from 'react'
import {
  Search, X, Download, Check, ChevronDown, ChevronRight,
  Thermometer, Lightbulb, ToggleLeft, Wind, Lock, Eye, Tv,
} from 'lucide-react'
import { infrastructure } from '../../api/client'

// Icon mapping for common HA domains
const DOMAIN_ICONS = {
  sensor: Thermometer,
  binary_sensor: Eye,
  light: Lightbulb,
  switch: ToggleLeft,
  climate: Wind,
  lock: Lock,
  cover: ChevronDown,
  fan: Wind,
  media_player: Tv,
}

// Suggested category mapping for domains
const DOMAIN_CATEGORIES = {
  sensor: 'sensor',
  binary_sensor: 'security',
  light: 'lighting',
  switch: 'general',
  climate: 'climate',
  lock: 'security',
  cover: 'general',
  fan: 'climate',
  media_player: 'media',
}

// LCARS color cycle for domain headers
const DOMAIN_COLORS = [
  'var(--lcars-sunflower)',
  'var(--lcars-tanoi)',
  'var(--lcars-lilac)',
  'var(--lcars-butterscotch)',
  'var(--lcars-ice)',
  'var(--lcars-gold)',
  'var(--lcars-african-violet)',
]

export default function LCARSSmartHomeDiscovery({ rooms, onImported, onClose }) {
  const [discovery, setDiscovery] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [search, setSearch] = useState('')
  const [expandedDomains, setExpandedDomains] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [assignRoom, setAssignRoom] = useState('')
  const [assignCategory, setAssignCategory] = useState('')

  useEffect(() => {
    loadDiscovery()
  }, [])

  async function loadDiscovery() {
    try {
      setLoading(true)
      const data = await infrastructure.smarthome.discover()
      setDiscovery(data)
      const domains = Object.keys(data.domains || {})
      if (domains.length <= 5) {
        setExpandedDomains(new Set(domains))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function toggleDomain(domain) {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  function toggleEntity(entityId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(entityId)) next.delete(entityId)
      else next.add(entityId)
      return next
    })
  }

  function selectAllInDomain(domain, entities) {
    const unregistered = entities.filter(e => !e.is_registered)
    setSelected(prev => {
      const next = new Set(prev)
      const allSelected = unregistered.every(e => next.has(e.entity_id))
      if (allSelected) {
        unregistered.forEach(e => next.delete(e.entity_id))
      } else {
        unregistered.forEach(e => next.add(e.entity_id))
      }
      return next
    })
  }

  async function handleImport() {
    if (selected.size === 0) return
    setImporting(true)
    try {
      const devices = []
      const domains = discovery.domains || {}
      for (const [domain, entities] of Object.entries(domains)) {
        for (const entity of entities) {
          if (!selected.has(entity.entity_id)) continue
          devices.push({
            integration_config_id: discovery.integration_id,
            entity_id: entity.entity_id,
            friendly_name: entity.friendly_name,
            domain: entity.domain,
            device_class: entity.device_class,
            room_id: assignRoom ? parseInt(assignRoom) : null,
            category: assignCategory || DOMAIN_CATEGORIES[domain] || 'general',
          })
        }
      }
      const result = await infrastructure.smarthome.devices.bulkImport(devices)
      onImported(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setImporting(false)
    }
  }

  function getFilteredDomains() {
    if (!discovery?.domains) return {}
    if (!search.trim()) return discovery.domains

    const filtered = {}
    const q = search.toLowerCase()
    for (const [domain, entities] of Object.entries(discovery.domains)) {
      const matches = entities.filter(e =>
        e.entity_id.toLowerCase().includes(q) ||
        (e.friendly_name || '').toLowerCase().includes(q)
      )
      if (matches.length > 0) filtered[domain] = matches
    }
    return filtered
  }

  const filteredDomains = getFilteredDomains()
  const domainKeys = Object.keys(filteredDomains)

  // Shared LCARS styles
  const selectStyle = {
    padding: '0.4rem 0.5rem',
    background: '#000',
    border: '1px solid var(--lcars-tanoi)',
    color: 'var(--lcars-space-white)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.8rem',
    borderRadius: '0',
    width: '100%',
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.8)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(700px, calc(100vw - 2rem))',
          maxHeight: 'min(85vh, 750px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#000000',
          border: '2px solid var(--lcars-gold)',
          borderRadius: '4px',
        }}
      >
        {/* Header bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.625rem 1rem',
          background: 'var(--lcars-gold)',
          flexShrink: 0,
        }}>
          <div>
            <span style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--lcars-text-on-color)',
            }}>
              Entity Discovery
            </span>
            {discovery && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.7rem',
                color: 'rgba(0, 0, 0, 0.6)',
                marginLeft: '0.75rem',
              }}>
                {discovery.total_entities} FOUND / {discovery.registered_count} REGISTERED
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: 'var(--lcars-text-on-color)',
              cursor: 'pointer', padding: '2px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search + assignment controls */}
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid rgba(102, 102, 136, 0.3)',
          flexShrink: 0,
        }}>
          {/* Search input */}
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <Search size={14} style={{
              position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--lcars-gray)',
            }} />
            <input
              type="text"
              placeholder="SEARCH ENTITIES..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.5rem 0.4rem 1.75rem',
                background: '#000',
                border: '1px solid var(--lcars-gold)',
                color: 'var(--lcars-space-white)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
                borderRadius: '0',
              }}
            />
          </div>

          {/* Room + category assignment */}
          <div className="form-grid-2col" style={{ gap: '0.5rem' }}>
            <select value={assignRoom} onChange={e => setAssignRoom(e.target.value)} style={selectStyle}>
              <option value="">ASSIGN TO SECTION...</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>)}
            </select>
            <select value={assignCategory} onChange={e => setAssignCategory(e.target.value)} style={selectStyle}>
              <option value="">AUTO-ASSIGN CATEGORY</option>
              <option value="climate">CLIMATE</option>
              <option value="lighting">LIGHTING</option>
              <option value="security">SECURITY</option>
              <option value="sensor">SENSOR</option>
              <option value="media">MEDIA</option>
              <option value="printer">PRINTER</option>
              <option value="general">GENERAL</option>
            </select>
          </div>
        </div>

        {/* Entity list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem' }}>
          {loading && (
            <div style={{
              textAlign: 'center', padding: '2rem',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem', color: 'var(--lcars-ice)',
              textTransform: 'uppercase',
            }}>
              Scanning for entities...
            </div>
          )}
          {error && (
            <div style={{
              textAlign: 'center', padding: '1rem',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem', color: 'var(--lcars-tomato)',
            }}>
              {error}
            </div>
          )}
          {!loading && !error && domainKeys.map((domain, domainIdx) => {
            const entities = filteredDomains[domain]
            const Icon = DOMAIN_ICONS[domain] || Eye
            const isExpanded = expandedDomains.has(domain)
            const unregistered = entities.filter(e => !e.is_registered)
            const allSelected = unregistered.length > 0 && unregistered.every(e => selected.has(e.entity_id))
            const domainColor = DOMAIN_COLORS[domainIdx % DOMAIN_COLORS.length]

            return (
              <div key={domain} style={{ marginBottom: '0.5rem' }}>
                {/* Domain header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0', cursor: 'pointer', userSelect: 'none',
                  }}
                  onClick={() => toggleDomain(domain)}
                >
                  {/* Expand/collapse pill */}
                  <div style={{
                    width: '24px', height: '24px',
                    borderRadius: '999px',
                    background: domainColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {isExpanded
                      ? <ChevronDown size={12} color="#000" />
                      : <ChevronRight size={12} color="#000" />
                    }
                  </div>

                  <Icon size={14} style={{ color: domainColor, flexShrink: 0 }} />

                  <span style={{
                    fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                    fontSize: '0.85rem', fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: domainColor,
                  }}>
                    {domain.replace('_', ' ')}
                  </span>

                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.65rem', color: 'var(--lcars-gray)',
                  }}>
                    ({entities.length})
                  </span>

                  {unregistered.length > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); selectAllInDomain(domain, entities) }}
                      style={{
                        marginLeft: 'auto',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: "'Antonio', sans-serif",
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: allSelected ? domainColor : 'var(--lcars-gray)',
                        color: 'var(--lcars-text-on-color)',
                      }}
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {/* Entity rows */}
                {isExpanded && entities.map(entity => {
                  const isSelected = selected.has(entity.entity_id)
                  const stateColor = entity.state === 'unavailable' ? 'var(--lcars-tomato)'
                    : entity.state === 'on' ? 'var(--lcars-gold)'
                    : 'var(--lcars-gray)'

                  return (
                    <div
                      key={entity.entity_id}
                      onClick={() => !entity.is_registered && toggleEntity(entity.entity_id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.4rem 0.5rem 0.4rem 2.25rem',
                        opacity: entity.is_registered ? 0.4 : 1,
                        cursor: entity.is_registered ? 'not-allowed' : 'pointer',
                        minHeight: '36px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!entity.is_registered) e.currentTarget.style.background = 'rgba(255, 204, 153, 0.03)' }}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Selection indicator (LCARS-style accent bar) */}
                      <div style={{
                        width: '4px',
                        height: '20px',
                        background: entity.is_registered
                          ? 'var(--lcars-green)'
                          : isSelected ? domainColor : 'rgba(102, 102, 136, 0.2)',
                        flexShrink: 0,
                        transition: 'background 0.2s',
                      }} />

                      {/* Entity name and ID */}
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{
                          fontFamily: "'Antonio', sans-serif",
                          fontSize: '0.78rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                          color: isSelected ? 'var(--lcars-space-white)' : 'var(--lcars-gray)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          lineHeight: 1.3,
                        }}>
                          {entity.friendly_name}
                        </div>
                        <div style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.6rem',
                          color: 'var(--lcars-gray)',
                          opacity: 0.6,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          lineHeight: 1.3,
                        }}>
                          {entity.entity_id}
                        </div>
                      </div>

                      {/* State badge (pill-shaped) */}
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.6rem',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '999px',
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        background: entity.state === 'unavailable'
                          ? 'rgba(255, 100, 100, 0.15)'
                          : 'rgba(102, 102, 136, 0.15)',
                        color: stateColor,
                        textTransform: 'uppercase',
                      }}>
                        {entity.state}
                      </span>

                      {/* Registered checkmark */}
                      {entity.is_registered && (
                        <Check size={12} style={{ color: 'var(--lcars-green)', flexShrink: 0 }} />
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.625rem 1rem',
          borderTop: '2px solid var(--lcars-gold)',
          flexShrink: 0,
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            color: 'var(--lcars-gray)',
          }}>
            {selected.size} SELECTED
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                background: 'var(--lcars-gray)',
                color: 'var(--lcars-text-on-color)',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              style={{
                padding: '0.4rem 0.75rem',
                borderRadius: '999px',
                border: 'none',
                cursor: selected.size === 0 || importing ? 'not-allowed' : 'pointer',
                background: selected.size > 0 && !importing ? 'var(--lcars-gold)' : 'var(--lcars-gray)',
                color: 'var(--lcars-text-on-color)',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <Download size={14} />
              {importing ? 'Importing...' : `Import ${selected.size}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
