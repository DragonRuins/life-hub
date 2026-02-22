/**
 * InfraSmartHome.jsx - Smart Home Dashboard (Catppuccin Theme)
 *
 * Room-based device dashboard showing all registered HomeAssistant
 * devices grouped by room with real-time cached states.
 * Includes device management, room management, HA entity discovery,
 * and bulk edit mode for multi-select operations.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Plus, X, Edit3, Trash2, Settings,
  Thermometer, Lightbulb, ToggleLeft, Wind, Lock, Eye, Tv,
  DoorOpen, Droplets, Zap, ChevronDown, ChevronRight, Search, Star,
  CheckSquare, Square,
} from 'lucide-react'
import { infrastructure } from '../api/client'
import SmartHomeDiscovery from '../components/SmartHomeDiscovery'

// Category options for the bulk-update dropdown
const CATEGORY_OPTIONS = [
  { value: 'climate', label: 'Climate' },
  { value: 'lighting', label: 'Lighting' },
  { value: 'security', label: 'Security' },
  { value: 'sensor', label: 'Sensor' },
  { value: 'media', label: 'Media' },
  { value: 'printer', label: 'Printer' },
  { value: 'general', label: 'General' },
]

// Icon lookup for device domains
const DOMAIN_ICONS = {
  sensor: Thermometer,
  binary_sensor: Eye,
  light: Lightbulb,
  switch: ToggleLeft,
  climate: Wind,
  lock: Lock,
  cover: DoorOpen,
  fan: Wind,
  media_player: Tv,
}

// Color coding for device states
function getStateColor(domain, state) {
  if (state === 'unavailable') return 'var(--color-red)'
  if (state === 'unknown') return 'var(--color-overlay-0)'

  if (domain === 'light' || domain === 'switch') {
    return state === 'on' ? 'var(--color-yellow)' : 'var(--color-overlay-0)'
  }
  if (domain === 'binary_sensor') {
    return state === 'on' ? 'var(--color-peach)' : 'var(--color-green)'
  }
  if (domain === 'lock') {
    return state === 'locked' ? 'var(--color-green)' : 'var(--color-red)'
  }
  return 'var(--color-blue)'
}

export default function InfraSmartHome() {
  const [dashboard, setDashboard] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
  const [collapsedRooms, setCollapsedRooms] = useState(new Set())
  const intervalRef = useRef(null)
  const sseRef = useRef(null)

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [selectedDevices, setSelectedDevices] = useState(new Set())

  async function loadData() {
    try {
      const [dashData, roomsData] = await Promise.all([
        infrastructure.smarthome.dashboard(),
        infrastructure.smarthome.rooms.list(),
      ])
      setDashboard(dashData)
      setRooms(roomsData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Auto-refresh every 60 seconds (fallback for missed SSE events)
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadData, 60000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh])

  // SSE: subscribe to real-time state changes
  useEffect(() => {
    sseRef.current = infrastructure.smarthome.stream.connect(
      (event) => {
        if (event.type !== 'state_changed') return
        // Patch the matching device in dashboard state by entity_id
        setDashboard(prev => {
          if (!prev) return prev
          const patchDevice = (devices) =>
            devices.map(d =>
              d.entity_id === event.entity_id
                ? { ...d, last_state: event.state, last_attributes: event.attributes }
                : d
            )
          return {
            ...prev,
            rooms: (prev.rooms || []).map(room => ({
              ...room,
              devices: patchDevice(room.devices || []),
            })),
            unassigned: patchDevice(prev.unassigned || []),
          }
        })
      },
      () => {} // silent error -- fallback polling covers us
    )
    return () => sseRef.current?.close()
  }, [])

  async function handleSync() {
    try {
      await infrastructure.smarthome.sync()
      await loadData()
    } catch (err) {
      alert('Sync failed: ' + err.message)
    }
  }

  async function handleDeleteDevice(device) {
    if (!confirm(`Remove "${device.friendly_name || device.entity_id}" from smart home?`)) return
    try {
      await infrastructure.smarthome.devices.delete(device.id)
      await loadData()
    } catch (err) {
      alert('Failed to remove device: ' + err.message)
    }
  }

  async function handleToggleDevice(device) {
    try {
      let action = 'toggle'
      if (device.domain === 'lock') {
        action = device.last_state === 'locked' ? 'unlock' : 'lock'
      }
      await infrastructure.smarthome.devices.control(device.id, { action })
      await loadData()
    } catch (err) {
      alert('Control failed: ' + err.message)
    }
  }

  async function handleToggleFavorite(device) {
    try {
      await infrastructure.smarthome.devices.favorite(device.id)
      await loadData()
    } catch (err) {
      alert('Failed to update favorite: ' + err.message)
    }
  }

  function toggleRoom(roomId) {
    setCollapsedRooms(prev => {
      const next = new Set(prev)
      if (next.has(roomId)) next.delete(roomId)
      else next.add(roomId)
      return next
    })
  }

  // ── Edit Mode: selection helpers ────────────────────────────

  function toggleDeviceSelection(id) {
    setSelectedDevices(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllInRoom(devices) {
    const ids = devices.map(d => d.id)
    setSelectedDevices(prev => {
      const next = new Set(prev)
      const allSelected = ids.every(id => next.has(id))
      if (allSelected) {
        ids.forEach(id => next.delete(id))
      } else {
        ids.forEach(id => next.add(id))
      }
      return next
    })
  }

  function clearSelection() {
    setSelectedDevices(new Set())
  }

  function toggleEditMode() {
    if (editMode) {
      // Exiting edit mode -- clear selection
      clearSelection()
    }
    setEditMode(prev => !prev)
  }

  // ── Edit Mode: bulk action handlers ─────────────────────────

  async function handleBulkUpdate(updates) {
    const ids = Array.from(selectedDevices)
    try {
      const result = await infrastructure.smarthome.devices.bulkUpdate(ids, updates)
      const msg = `Updated ${result.updated} device${result.updated !== 1 ? 's' : ''}`
      if (result.failed > 0) alert(`${msg}, ${result.failed} failed`)
      await loadData()
      clearSelection()
    } catch (err) {
      alert('Bulk update failed: ' + err.message)
    }
  }

  async function handleBulkDelete() {
    const count = selectedDevices.size
    if (!confirm(`Delete ${count} selected device${count !== 1 ? 's' : ''}? This cannot be undone.`)) return
    const ids = Array.from(selectedDevices)
    try {
      const result = await infrastructure.smarthome.devices.bulkDelete(ids)
      const msg = `Deleted ${result.deleted} device${result.deleted !== 1 ? 's' : ''}`
      if (result.failed > 0) alert(`${msg}, ${result.failed} failed`)
      await loadData()
      clearSelection()
    } catch (err) {
      alert('Bulk delete failed: ' + err.message)
    }
  }

  if (loading) return <p style={{ color: 'var(--color-subtext-0)' }}>Loading smart home...</p>

  const dashRooms = dashboard?.rooms || []
  const unassigned = dashboard?.unassigned || []

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Animations */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/infrastructure" style={{ color: 'var(--color-subtext-0)', display: 'flex' }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Smart Home</h1>
            <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {dashboard?.total_devices || 0} devices registered
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {autoRefresh && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--color-green)', background: 'rgba(166, 227, 161, 0.1)',
              padding: '0.2rem 0.55rem', borderRadius: '4px',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--color-green)', animation: 'live-pulse 1.5s ease-in-out infinite',
              }} />
              LIVE
            </span>
          )}
          {/* Edit Mode toggle */}
          <button
            className="btn btn-ghost"
            onClick={toggleEditMode}
            style={editMode ? {
              background: 'rgba(203, 166, 247, 0.15)',
              borderColor: 'var(--color-mauve)',
              color: 'var(--color-mauve)',
            } : {}}
          >
            <Edit3 size={16} />
            {editMode ? 'Exit Edit' : 'Edit'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => setAutoRefresh(prev => !prev)}
            title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            style={autoRefresh ? { background: 'rgba(166, 227, 161, 0.12)', borderColor: 'var(--color-green)' } : {}}
          >
            <RefreshCw size={16} style={autoRefresh ? { color: 'var(--color-green)', animation: 'spin 2s linear infinite' } : {}} />
            Auto
          </button>
          <button className="btn btn-ghost" onClick={handleSync}>
            <RefreshCw size={16} /> Sync
          </button>
          <button className="btn btn-ghost" onClick={() => setShowRoomForm(true)}>
            <Plus size={16} /> Room
          </button>
          <button className="btn btn-primary" onClick={() => setShowDiscovery(true)}>
            <Search size={16} /> Add Devices
          </button>
        </div>
      </div>

      {/* Bulk Action Bar -- visible when edit mode active and devices selected */}
      {editMode && selectedDevices.size > 0 && (
        <BulkActionBar
          selectedCount={selectedDevices.size}
          rooms={rooms}
          onUpdate={handleBulkUpdate}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}

      {error && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderColor: 'var(--color-red)' }}>
          <p style={{ color: 'var(--color-red)', fontSize: '0.85rem' }}>{error}</p>
        </div>
      )}

      {/* No devices state */}
      {dashboard?.total_devices === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Thermometer size={40} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            No smart home devices registered yet
          </p>
          <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            Connect to HomeAssistant via Infrastructure &gt; Integrations, then discover and import devices here.
          </p>
          <button className="btn btn-primary" onClick={() => setShowDiscovery(true)}>
            <Search size={16} /> Discover Devices
          </button>
        </div>
      )}

      {/* Room Sections */}
      {dashRooms.map(room => {
        const isCollapsed = collapsedRooms.has(room.id)
        const devices = room.devices || []
        const roomDeviceIds = devices.map(d => d.id)
        const allRoomSelected = roomDeviceIds.length > 0 && roomDeviceIds.every(id => selectedDevices.has(id))

        return (
          <div key={room.id} className="card" style={{ marginBottom: '1rem' }}>
            {/* Room Header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', cursor: 'pointer', userSelect: 'none',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--color-surface-0)',
              }}
              onClick={() => toggleRoom(room.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{room.name}</h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                  ({devices.length} device{devices.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                {/* Select All button in edit mode */}
                {editMode && devices.length > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); selectAllInRoom(devices) }}
                    className="btn btn-ghost"
                    style={{
                      padding: '0.2rem 0.5rem', fontSize: '0.7rem',
                      color: allRoomSelected ? 'var(--color-mauve)' : 'var(--color-subtext-0)',
                      borderColor: allRoomSelected ? 'var(--color-mauve)' : undefined,
                    }}
                  >
                    {allRoomSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={e => { e.stopPropagation(); setEditingRoom(room) }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-subtext-0)', cursor: 'pointer', padding: '4px' }}
                >
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation()
                    if (confirm(`Delete room "${room.name}"? Devices will become unassigned.`)) {
                      infrastructure.smarthome.rooms.delete(room.id).then(loadData)
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-subtext-0)', cursor: 'pointer', padding: '4px' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Devices */}
            {!isCollapsed && (
              <div style={{ padding: '0.5rem' }}>
                {devices.length === 0 ? (
                  <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.8rem', padding: '0.5rem', textAlign: 'center' }}>
                    No devices in this room
                  </p>
                ) : (
                  <div className="card-grid" style={{ gap: '0.5rem' }}>
                    {devices.map(device => (
                      <DeviceCard
                        key={device.id}
                        device={device}
                        onDelete={() => handleDeleteDevice(device)}
                        onToggle={() => handleToggleDevice(device)}
                        onFavorite={() => handleToggleFavorite(device)}
                        isEditMode={editMode}
                        isSelected={selectedDevices.has(device.id)}
                        onSelectToggle={() => toggleDeviceSelection(device.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Unassigned Devices */}
      {unassigned.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-surface-0)',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-subtext-0)' }}>
              Unassigned ({unassigned.length})
            </h2>
            {editMode && unassigned.length > 0 && (
              <button
                onClick={() => selectAllInRoom(unassigned)}
                className="btn btn-ghost"
                style={{
                  padding: '0.2rem 0.5rem', fontSize: '0.7rem',
                  color: unassigned.every(d => selectedDevices.has(d.id)) ? 'var(--color-mauve)' : 'var(--color-subtext-0)',
                  borderColor: unassigned.every(d => selectedDevices.has(d.id)) ? 'var(--color-mauve)' : undefined,
                }}
              >
                {unassigned.every(d => selectedDevices.has(d.id)) ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>
          <div style={{ padding: '0.5rem' }}>
            <div className="card-grid" style={{ gap: '0.5rem' }}>
              {unassigned.map(device => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onDelete={() => handleDeleteDevice(device)}
                  onFavorite={() => handleToggleFavorite(device)}
                  isEditMode={editMode}
                  isSelected={selectedDevices.has(device.id)}
                  onSelectToggle={() => toggleDeviceSelection(device.id)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Discovery Modal */}
      {showDiscovery && (
        <SmartHomeDiscovery
          rooms={rooms}
          onImported={(result) => {
            setShowDiscovery(false)
            loadData()
          }}
          onClose={() => setShowDiscovery(false)}
        />
      )}

      {/* Room Form Modal */}
      {(showRoomForm || editingRoom) && (
        <RoomFormModal
          room={editingRoom}
          onSave={async (data) => {
            try {
              if (editingRoom) {
                await infrastructure.smarthome.rooms.update(editingRoom.id, data)
              } else {
                await infrastructure.smarthome.rooms.create(data)
              }
              await loadData()
              setShowRoomForm(false)
              setEditingRoom(null)
            } catch (err) {
              alert('Failed: ' + err.message)
            }
          }}
          onClose={() => { setShowRoomForm(false); setEditingRoom(null) }}
        />
      )}
    </div>
  )
}


/**
 * Bulk Action Bar - shown below header when devices are selected in edit mode.
 * Provides category, room, visibility, and delete actions.
 */
function BulkActionBar({ selectedCount, rooms, onUpdate, onDelete, onClear }) {
  return (
    <div
      className="card"
      style={{
        padding: '0.75rem 1rem',
        marginBottom: '1rem',
        border: '2px solid var(--color-mauve)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}
    >
      {/* Selected count */}
      <span style={{
        fontSize: '0.85rem', fontWeight: 600,
        color: 'var(--color-mauve)',
        whiteSpace: 'nowrap',
      }}>
        {selectedCount} selected
      </span>

      {/* Category dropdown */}
      <select
        defaultValue=""
        onChange={e => { if (e.target.value) { onUpdate({ category: e.target.value }); e.target.value = '' } }}
        style={{
          padding: '0.35rem 0.5rem', fontSize: '0.8rem',
          background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
          borderRadius: '6px', color: 'var(--color-text)', cursor: 'pointer',
        }}
      >
        <option value="" disabled>Set Category...</option>
        {CATEGORY_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Room dropdown */}
      <select
        defaultValue=""
        onChange={e => {
          if (e.target.value !== '') {
            const roomId = e.target.value === 'null' ? null : parseInt(e.target.value)
            onUpdate({ room_id: roomId })
            e.target.value = ''
          }
        }}
        style={{
          padding: '0.35rem 0.5rem', fontSize: '0.8rem',
          background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
          borderRadius: '6px', color: 'var(--color-text)', cursor: 'pointer',
        }}
      >
        <option value="" disabled>Move to Room...</option>
        <option value="null">Unassigned</option>
        {rooms.map(r => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      {/* Visibility toggles */}
      <button
        className="btn btn-ghost"
        onClick={() => onUpdate({ is_visible: false })}
        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
      >
        <Eye size={14} /> Hide
      </button>
      <button
        className="btn btn-ghost"
        onClick={() => onUpdate({ is_visible: true })}
        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
      >
        <Eye size={14} /> Show
      </button>

      {/* Delete -- pushed right */}
      <button
        className="btn btn-danger"
        onClick={onDelete}
        style={{ marginLeft: 'auto', padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
      >
        <Trash2 size={14} /> Delete
      </button>

      {/* Clear selection */}
      <button
        onClick={onClear}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-subtext-0)', padding: '4px',
        }}
        title="Clear selection"
      >
        <X size={16} />
      </button>
    </div>
  )
}


/**
 * Individual device card showing state, domain icon, value,
 * favorite star, and tap-to-toggle for controllable devices.
 * In edit mode, clicking toggles selection instead of controlling.
 */
const TOGGLEABLE_DOMAINS = new Set(['light', 'switch', 'fan', 'lock', 'cover'])

function DeviceCard({ device, onDelete, onToggle, onFavorite, isEditMode, isSelected, onSelectToggle }) {
  const Icon = DOMAIN_ICONS[device.domain] || Eye
  const stateColor = getStateColor(device.domain, device.last_state)
  const attrs = device.last_attributes || {}
  const unit = attrs.unit_of_measurement || ''
  const toggleable = TOGGLEABLE_DOMAINS.has(device.domain)

  // Format display value
  let displayValue = device.last_state || '\u2014'
  if (device.domain === 'sensor' && device.last_state && !isNaN(device.last_state)) {
    const num = parseFloat(device.last_state)
    displayValue = Number.isInteger(num) ? num.toString() : num.toFixed(1)
    if (unit) displayValue += ` ${unit}`
  }

  // In edit mode: click toggles selection. Normal mode: click toggles device.
  const handleClick = isEditMode ? onSelectToggle : (toggleable ? onToggle : undefined)

  return (
    <div
      onClick={handleClick}
      style={{
        background: 'var(--color-base)',
        border: isEditMode && isSelected
          ? '2px solid var(--color-mauve)'
          : '1px solid var(--color-surface-0)',
        borderRadius: '8px',
        padding: isEditMode && isSelected ? 'calc(0.75rem - 1px)' : '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        minWidth: 0,
        cursor: isEditMode ? 'pointer' : (toggleable ? 'pointer' : 'default'),
        transition: 'border-color 0.15s, background 0.15s',
        ...(isEditMode && isSelected ? { background: 'rgba(203, 166, 247, 0.06)' } : {}),
      }}
      onMouseEnter={e => {
        if (!isEditMode && toggleable) e.currentTarget.style.borderColor = stateColor
        if (isEditMode) e.currentTarget.style.background = 'rgba(203, 166, 247, 0.08)'
      }}
      onMouseLeave={e => {
        if (!isEditMode) e.currentTarget.style.borderColor = 'var(--color-surface-0)'
        if (isEditMode && !isSelected) e.currentTarget.style.background = 'var(--color-base)'
        if (isEditMode && isSelected) e.currentTarget.style.background = 'rgba(203, 166, 247, 0.06)'
      }}
    >
      {/* Checkbox in edit mode */}
      {isEditMode && (
        <div style={{ flexShrink: 0, color: isSelected ? 'var(--color-mauve)' : 'var(--color-overlay-0)' }}>
          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
        </div>
      )}

      <div style={{
        width: '32px', height: '32px', borderRadius: '8px',
        background: `color-mix(in srgb, ${stateColor} 12%, transparent)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon size={16} style={{ color: stateColor }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.8rem', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {device.friendly_name || device.entity_id}
        </div>
        <div style={{
          fontSize: '0.9rem', fontWeight: 600, color: stateColor,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {displayValue}
        </div>
      </div>

      {/* Favorite star -- hidden in edit mode */}
      {!isEditMode && onFavorite && (
        <button
          onClick={e => { e.stopPropagation(); onFavorite() }}
          title={device.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: device.is_favorited ? 'var(--color-yellow)' : 'var(--color-overlay-0)',
            padding: '4px', flexShrink: 0,
            transition: 'color 0.15s',
          }}
        >
          <Star size={14} fill={device.is_favorited ? 'var(--color-yellow)' : 'none'} />
        </button>
      )}

      {/* Remove device -- hidden in edit mode */}
      {!isEditMode && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Remove device"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-overlay-0)', padding: '4px', flexShrink: 0,
            opacity: 0.5, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.5'}
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}


/**
 * Modal for creating/editing rooms.
 */
function RoomFormModal({ room, onSave, onClose }) {
  const [name, setName] = useState(room?.name || '')
  const [icon, setIcon] = useState(room?.icon || 'home')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), icon })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.6)',
    }}
    onClick={onClose}
    >
      <div
        className="card"
        onClick={e => e.stopPropagation()}
        style={{ width: 'min(400px, calc(100vw - 2rem))', padding: '1.25rem' }}
      >
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
          {room ? 'Edit Room' : 'Add Room'}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
              Room Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Living Room"
              autoFocus
              style={{
                width: '100%', padding: '0.5rem',
                background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
                borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.9rem',
              }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
              Icon (Lucide name)
            </label>
            <input
              type="text"
              value={icon}
              onChange={e => setIcon(e.target.value)}
              placeholder="home"
              style={{
                width: '100%', padding: '0.5rem',
                background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
                borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.9rem',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
              {room ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
