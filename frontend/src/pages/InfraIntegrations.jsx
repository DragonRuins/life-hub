/**
 * InfraIntegrations.jsx - Integration Config Page
 *
 * Manage Docker, HomeAssistant, and Portainer integrations.
 * Dynamic forms based on integration type schemas.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Settings, Plus, X, ArrowLeft, Edit3, Trash2, Play, RefreshCw,
  CheckCircle, XCircle, Clock,
} from 'lucide-react'
import { infrastructure } from '../api/client'

export default function InfraIntegrations() {
  const [integrations, setIntegrations] = useState([])
  const [schemas, setSchemas] = useState({})
  const [hosts, setHosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [testing, setTesting] = useState(null)
  const [syncing, setSyncing] = useState(null)

  async function loadData() {
    try {
      const [i, s, h] = await Promise.all([
        infrastructure.integrations.list(),
        infrastructure.integrations.schemas(),
        infrastructure.hosts.list(),
      ])
      setIntegrations(i)
      setSchemas(s)
      setHosts(h)
    } catch (err) {
      console.error('Failed to load integrations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function handleAdd(data) {
    try {
      await infrastructure.integrations.create(data)
      await loadData()
      setShowForm(false)
    } catch (err) {
      alert('Failed to create integration: ' + err.message)
    }
  }

  async function handleUpdate(data) {
    try {
      await infrastructure.integrations.update(editing.id, data)
      await loadData()
      setEditing(null)
    } catch (err) {
      alert('Failed to update: ' + err.message)
    }
  }

  async function handleDelete(integration) {
    if (!confirm(`Delete "${integration.name}"?`)) return
    try {
      await infrastructure.integrations.delete(integration.id)
      await loadData()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  async function handleTest(integration) {
    setTesting(integration.id)
    try {
      const result = await infrastructure.integrations.test(integration.id)
      alert(result.message)
    } catch (err) {
      alert('Test failed: ' + err.message)
    } finally {
      setTesting(null)
    }
  }

  async function handleSync(integration) {
    setSyncing(integration.id)
    try {
      const result = await infrastructure.integrations.sync(integration.id)
      alert(result.message)
      await loadData()
    } catch (err) {
      alert('Sync failed: ' + err.message)
    } finally {
      setSyncing(null)
    }
  }

  const syncStatusIcons = {
    success: <CheckCircle size={14} style={{ color: 'var(--color-green)' }} />,
    error: <XCircle size={14} style={{ color: 'var(--color-red)' }} />,
    pending: <Clock size={14} style={{ color: 'var(--color-yellow)' }} />,
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <Link to="/infrastructure" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-subtext-0)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Infrastructure
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Integrations</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Docker, Home Assistant, and Portainer connections
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null) }}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Integration'}
        </button>
      </div>

      {/* Form */}
      {(showForm || editing) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <IntegrationForm
            initial={editing || {}}
            schemas={schemas}
            hosts={hosts}
            onSubmit={editing ? handleUpdate : handleAdd}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </div>
      )}

      {/* Integration List */}
      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
      ) : integrations.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Settings size={40} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)' }}>No integrations configured yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {integrations.map(i => (
            <div key={i.id} className="card" style={{ padding: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: i.is_enabled ? 'rgba(166, 227, 161, 0.1)' : 'rgba(108, 112, 134, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Settings size={18} style={{ color: i.is_enabled ? 'var(--color-green)' : 'var(--color-overlay-0)' }} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{i.name}</span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                      color: 'var(--color-subtext-0)', background: 'var(--color-surface-0)',
                      padding: '0.15rem 0.4rem', borderRadius: '3px',
                    }}>
                      {i.integration_type}
                    </span>
                    {!i.is_enabled && (
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-overlay-0)' }}>Disabled</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {i.last_sync_status && syncStatusIcons[i.last_sync_status]}
                    {i.last_sync_at ? `Last sync: ${new Date(i.last_sync_at).toLocaleString()}` : 'Never synced'}
                    {i.sync_interval_seconds && ` / Every ${i.sync_interval_seconds}s`}
                  </div>
                  {i.last_sync_error && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-red)', marginTop: '0.25rem' }}>
                      Error: {i.last_sync_error}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '0.375rem' }}
                    title="Test connection"
                    onClick={() => handleTest(i)}
                    disabled={testing === i.id}
                  >
                    <Play size={14} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '0.375rem' }}
                    title="Sync now"
                    onClick={() => handleSync(i)}
                    disabled={syncing === i.id}
                  >
                    <RefreshCw size={14} className={syncing === i.id ? 'animate-spin' : ''} />
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '0.375rem' }} onClick={() => { setEditing(i); setShowForm(false) }}>
                    <Edit3 size={14} />
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '0.375rem', color: 'var(--color-red)' }} onClick={() => handleDelete(i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function IntegrationForm({ initial = {}, schemas = {}, hosts = [], onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    integration_type: initial.integration_type || 'docker',
    host_id: initial.host_id || '',
    is_enabled: initial.is_enabled !== false,
    sync_interval_seconds: initial.sync_interval_seconds || 60,
    config: initial.config || {},
  })

  const schema = schemas[form.integration_type]

  function handleChange(e) {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [e.target.name]: val })
  }

  function handleConfigChange(key, value) {
    setForm({ ...form, config: { ...form.config, [key]: value } })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      name: form.name,
      integration_type: form.integration_type,
      host_id: form.host_id ? Number(form.host_id) : null,
      is_enabled: form.is_enabled,
      sync_interval_seconds: Number(form.sync_interval_seconds),
      config: form.config,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
        {initial.id ? 'Edit Integration' : 'Add Integration'}
      </h3>

      <div className="form-grid-2col">
        <div>
          <label style={labelStyle}>Name *</label>
          <input name="name" value={form.name} onChange={handleChange} required placeholder="e.g., HexOS Docker" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Type *</label>
          <select name="integration_type" value={form.integration_type} onChange={handleChange} style={inputStyle}>
            {Object.entries(schemas).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Host</label>
          <select name="host_id" value={form.host_id} onChange={handleChange} style={inputStyle}>
            <option value="">None</option>
            {hosts.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Sync Interval (sec)</label>
          <input name="sync_interval_seconds" type="number" value={form.sync_interval_seconds} onChange={handleChange} style={inputStyle} />
        </div>
      </div>

      {/* Dynamic config fields */}
      {schema && (
        <div style={{ marginTop: '1.25rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-subtext-0)', marginBottom: '0.75rem' }}>
            {schema.label} Configuration
          </h4>
          {schema.description && (
            <p style={{ fontSize: '0.8rem', color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }}>{schema.description}</p>
          )}
          <div className="form-grid-2col">
            {schema.fields.map(field => (
              <div key={field.name} style={field.type === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                <label style={labelStyle}>{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={form.config[field.name] || field.default || ''}
                    onChange={e => handleConfigChange(field.name, e.target.value)}
                    rows={3}
                    placeholder={field.placeholder}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                ) : field.type === 'boolean' ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="checkbox"
                      checked={form.config[field.name] ?? field.default ?? false}
                      onChange={e => handleConfigChange(field.name, e.target.checked)}
                    />
                    {field.help || field.label}
                  </label>
                ) : (
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={form.config[field.name] || field.default || ''}
                    onChange={e => handleConfigChange(field.name, e.target.value)}
                    placeholder={field.placeholder}
                    style={inputStyle}
                  />
                )}
                {field.help && field.type !== 'boolean' && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>{field.help}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input type="checkbox" name="is_enabled" checked={form.is_enabled} onChange={handleChange} />
          Enabled
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <button type="submit" className="btn btn-primary">{initial.id ? 'Save' : 'Add Integration'}</button>
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
