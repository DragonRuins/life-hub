/**
 * LCARSInfraSmartHome.jsx - Environmental Controls (LCARS Theme)
 *
 * LCARS-themed smart home dashboard. Rooms displayed as LCARSPanels
 * with device readouts using LCARS sensor display styling.
 * Includes bulk edit mode for multi-select operations.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Plus, X, Edit3, Trash2, Search, Star,
  Thermometer, Lightbulb, ToggleLeft, Wind, Lock, Eye, Tv,
  DoorOpen, Droplets,
} from 'lucide-react'
import { infrastructure } from '../../api/client'
import LCARSPanel, { LCARSDataRow, LCARSStat } from './LCARSPanel'
import LCARSSmartHomeDiscovery from './LCARSSmartHomeDiscovery'

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

// LCARS color mapping for device states
function getStateColor(domain, state) {
  if (state === 'unavailable') return 'var(--lcars-tomato)'
  if (state === 'unknown') return 'var(--lcars-gray)'

  if (domain === 'light' || domain === 'switch') {
    return state === 'on' ? 'var(--lcars-gold)' : 'var(--lcars-gray)'
  }
  if (domain === 'binary_sensor') {
    return state === 'on' ? 'var(--lcars-butterscotch)' : 'var(--lcars-green)'
  }
  if (domain === 'lock') {
    return state === 'locked' ? 'var(--lcars-green)' : 'var(--lcars-tomato)'
  }
  return 'var(--lcars-ice)'
}

// Room panel color cycle
const ROOM_COLORS = [
  'var(--lcars-sunflower)',
  'var(--lcars-tanoi)',
  'var(--lcars-lilac)',
  'var(--lcars-butterscotch)',
  'var(--lcars-ice)',
  'var(--lcars-gold)',
  'var(--lcars-african-violet)',
]

// Shared LCARS pill button style
const lcarsButtonStyle = (bg) => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
  padding: '0.4rem 0.75rem', borderRadius: '999px',
  border: 'none', cursor: 'pointer',
  background: bg, color: 'var(--lcars-text-on-color)',
  fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
  opacity: 0.9,
})

// Shared LCARS select dropdown style
const lcarsSelectStyle = {
  padding: '0.35rem 0.5rem', fontSize: '0.8rem',
  background: '#000', border: '1px solid var(--lcars-tanoi)',
  borderRadius: '0', color: 'var(--lcars-space-white)',
  fontFamily: "'JetBrains Mono', monospace", cursor: 'pointer',
}

export default function LCARSInfraSmartHome() {
  const [dashboard, setDashboard] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showDiscovery, setShowDiscovery] = useState(false)
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [editingRoom, setEditingRoom] = useState(null)
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
      console.error('Failed to load smart home:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Fallback poll every 60s
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
      () => {}
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
    if (!confirm(`Remove "${device.friendly_name || device.entity_id}"?`)) return
    try {
      await infrastructure.smarthome.devices.delete(device.id)
      await loadData()
    } catch (err) {
      alert('Failed: ' + err.message)
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-ice)', fontSize: '0.9rem',
        }}>
          SCANNING ENVIRONMENTAL CONTROLS...
        </div>
      </div>
    )
  }

  const dashRooms = dashboard?.rooms || []
  const unassigned = dashboard?.unassigned || []

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Scan pulse animation */}
      {autoRefresh && (
        <style>{`
          @keyframes lcars-scan-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/infrastructure" style={{ color: 'var(--lcars-tanoi)', display: 'flex' }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '1.5rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              color: 'var(--lcars-space-white)',
            }}>
              Environmental Controls
            </h1>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem', color: 'var(--lcars-tanoi)', marginTop: '0.25rem',
            }}>
              {dashboard?.total_devices || 0} DEVICES REGISTERED
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Edit Mode toggle */}
          <button
            onClick={toggleEditMode}
            style={lcarsButtonStyle(editMode ? 'var(--lcars-african-violet)' : 'var(--lcars-lilac)')}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <Edit3 size={14} />
            {editMode ? 'Exit Edit' : 'Edit'}
          </button>
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            style={lcarsButtonStyle(autoRefresh ? 'var(--lcars-green)' : 'var(--lcars-tanoi)')}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <RefreshCw size={14} />
            {autoRefresh ? 'Auto: On' : 'Auto: Off'}
          </button>
          <button
            onClick={handleSync}
            style={lcarsButtonStyle('var(--lcars-ice)')}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <RefreshCw size={14} /> Sync
          </button>
          <button
            onClick={() => setShowRoomForm(true)}
            style={lcarsButtonStyle('var(--lcars-butterscotch)')}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <Plus size={14} /> Room
          </button>
          <button
            onClick={() => setShowDiscovery(true)}
            style={lcarsButtonStyle('var(--lcars-sunflower)')}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <Search size={14} /> Discover
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {editMode && selectedDevices.size > 0 && (
        <LCARSBulkActionBar
          selectedCount={selectedDevices.size}
          rooms={rooms}
          onUpdate={handleBulkUpdate}
          onDelete={handleBulkDelete}
          onClear={clearSelection}
        />
      )}

      {/* No devices state */}
      {dashboard?.total_devices === 0 && (
        <LCARSPanel title="No Devices Detected" color="var(--lcars-gray)">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Thermometer size={32} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: 'var(--lcars-gray)' }}>
              NO ENVIRONMENTAL SENSORS REGISTERED
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--lcars-gray)', marginTop: '0.5rem' }}>
              CONFIGURE HOMEASSISTANT INTEGRATION AND DISCOVER DEVICES
            </div>
          </div>
        </LCARSPanel>
      )}

      {/* Room Panels */}
      {dashRooms.map((room, idx) => {
        const color = ROOM_COLORS[idx % ROOM_COLORS.length]
        const devices = room.devices || []
        const roomDeviceIds = devices.map(d => d.id)
        const allRoomSelected = roomDeviceIds.length > 0 && roomDeviceIds.every(id => selectedDevices.has(id))

        return (
          <LCARSPanel
            key={room.id}
            title={room.name.toUpperCase()}
            color={color}
            style={{ marginBottom: '1.5rem' }}
            headerRight={
              <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                {/* Select All button in edit mode */}
                {editMode && devices.length > 0 && (
                  <button
                    onClick={() => selectAllInRoom(devices)}
                    style={{
                      ...lcarsButtonStyle(allRoomSelected ? 'var(--lcars-african-violet)' : 'var(--lcars-gray)'),
                      fontSize: '0.65rem', padding: '0.2rem 0.5rem',
                    }}
                  >
                    {allRoomSelected ? 'Deselect' : 'Select All'}
                  </button>
                )}
                <button
                  onClick={() => setEditingRoom(room)}
                  style={{ background: 'none', border: 'none', color: 'var(--lcars-text-on-color)', cursor: 'pointer', padding: '2px' }}
                >
                  <Edit3 size={12} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete room "${room.name}"?`)) {
                      infrastructure.smarthome.rooms.delete(room.id).then(loadData)
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--lcars-text-on-color)', cursor: 'pointer', padding: '2px' }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            }
          >
            {devices.length === 0 ? (
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-gray)', padding: '0.5rem' }}>
                NO DEVICES IN THIS SECTION
              </div>
            ) : (
              devices.map(device => (
                <LCARSDeviceRow
                  key={device.id}
                  device={device}
                  onDelete={() => handleDeleteDevice(device)}
                  onToggle={() => handleToggleDevice(device)}
                  onFavorite={() => handleToggleFavorite(device)}
                  isEditMode={editMode}
                  isSelected={selectedDevices.has(device.id)}
                  onSelectToggle={() => toggleDeviceSelection(device.id)}
                />
              ))
            )}
          </LCARSPanel>
        )
      })}

      {/* Unassigned Devices */}
      {unassigned.length > 0 && (
        <LCARSPanel
          title="Unassigned"
          color="var(--lcars-gray)"
          style={{ marginBottom: '1.5rem' }}
          headerRight={
            editMode && unassigned.length > 0 ? (
              <button
                onClick={() => selectAllInRoom(unassigned)}
                style={{
                  ...lcarsButtonStyle(
                    unassigned.every(d => selectedDevices.has(d.id))
                      ? 'var(--lcars-african-violet)' : 'var(--lcars-gray)'
                  ),
                  fontSize: '0.65rem', padding: '0.2rem 0.5rem',
                }}
              >
                {unassigned.every(d => selectedDevices.has(d.id)) ? 'Deselect' : 'Select All'}
              </button>
            ) : undefined
          }
        >
          {unassigned.map(device => (
            <LCARSDeviceRow
              key={device.id}
              device={device}
              onDelete={() => handleDeleteDevice(device)}
              onFavorite={() => handleToggleFavorite(device)}
              isEditMode={editMode}
              isSelected={selectedDevices.has(device.id)}
              onSelectToggle={() => toggleDeviceSelection(device.id)}
            />
          ))}
        </LCARSPanel>
      )}

      {/* Discovery Modal */}
      {showDiscovery && (
        <LCARSSmartHomeDiscovery
          rooms={rooms}
          onImported={() => { setShowDiscovery(false); loadData() }}
          onClose={() => setShowDiscovery(false)}
        />
      )}

      {/* Room Form Modal */}
      {(showRoomForm || editingRoom) && (
        <LCARSRoomFormModal
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
 * LCARS-styled bulk action bar displayed when devices are selected in edit mode.
 */
function LCARSBulkActionBar({ selectedCount, rooms, onUpdate, onDelete, onClear }) {
  return (
    <LCARSPanel
      title={`${selectedCount} SELECTED`}
      color="var(--lcars-african-violet)"
      style={{ marginBottom: '1.5rem' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        flexWrap: 'wrap', padding: '0.25rem 0',
      }}>
        {/* Category dropdown */}
        <select
          defaultValue=""
          onChange={e => { if (e.target.value) { onUpdate({ category: e.target.value }); e.target.value = '' } }}
          style={lcarsSelectStyle}
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
          style={lcarsSelectStyle}
        >
          <option value="" disabled>Move to Room...</option>
          <option value="null">Unassigned</option>
          {rooms.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        {/* Visibility toggles */}
        <button
          onClick={() => onUpdate({ is_visible: false })}
          style={lcarsButtonStyle('var(--lcars-tanoi)')}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
        >
          <Eye size={14} /> Hide
        </button>
        <button
          onClick={() => onUpdate({ is_visible: true })}
          style={lcarsButtonStyle('var(--lcars-ice)')}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
        >
          <Eye size={14} /> Show
        </button>

        {/* Delete -- pushed right */}
        <button
          onClick={onDelete}
          style={{ ...lcarsButtonStyle('var(--lcars-tomato)'), marginLeft: 'auto' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
        >
          <Trash2 size={14} /> Delete
        </button>

        {/* Clear selection */}
        <button
          onClick={onClear}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--lcars-gray)', padding: '4px',
          }}
          title="Clear selection"
        >
          <X size={16} />
        </button>
      </div>
    </LCARSPanel>
  )
}


/**
 * LCARS-styled device readout row with tap-to-toggle and favorite star.
 * In edit mode: click toggles selection, selected rows get african-violet accent.
 */
const TOGGLEABLE_DOMAINS = new Set(['light', 'switch', 'fan', 'lock', 'cover'])

function LCARSDeviceRow({ device, onDelete, onToggle, onFavorite, isEditMode, isSelected, onSelectToggle }) {
  const stateColor = getStateColor(device.domain, device.last_state)
  const attrs = device.last_attributes || {}
  const unit = attrs.unit_of_measurement || ''
  const toggleable = TOGGLEABLE_DOMAINS.has(device.domain)

  let displayValue = device.last_state || '\u2014'
  if (device.domain === 'sensor' && device.last_state && !isNaN(device.last_state)) {
    const num = parseFloat(device.last_state)
    displayValue = (Number.isInteger(num) ? num.toString() : num.toFixed(1))
    if (unit) displayValue += ` ${unit}`
  }

  // In edit mode: click toggles selection. Normal mode: click toggles device.
  const handleClick = isEditMode ? onSelectToggle : (toggleable ? onToggle : undefined)

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
        cursor: isEditMode ? 'pointer' : (toggleable ? 'pointer' : 'default'),
        transition: 'background 0.15s',
        ...(isEditMode && isSelected ? { background: 'rgba(170, 102, 204, 0.1)' } : {}),
      }}
      onMouseEnter={e => {
        if (!isEditMode && toggleable) e.currentTarget.style.background = 'rgba(255, 204, 153, 0.05)'
        if (isEditMode) e.currentTarget.style.background = 'rgba(170, 102, 204, 0.12)'
      }}
      onMouseLeave={e => {
        if (!isEditMode) e.currentTarget.style.background = 'transparent'
        if (isEditMode && !isSelected) e.currentTarget.style.background = 'transparent'
        if (isEditMode && isSelected) e.currentTarget.style.background = 'rgba(170, 102, 204, 0.1)'
      }}
    >
      {/* Accent block -- african-violet when selected in edit mode */}
      <div style={{
        width: '4px', height: '28px',
        background: isEditMode && isSelected ? 'var(--lcars-african-violet)' : stateColor,
        flexShrink: 0, transition: 'background 0.3s ease',
      }} />

      {/* Name -- bold white when selected */}
      <span style={{
        flex: 1, minWidth: 0,
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        fontSize: '0.8rem', textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: isEditMode && isSelected ? 'var(--lcars-space-white)' : 'var(--lcars-gray)',
        fontWeight: isEditMode && isSelected ? 700 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        transition: 'color 0.15s, font-weight 0.15s',
      }}>
        {device.friendly_name || device.entity_id}
      </span>

      {/* Value */}
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.85rem', fontWeight: 600,
        color: stateColor,
        flexShrink: 0,
      }}>
        {displayValue.toUpperCase()}
      </span>

      {/* Favorite star -- hidden in edit mode */}
      {!isEditMode && onFavorite && (
        <button
          onClick={e => { e.stopPropagation(); onFavorite() }}
          title={device.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: device.is_favorited ? 'var(--lcars-gold)' : 'var(--lcars-gray)',
            padding: '2px', flexShrink: 0,
            opacity: device.is_favorited ? 1 : 0.4,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = device.is_favorited ? '1' : '0.4'}
        >
          <Star size={12} fill={device.is_favorited ? 'var(--lcars-gold)' : 'none'} />
        </button>
      )}

      {/* Remove button -- hidden in edit mode */}
      {!isEditMode && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--lcars-gray)', padding: '2px', flexShrink: 0,
            opacity: 0.4, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}


