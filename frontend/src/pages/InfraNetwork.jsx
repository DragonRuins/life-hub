/**
 * InfraNetwork.jsx - Network Devices Page
 *
 * CRUD for routers, switches, access points, and other network devices.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Wifi, Plus, X, Edit3, Trash2, ArrowLeft } from 'lucide-react'
import { infrastructure } from '../api/client'

export default function InfraNetwork() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

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
    if (!confirm(`Delete "${device.name}"?`)) return
    try {
      await infrastructure.network.delete(device.id)
      await loadDevices()
    } catch (err) {
      alert('Failed to delete device: ' + err.message)
    }
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <Link to="/infrastructure" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-subtext-0)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Infrastructure
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Network Devices</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Routers, switches, access points, and firewalls
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null) }}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Device'}
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showForm || editing) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <NetworkDeviceForm
            initial={editing || {}}
            onSubmit={editing ? handleUpdate : handleAdd}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </div>
      )}

      {/* Device List */}
      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
      ) : devices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Wifi size={40} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)' }}>No network devices yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {devices.map(d => (
            <div key={d.id} className="card" style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(148, 226, 213, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Wifi size={16} style={{ color: 'var(--color-teal)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                  {d.device_type}{d.manufacturer ? ` / ${d.manufacturer}` : ''}{d.ip_address ? ` / ${d.ip_address}` : ''}
                </div>
              </div>
              <div style={{
                fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                color: d.status === 'online' ? 'var(--color-green)' : 'var(--color-overlay-0)',
                background: d.status === 'online' ? 'rgba(166, 227, 161, 0.12)' : 'rgba(108, 112, 134, 0.12)',
                padding: '0.2rem 0.5rem', borderRadius: '4px',
              }}>
                {d.status}
              </div>
              <button className="btn btn-ghost" style={{ padding: '0.375rem' }} onClick={() => { setEditing(d); setShowForm(false) }}>
                <Edit3 size={14} />
              </button>
              <button className="btn btn-ghost" style={{ padding: '0.375rem', color: 'var(--color-red)' }} onClick={() => handleDelete(d)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


const DEVICE_TYPES = [
  { value: 'router', label: 'Router' },
  { value: 'switch', label: 'Switch' },
  { value: 'ap', label: 'Access Point' },
  { value: 'firewall', label: 'Firewall' },
  { value: 'modem', label: 'Modem' },
  { value: 'other', label: 'Other' },
]

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
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        {initial.id ? 'Edit Device' : 'Add Device'}
      </h3>
      <div className="form-grid-2col">
        <div>
          <label style={labelStyle}>Name *</label>
          <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g., Main Router" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Type *</label>
          <select name="device_type" value={form.device_type} onChange={handleChange} style={inputStyle}>
            {DEVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>IP Address</label>
          <input name="ip_address" value={form.ip_address} onChange={handleChange} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>MAC Address</label>
          <input name="mac_address" value={form.mac_address} onChange={handleChange} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Manufacturer</label>
          <input name="manufacturer" value={form.manufacturer} onChange={handleChange} placeholder="e.g., Ubiquiti" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Model</label>
          <input name="model" value={form.model} onChange={handleChange} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input name="location" value={form.location} onChange={handleChange} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <label style={labelStyle}>Notes</label>
        <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <button type="submit" className="btn btn-primary">{initial.id ? 'Save' : 'Add Device'}</button>
        {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

const labelStyle = {
  display: 'block', fontSize: '0.8rem', fontWeight: 500,
  color: 'var(--color-subtext-0)', marginBottom: '0.375rem',
}
const inputStyle = {
  width: '100%', padding: '0.5rem 0.75rem',
  background: 'var(--color-crust)', border: '1px solid var(--color-surface-0)',
  borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.875rem', fontFamily: 'inherit',
}
