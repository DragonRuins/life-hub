/**
 * InfraServiceForm.jsx - Add Service Form
 *
 * Passes data to parent via onSubmit(data) callback.
 * Parent handles the API call (prevents double-submit).
 * The host_id is NOT part of the form — the parent injects it.
 */
import { useState } from 'react'

const SERVICE_TYPES = [
  { value: 'http', label: 'HTTP' },
  { value: 'tcp', label: 'TCP' },
  { value: 'ping', label: 'Ping' },
]

const CHECK_INTERVALS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
]

export default function InfraServiceForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    url: '',
    service_type: 'http',
    expected_status: 200,
    check_interval: 300,
    monitoring_enabled: true,
    notes: '',
  })

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const data = {
      name: form.name,
      url: form.url,
      service_type: form.service_type,
      check_interval: Number(form.check_interval),
      monitoring_enabled: form.monitoring_enabled,
      notes: form.notes || null,
    }
    // Only include expected_status for HTTP services
    if (form.service_type === 'http') {
      data.expected_status = Number(form.expected_status)
    }
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        Add Service
      </h3>

      <div className="form-grid-2col">
        <div>
          <label style={labelStyle}>Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="e.g., Dockge"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>URL *</label>
          <input
            name="url"
            value={form.url}
            onChange={handleChange}
            required
            placeholder="e.g., https://myservice.local:8080"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Service Type</label>
          <select name="service_type" value={form.service_type} onChange={handleChange} style={inputStyle}>
            {SERVICE_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {form.service_type === 'http' && (
          <div>
            <label style={labelStyle}>Expected Status</label>
            <input
              name="expected_status"
              type="number"
              value={form.expected_status}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>
        )}
        <div>
          <label style={labelStyle}>Check Interval</label>
          <select name="check_interval" value={form.check_interval} onChange={handleChange} style={inputStyle}>
            {CHECK_INTERVALS.map(i => (
              <option key={i.value} value={i.value}>{i.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', paddingBottom: '0.5rem' }}>
            <input
              name="monitoring_enabled"
              type="checkbox"
              checked={form.monitoring_enabled}
              onChange={handleChange}
              style={{ width: '16px', height: '16px', accentColor: 'var(--color-blue)' }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>
              Enable Monitoring
            </span>
          </label>
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
          placeholder="Optional notes about this service..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <button type="submit" className="btn btn-primary">Add Service</button>
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
