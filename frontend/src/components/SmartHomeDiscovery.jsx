/**
 * SmartHomeDiscovery.jsx - HA Entity Discovery & Bulk Import Modal
 *
 * Fetches all entities from HomeAssistant, displays them grouped by domain
 * with checkboxes for selection, and allows bulk importing into the
 * smart home device registry with room/category assignment.
 */
import { useState, useEffect } from 'react'
import {
  Search, X, Download, Check, ChevronDown, ChevronRight,
  Thermometer, Lightbulb, ToggleLeft, Wind, Lock, Eye, Tv,
} from 'lucide-react'
import { infrastructure } from '../api/client'

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

export default function SmartHomeDiscovery({ rooms, onImported, onClose }) {
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
      // Auto-expand domains with entities
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
      // Build device objects from selected entities
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

  // Filter entities by search
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }}
    onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 'min(700px, calc(100vw - 2rem))',
          maxHeight: 'min(80vh, 700px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--color-base)',
          border: '1px solid var(--color-surface-0)',
          borderRadius: '12px',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--color-surface-0)',
          flexShrink: 0,
        }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Discover Devices</h2>
            {discovery && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginTop: '0.2rem' }}>
                {discovery.total_entities} entities found ({discovery.registered_count} already registered)
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--color-subtext-0)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search + Assignment Controls */}
        <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--color-surface-0)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={16} style={{
                position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--color-overlay-0)',
              }} />
              <input
                type="text"
                placeholder="Search entities..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '0.45rem 0.6rem 0.45rem 2rem',
                  background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
                  borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.85rem',
                }}
              />
            </div>
          </div>
          <div className="form-grid-2col" style={{ gap: '0.5rem' }}>
            <select
              value={assignRoom}
              onChange={e => setAssignRoom(e.target.value)}
              style={{
                padding: '0.4rem 0.5rem', background: 'var(--color-surface-0)',
                border: '1px solid var(--color-surface-1)', borderRadius: '6px',
                color: 'var(--color-text)', fontSize: '0.8rem',
              }}
            >
              <option value="">Assign to room...</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select
              value={assignCategory}
              onChange={e => setAssignCategory(e.target.value)}
              style={{
                padding: '0.4rem 0.5rem', background: 'var(--color-surface-0)',
                border: '1px solid var(--color-surface-1)', borderRadius: '6px',
                color: 'var(--color-text)', fontSize: '0.8rem',
              }}
            >
              <option value="">Auto-assign category</option>
              <option value="climate">Climate</option>
              <option value="lighting">Lighting</option>
              <option value="security">Security</option>
              <option value="sensor">Sensor</option>
              <option value="media">Media</option>
              <option value="printer">Printer</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        {/* Entity List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1.25rem' }}>
          {loading && (
            <p style={{ color: 'var(--color-subtext-0)', textAlign: 'center', padding: '2rem' }}>
              Discovering devices...
            </p>
          )}
          {error && (
            <p style={{ color: 'var(--color-red)', textAlign: 'center', padding: '1rem' }}>
              {error}
            </p>
          )}
          {!loading && !error && Object.entries(filteredDomains).map(([domain, entities]) => {
            const Icon = DOMAIN_ICONS[domain] || Eye
            const isExpanded = expandedDomains.has(domain)
            const unregistered = entities.filter(e => !e.is_registered)
            const allSelected = unregistered.length > 0 && unregistered.every(e => selected.has(e.entity_id))

            return (
              <div key={domain} style={{ marginBottom: '0.5rem' }}>
                {/* Domain Header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.5rem 0', cursor: 'pointer', userSelect: 'none',
                  }}
                  onClick={() => toggleDomain(domain)}
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <Icon size={16} style={{ color: 'var(--color-blue)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'capitalize' }}>
                    {domain.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                    ({entities.length})
                  </span>
                  {unregistered.length > 0 && (
                    <button
                      onClick={e => { e.stopPropagation(); selectAllInDomain(domain, entities) }}
                      style={{
                        marginLeft: 'auto', fontSize: '0.7rem', padding: '0.15rem 0.4rem',
                        background: allSelected ? 'var(--color-blue)' : 'var(--color-surface-0)',
                        color: allSelected ? '#000' : 'var(--color-subtext-0)',
                        border: 'none', borderRadius: '4px', cursor: 'pointer',
                      }}
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>

                {/* Entities */}
                {isExpanded && entities.map(entity => (
                  <div
                    key={entity.entity_id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.4rem 0.5rem 0.4rem 2rem',
                      opacity: entity.is_registered ? 0.5 : 1,
                      fontSize: '0.8rem',
                      minHeight: '36px',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(entity.entity_id)}
                      disabled={entity.is_registered}
                      onChange={() => toggleEntity(entity.entity_id)}
                      style={{
                        cursor: entity.is_registered ? 'not-allowed' : 'pointer',
                        flexShrink: 0,
                        width: '16px',
                        height: '16px',
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <div style={{
                        fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', lineHeight: 1.3,
                      }}>
                        {entity.friendly_name}
                      </div>
                      <div style={{
                        fontSize: '0.7rem', color: 'var(--color-subtext-0)',
                        fontFamily: "'JetBrains Mono', monospace",
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                      }}>
                        {entity.entity_id}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.7rem', padding: '0.1rem 0.3rem',
                      borderRadius: '4px', flexShrink: 0, whiteSpace: 'nowrap',
                      background: entity.state === 'unavailable' ? 'rgba(243, 139, 168, 0.15)' : 'var(--color-surface-0)',
                      color: entity.state === 'unavailable' ? 'var(--color-red)' : 'var(--color-subtext-0)',
                    }}>
                      {entity.state}
                    </span>
                    {entity.is_registered && (
                      <Check size={14} style={{ color: 'var(--color-green)', flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid var(--color-surface-0)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
            {selected.size} selected
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
            >
              <Download size={16} />
              {importing ? 'Importing...' : `Import ${selected.size} Device${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
