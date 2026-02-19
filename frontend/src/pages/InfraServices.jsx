/**
 * InfraServices.jsx - Monitored Services Page
 *
 * CRUD for web services/endpoints with health status tracking.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Globe, Plus, X, Edit3, Trash2, ArrowLeft, Play } from 'lucide-react'
import { infrastructure } from '../api/client'

export default function InfraServices() {
  const [services, setServices] = useState([])
  const [hosts, setHosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  async function loadData() {
    try {
      const [s, h] = await Promise.all([
        infrastructure.services.list(),
        infrastructure.hosts.list(),
      ])
      setServices(s)
      setHosts(h)
    } catch (err) {
      console.error('Failed to load services:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleAdd(data) {
    try {
      await infrastructure.services.create(data)
      await loadData()
      setShowForm(false)
    } catch (err) {
      alert('Failed to add service: ' + err.message)
    }
  }

  async function handleUpdate(data) {
    try {
      await infrastructure.services.update(editing.id, data)
      await loadData()
      setEditing(null)
    } catch (err) {
      alert('Failed to update service: ' + err.message)
    }
  }

  async function handleDelete(service) {
    if (!confirm(`Delete "${service.name}"?`)) return
    try {
      await infrastructure.services.delete(service.id)
      await loadData()
    } catch (err) {
      alert('Failed to delete service: ' + err.message)
    }
  }

  async function handleCheck(service) {
    try {
      const result = await infrastructure.services.check(service.id)
      alert(result.message)
    } catch (err) {
      alert('Check failed: ' + err.message)
    }
  }

  const statusColors = {
    up: 'var(--color-green)',
    down: 'var(--color-red)',
    degraded: 'var(--color-yellow)',
    unknown: 'var(--color-overlay-0)',
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <Link to="/infrastructure" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-subtext-0)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Infrastructure
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Services</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Monitored web services and endpoints
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null) }}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Service'}
        </button>
      </div>

      {(showForm || editing) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <ServiceForm
            initial={editing || {}}
            hosts={hosts}
            onSubmit={editing ? handleUpdate : handleAdd}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
      ) : services.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Globe size={40} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)' }}>No services yet. Add one to start monitoring.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {services.map(s => {
            const sc = statusColors[s.status] || statusColors.unknown
            return (
              <div key={s.id} className="card" style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: sc, flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.url || 'No URL'}{s.last_check_at ? ` / Last: ${new Date(s.last_check_at).toLocaleString()}` : ''}
                  </div>
                </div>
                {s.last_response_time_ms != null && (
                  <span style={{ fontSize: '0.8rem', fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-subtext-0)' }}>
                    {s.last_response_time_ms}ms
                  </span>
                )}
                <div style={{
                  fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', color: sc,
                  background: `${sc}12`, padding: '0.2rem 0.5rem', borderRadius: '4px',
                }}>
                  {s.status}
                </div>
                <button className="btn btn-ghost" style={{ padding: '0.375rem' }} title="Check now" onClick={() => handleCheck(s)}>
                  <Play size={14} />
                </button>
                <button className="btn btn-ghost" style={{ padding: '0.375rem' }} onClick={() => { setEditing(s); setShowForm(false) }}>
                  <Edit3 size={14} />
                </button>
                <button className="btn btn-ghost" style={{ padding: '0.375rem', color: 'var(--color-red)' }} onClick={() => handleDelete(s)}>
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function ServiceForm({ initial = {}, hosts = [], onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    url: initial.url || '',
    service_type: initial.service_type || 'http',
    host_id: initial.host_id || '',
    is_monitored: initial.is_monitored !== false,
    check_interval_seconds: initial.check_interval_seconds || 300,
    expected_status: initial.expected_status || 200,
    notes: initial.notes || '',
  })

  function handleChange(e) {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [e.target.name]: val })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      host_id: form.host_id ? Number(form.host_id) : null,
      check_interval_seconds: Number(form.check_interval_seconds),
      expected_status: Number(form.expected_status),
      url: form.url || null,
      notes: form.notes || null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        {initial.id ? 'Edit Service' : 'Add Service'}
      </h3>
      <div className="form-grid-2col">
        <div>
          <label style={labelStyle}>Name *</label>
          <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g., Dockge" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>URL</label>
          <input name="url" value={form.url} onChange={handleChange} placeholder="https://..." style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Host</label>
          <select name="host_id" value={form.host_id} onChange={handleChange} style={inputStyle}>
            <option value="">None</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Check Interval (sec)</label>
          <input name="check_interval_seconds" type="number" value={form.check_interval_seconds} onChange={handleChange} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Expected Status Code</label>
          <input name="expected_status" type="number" value={form.expected_status} onChange={handleChange} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input type="checkbox" name="is_monitored" checked={form.is_monitored} onChange={handleChange} />
            Enable monitoring
          </label>
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        <label style={labelStyle}>Notes</label>
        <textarea name="notes" value={form.notes} onChange={handleChange} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <button type="submit" className="btn btn-primary">{initial.id ? 'Save' : 'Add Service'}</button>
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
