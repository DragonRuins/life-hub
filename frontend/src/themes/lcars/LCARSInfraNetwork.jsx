/**
 * LCARSInfraNetwork.jsx - LCARS Network Topology Page
 *
 * Network devices management in LCARS visual language.
 * Full CRUD for routers, switches, APs, firewalls, modems, etc.
 * Uses lilac accent for the network subsystem, green/tomato for status.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Wifi, Plus, X, Edit3, Trash2, ArrowLeft } from 'lucide-react'
import { infrastructure } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

// Device type options
const DEVICE_TYPES = [
  { value: 'router', label: 'Router' },
  { value: 'switch', label: 'Switch' },
  { value: 'ap', label: 'Access Point' },
  { value: 'firewall', label: 'Firewall' },
  { value: 'modem', label: 'Modem' },
  { value: 'other', label: 'Other' },
]

// LCARS-canonical status colors
const STATUS_COLORS = {
  online: 'var(--lcars-green)',
  offline: 'var(--lcars-tomato)',
  unknown: 'var(--lcars-gray)',
}

// ── LCARS input/label styling ─────────────────────────────────────
const lcarsInputStyle = {
  background: 'rgba(102, 102, 136, 0.1)',
  border: '1px solid rgba(102, 102, 136, 0.3)',
  borderRadius: '4px',
  color: 'var(--lcars-space-white)',
  fontSize: '0.85rem',
  fontFamily: "'JetBrains Mono', monospace",
  padding: '0.5rem 0.75rem',
  width: '100%',
}

const lcarsLabelStyle = {
  fontFamily: "'Antonio', sans-serif",
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--lcars-gray)',
  marginBottom: '0.25rem',
  display: 'block',
}

// ── Inline Network Device Form ────────────────────────────────────
/**
 * NetworkDeviceForm - LCARS-styled form for adding/editing network devices.
 *
 * This form does NOT call the API directly. It passes the form data
 * to the parent via the onSubmit callback, following the project's
 * form pattern to prevent double-submission.
 *
 * Props:
 *   initial  - Existing device data for edit mode (empty obj for add)
 *   onSubmit - Callback receiving the form data object
 *   onCancel - Callback to close the form
 */
