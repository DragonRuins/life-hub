/**
 * InfraIncidentForm.jsx - Create/Edit Incident Form
 *
 * Passes data to parent via onSubmit(data) callback.
 * Parent handles the API call (prevents double-submit).
 */
import { useState } from 'react'

export default function InfraIncidentForm({ initial = {}, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: initial.title || '',
    description: initial.description || '',
    severity: initial.severity || 'medium',
    status: initial.status || 'active',
    resolution: initial.resolution || '',
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      title: form.title,
      description: form.description || null,
      severity: form.severity,
      status: form.status,
      resolution: form.resolution || null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        {initial.id ? 'Edit Incident' : 'Log Incident'}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <label style={labelStyle}>Title *</label>
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            required
            placeholder="e.g., HexOS unresponsive"
            style={inputStyle}
          />
        </div>

        <div className="form-grid-2col">
          <div>
            <label style={labelStyle}>Severity</label>
            <select name="severity" value={form.severity} onChange={handleChange} style={inputStyle}>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
              <option value="active">Active</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            placeholder="What happened?"
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>

        {(form.status === 'resolved' || initial.resolution) && (
          <div>
            <label style={labelStyle}>Resolution</label>
            <textarea
              name="resolution"
              value={form.resolution}
              onChange={handleChange}
              rows={2}
              placeholder="How was it fixed?"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <button type="submit" className="btn btn-primary">
          {initial.id ? 'Save Changes' : 'Log Incident'}
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
