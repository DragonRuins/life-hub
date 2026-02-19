/**
 * InfraHostForm.jsx - Add/Edit Infrastructure Host Form
 *
 * Passes data to parent via onSubmit(data) callback.
 * Parent handles the API call (prevents double-submit).
 */
import { useState } from 'react'

const HOST_TYPES = [
  { value: 'server', label: 'Server' },
  { value: 'vm', label: 'Virtual Machine' },
  { value: 'vps', label: 'VPS' },
  { value: 'raspberry_pi', label: 'Raspberry Pi' },
  { value: 'nas', label: 'NAS' },
  { value: 'workstation', label: 'Workstation' },
  { value: 'other', label: 'Other' },
]

export default function InfraHostForm({ initial = {}, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    hostname: initial.hostname || '',
    host_type: initial.host_type || 'server',
    ip_address: initial.ip_address || '',
    mac_address: initial.mac_address || '',
    os_name: initial.os_name || '',
    os_version: initial.os_version || '',
    location: initial.location || '',
    status: initial.status || 'unknown',
    notes: initial.notes || '',
    // Hardware specs stored as JSON
    cpu: initial.hardware?.cpu || '',
    ram_gb: initial.hardware?.ram_gb || '',
    disk_gb: initial.hardware?.disk_gb || '',
    gpu: initial.hardware?.gpu || '',
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    // Build hardware JSON from individual fields
    const hardware = {}
    if (form.cpu) hardware.cpu = form.cpu
    if (form.ram_gb) hardware.ram_gb = Number(form.ram_gb)
    if (form.disk_gb) hardware.disk_gb = Number(form.disk_gb)
    if (form.gpu) hardware.gpu = form.gpu

    onSubmit({
      name: form.name,
      hostname: form.hostname || null,
      host_type: form.host_type,
      ip_address: form.ip_address || null,
      mac_address: form.mac_address || null,
      os_name: form.os_name || null,
      os_version: form.os_version || null,
      location: form.location || null,
      status: form.status,
      hardware,
      notes: form.notes || null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        {initial.id ? 'Edit Host' : 'Add Host'}
      </h3>

      <div className="form-grid-2col">
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="e.g., HexOS Thinkpad"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Type *</label>
          <select name="host_type" value={form.host_type} onChange={handleChange} style={inputStyle}>
            {HOST_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Hostname</label>
          <input name="hostname" value={form.hostname} onChange={handleChange}
                 placeholder="e.g., hexos.local" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>IP Address</label>
          <input name="ip_address" value={form.ip_address} onChange={handleChange}
                 placeholder="e.g., 192.168.1.100" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>MAC Address</label>
          <input name="mac_address" value={form.mac_address} onChange={handleChange}
                 placeholder="e.g., AA:BB:CC:DD:EE:FF" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="degraded">Degraded</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>OS Name</label>
          <input name="os_name" value={form.os_name} onChange={handleChange}
                 placeholder="e.g., TrueNAS SCALE" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>OS Version</label>
          <input name="os_version" value={form.os_version} onChange={handleChange}
                 placeholder="e.g., 24.10" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Location</label>
          <input name="location" value={form.location} onChange={handleChange}
                 placeholder="e.g., Office closet" style={inputStyle} />
        </div>
      </div>

      {/* Hardware specs */}
      <h4 style={{ marginTop: '1.25rem', marginBottom: '0.75rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-subtext-0)' }}>
        Hardware Specs
      </h4>
      <div className="form-grid-2col">
        <div>
          <label style={labelStyle}>CPU</label>
          <input name="cpu" value={form.cpu} onChange={handleChange}
                 placeholder="e.g., Intel i7-1165G7" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>RAM (GB)</label>
          <input name="ram_gb" type="number" value={form.ram_gb} onChange={handleChange}
                 placeholder="e.g., 32" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Disk (GB)</label>
          <input name="disk_gb" type="number" value={form.disk_gb} onChange={handleChange}
                 placeholder="e.g., 1000" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>GPU</label>
          <input name="gpu" value={form.gpu} onChange={handleChange}
                 placeholder="e.g., Intel Iris Xe" style={inputStyle} />
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginTop: '1rem' }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={3}
          placeholder="Additional notes about this host..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <button type="submit" className="btn btn-primary">
          {initial.id ? 'Save Changes' : 'Add Host'}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        )}
      </div>
    </form>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 500,
  color: 'var(--color-subtext-0)',
  marginBottom: '0.375rem',
}

const inputStyle = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'var(--color-crust)',
  border: '1px solid var(--color-surface-0)',
  borderRadius: '6px',
  color: 'var(--color-text)',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
}