/**
 * LCARS-styled room form modal
 */
function LCARSRoomFormModal({ room, onSave, onClose }) {
  const [name, setName] = useState(room?.name || '')
  const [icon, setIcon] = useState(room?.icon || 'home')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({ name: name.trim(), icon })
  }

  const inputStyle = {
    width: '100%', padding: '0.5rem',
    background: '#000', border: '1px solid var(--lcars-tanoi)',
    borderRadius: '0', color: 'var(--lcars-space-white)',
    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem',
  }

  const labelStyle = {
    fontFamily: "'Antonio', sans-serif",
    fontSize: '0.75rem', textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--lcars-tanoi)',
    display: 'block', marginBottom: '0.25rem',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.7)',
    }}
    onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        <LCARSPanel
          title={room ? 'Modify Section' : 'New Section'}
          color="var(--lcars-butterscotch)"
          style={{ width: 'min(400px, calc(100vw - 2rem))' }}
        >
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={labelStyle}>Section Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g., Main Living Area" autoFocus style={inputStyle} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Icon</label>
              <input type="text" value={icon} onChange={e => setIcon(e.target.value)}
                placeholder="home" style={inputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" onClick={onClose} style={{
                padding: '0.4rem 0.75rem', borderRadius: '999px',
                border: 'none', cursor: 'pointer',
                background: 'var(--lcars-gray)', color: 'var(--lcars-text-on-color)',
                fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
                fontWeight: 600, textTransform: 'uppercase',
              }}>
                Cancel
              </button>
              <button type="submit" disabled={!name.trim()} style={{
                padding: '0.4rem 0.75rem', borderRadius: '999px',
                border: 'none', cursor: 'pointer',
                background: name.trim() ? 'var(--lcars-butterscotch)' : 'var(--lcars-gray)',
                color: 'var(--lcars-text-on-color)',
                fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
                fontWeight: 600, textTransform: 'uppercase',
              }}>
                {room ? 'Confirm' : 'Create'}
              </button>
            </div>
          </form>
        </LCARSPanel>
      </div>
    </div>
  )
}