function NetworkDeviceForm({ initial = {}, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    device_type: initial.device_type || 'router',
    ip_address: initial.ip_address || '',
    mac_address: initial.mac_address || '',
    manufacturer: initial.manufacturer || '',
    model: initial.model || '',
    firmware_version: initial.firmware_version || '',
    location: initial.location || '',
    status: initial.status || 'unknown',
    notes: initial.notes || '',
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    // Pass data to parent -- nullify empty optional fields
    onSubmit({
      ...form,
      ip_address: form.ip_address || null,
      mac_address: form.mac_address || null,
      manufacturer: form.manufacturer || null,
      model: form.model || null,
      firmware_version: form.firmware_version || null,
      location: form.location || null,
      notes: form.notes || null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-2col">
        {/* Name (required) */}
        <div>
          <label style={lcarsLabelStyle}>Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="e.g., Core Router"
            style={lcarsInputStyle}
          />
        </div>

        {/* Device Type (required) */}
        <div>
          <label style={lcarsLabelStyle}>Device Type *</label>
          <select
            name="device_type"
            value={form.device_type}
            onChange={handleChange}
            style={lcarsInputStyle}
          >
            {DEVICE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* IP Address */}
        <div>
          <label style={lcarsLabelStyle}>IP Address</label>
          <input
            name="ip_address"
            value={form.ip_address}
            onChange={handleChange}
            placeholder="192.168.1.1"
            style={lcarsInputStyle}
          />
        </div>

        {/* MAC Address */}
        <div>
          <label style={lcarsLabelStyle}>MAC Address</label>
          <input
            name="mac_address"
            value={form.mac_address}
            onChange={handleChange}
            placeholder="AA:BB:CC:DD:EE:FF"
            style={lcarsInputStyle}
          />
        </div>

        {/* Manufacturer */}
        <div>
          <label style={lcarsLabelStyle}>Manufacturer</label>
          <input
            name="manufacturer"
            value={form.manufacturer}
            onChange={handleChange}
            placeholder="e.g., Ubiquiti"
            style={lcarsInputStyle}
          />
        </div>

        {/* Model */}
        <div>
          <label style={lcarsLabelStyle}>Model</label>
          <input
            name="model"
            value={form.model}
            onChange={handleChange}
            placeholder="e.g., USG-Pro-4"
            style={lcarsInputStyle}
          />
        </div>

        {/* Firmware Version */}
        <div>
          <label style={lcarsLabelStyle}>Firmware Version</label>
          <input
            name="firmware_version"
            value={form.firmware_version}
            onChange={handleChange}
            placeholder="e.g., 4.4.56"
            style={lcarsInputStyle}
          />
        </div>

        {/* Location */}
        <div>
          <label style={lcarsLabelStyle}>Location</label>
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="e.g., Server Rack A"
            style={lcarsInputStyle}
          />
        </div>

        {/* Status */}
        <div>
          <label style={lcarsLabelStyle}>Status</label>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            style={lcarsInputStyle}
          >
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>

      {/* Notes (full width) */}
      <div style={{ marginTop: '0.75rem' }}>
        <label style={lcarsLabelStyle}>Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={2}
          placeholder="Additional notes..."
          style={{ ...lcarsInputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
        <button
          type="submit"
          className="lcars-element button rounded auto"
          style={{
            padding: '0.4rem 1rem',
            background: 'var(--lcars-lilac)',
            border: 'none',
            fontSize: '0.8rem',
            height: 'auto',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {initial.id ? 'Update Device' : 'Register Device'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="lcars-element button rounded auto"
            style={{
              padding: '0.4rem 1rem',
              background: 'rgba(102, 102, 136, 0.2)',
              border: '1px solid rgba(102, 102, 136, 0.3)',
              fontSize: '0.8rem',
              height: 'auto',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

// ── Main Component ────────────────────────────────────────────────
export default function LCARSInfraNetwork() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  // Load all network devices from the API
  async function loadDevices() {
    try {
      const data = await infrastructure.network.list()
      setDevices(data)
    } catch (err) {
      console.error('Failed to load network devices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDevices() }, [])

  // ── Handlers ──────────────────────────────────────────────────
  // Parent handles the API call; form just passes data up.

  async function handleAdd(data) {
    try {
      await infrastructure.network.create(data)
      await loadDevices()
      setShowForm(false)
    } catch (err) {
      alert('Failed to add device: ' + err.message)
    }
  }

  async function handleUpdate(data) {
    try {
      await infrastructure.network.update(editing.id, data)
      await loadDevices()
      setEditing(null)
    } catch (err) {
      alert('Failed to update device: ' + err.message)
    }
  }

  async function handleDelete(device) {
    if (!confirm(`Delete "${device.name}"? This action cannot be undone.`)) return
    try {
      await infrastructure.network.delete(device.id)
      await loadDevices()
    } catch (err) {
      alert('Failed to delete device: ' + err.message)
    }
  }

  // ── Loading State ─────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-ice)',
          fontSize: '0.9rem',
        }}>
          SCANNING NETWORK TOPOLOGY...
        </div>
      </div>
    )
  }

  // Count devices by status for the subtitle
  const onlineCount = devices.filter(d => d.status === 'online').length
  const offlineCount = devices.filter(d => d.status === 'offline').length

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Back link */}
      <Link
        to="/infrastructure"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--lcars-lilac)',
          fontSize: '0.8rem',
          fontFamily: "'Antonio', sans-serif",
          textDecoration: 'none',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '1rem',
          opacity: 0.85,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
      >
        <ArrowLeft size={14} /> Back to Infrastructure
      </Link>

      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '1.5rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--lcars-space-white)',
          }}>
            Network Topology
          </h1>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: 'var(--lcars-lilac)',
            marginTop: '0.25rem',
          }}>
            {devices.length} device{devices.length !== 1 ? 's' : ''}
            {' / '}
            <span style={{ color: 'var(--lcars-green)' }}>{onlineCount} online</span>
            {offlineCount > 0 && (
              <>
                {' / '}
                <span style={{ color: 'var(--lcars-tomato)' }}>{offlineCount} offline</span>
              </>
            )}
          </div>
        </div>

        {/* Add Device button (pill-shaped, LCARS style) */}
        <button
          onClick={() => { setShowForm(!showForm); setEditing(null) }}
          className="lcars-element button rounded auto"
          style={{
            display: 'inline-flex',
            gap: '0.375rem',
            padding: '0.4rem 0.75rem',
            background: showForm ? 'rgba(102, 102, 136, 0.3)' : 'var(--lcars-lilac)',
            border: 'none',
            fontSize: '0.8rem',
            height: 'auto',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.15s',
          }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Add Device'}
        </button>
      </div>

      {/* ── Add Device Form ─────────────────────────────────────── */}
      {showForm && !editing && (
        <LCARSPanel
          title="New Device Registration"
          color="var(--lcars-lilac)"
          style={{ marginBottom: '1.5rem' }}
        >
          <NetworkDeviceForm
            onSubmit={handleAdd}
            onCancel={() => setShowForm(false)}
          />
        </LCARSPanel>
      )}

      {/* ── Edit Device Form (inline) ──────────────────────────── */}
      {editing && (
        <LCARSPanel
          title={`Edit — ${editing.name}`}
          color="var(--lcars-lilac)"
          style={{ marginBottom: '1.5rem' }}
        >
          <NetworkDeviceForm
            initial={editing}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        </LCARSPanel>
      )}

      {/* ── Device List ─────────────────────────────────────────── */}
      {devices.length === 0 ? (
        <LCARSPanel title="Device Registry" color="var(--lcars-lilac)">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Wifi size={28} style={{ color: 'var(--lcars-gray)', marginBottom: '0.5rem' }} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem',
              color: 'var(--lcars-gray)',
            }}>
              No network devices registered
            </div>
          </div>
        </LCARSPanel>
      ) : (
        <LCARSPanel
          title={`Device Registry — ${devices.length} Entries`}
          color="var(--lcars-lilac)"
        >
          {devices.map(d => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 0.75rem',
                borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(102, 102, 136, 0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {/* Status dot */}
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: STATUS_COLORS[d.status] || STATUS_COLORS.unknown,
                flexShrink: 0,
              }} />

              {/* Device icon */}
              <Wifi size={14} style={{ color: 'var(--lcars-lilac)', flexShrink: 0 }} />

              {/* Name + metadata */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--lcars-space-white)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {d.name}
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.65rem',
                  color: 'var(--lcars-gray)',
                  marginTop: '2px',
                }}>
                  {DEVICE_TYPES.find(t => t.value === d.device_type)?.label || d.device_type}
                  {d.manufacturer ? ` / ${d.manufacturer}` : ''}
                  {d.model ? ` ${d.model}` : ''}
                </div>
              </div>

              {/* IP Address */}
              {d.ip_address && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'var(--lcars-ice)',
                  flexShrink: 0,
                }}>
                  {d.ip_address}
                </span>
              )}

              {/* Status badge */}
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.7rem',
                color: STATUS_COLORS[d.status] || STATUS_COLORS.unknown,
                textTransform: 'uppercase',
                flexShrink: 0,
              }}>
                {d.status}
              </span>

              {/* Edit button */}
              <button
                onClick={() => { setEditing(d); setShowForm(false) }}
                title="Edit device"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--lcars-lilac)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.7,
                  transition: 'opacity 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
              >
                <Edit3 size={14} />
              </button>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(d)}
                title="Delete device"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--lcars-tomato)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.7,
                  transition: 'opacity 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </LCARSPanel>
      )}
    </div>
  )
}
