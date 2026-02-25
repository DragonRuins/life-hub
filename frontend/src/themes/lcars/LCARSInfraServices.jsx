/**
 * LCARSInfraServices.jsx - LCARS Service Monitor
 *
 * LCARS-themed services monitoring page for the infrastructure module.
 * Displays monitored services with status indicators, response times,
 * and inline CRUD + manual health check per service.
 *
 * Uses --lcars-tanoi as the primary accent color for services.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Globe, Plus, X, Edit3, Trash2, ArrowLeft, Play, RefreshCw,
} from 'lucide-react'
import { infrastructure } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

// ── Status color mapping (LCARS palette) ─────────────────────
const STATUS_COLORS = {
  up: 'var(--lcars-green)',
  down: 'var(--lcars-tomato)',
  degraded: 'var(--lcars-sunflower)',
  unknown: 'var(--lcars-gray)',
}

// ── Shared LCARS form input style ────────────────────────────
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

// ── LCARS label style ────────────────────────────────────────
const lcarsLabelStyle = {
  display: 'block',
  fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--lcars-tanoi)',
  marginBottom: '0.375rem',
}


/**
 * ServiceForm - LCARS-styled form for adding/editing a service.
 * Does NOT call the API directly; passes data to parent via onSubmit.
 */
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
      <div className="form-grid-2col">
        {/* Name */}
        <div>
          <label style={lcarsLabelStyle}>Name *</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="e.g., Dockge"
            style={lcarsInputStyle}
          />
        </div>

        {/* URL */}
        <div>
          <label style={lcarsLabelStyle}>URL</label>
          <input
            name="url"
            value={form.url}
            onChange={handleChange}
            placeholder="https://..."
            style={lcarsInputStyle}
          />
        </div>

        {/* Service Type */}
        <div>
          <label style={lcarsLabelStyle}>Type</label>
          <select
            name="service_type"
            value={form.service_type}
            onChange={handleChange}
            style={lcarsInputStyle}
          >
            <option value="http">HTTP</option>
            <option value="tcp">TCP</option>
            <option value="ping">Ping</option>
            <option value="docker">Docker</option>
          </select>
        </div>

        {/* Host */}
        <div>
          <label style={lcarsLabelStyle}>Host</label>
          <select
            name="host_id"
            value={form.host_id}
            onChange={handleChange}
            style={lcarsInputStyle}
          >
            <option value="">None</option>
            {hosts.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        {/* Check Interval */}
        <div>
          <label style={lcarsLabelStyle}>Check Interval (sec)</label>
          <input
            name="check_interval_seconds"
            type="number"
            value={form.check_interval_seconds}
            onChange={handleChange}
            style={lcarsInputStyle}
          />
        </div>

        {/* Expected Status */}
        <div>
          <label style={lcarsLabelStyle}>Expected Status Code</label>
          <input
            name="expected_status"
            type="number"
            value={form.expected_status}
            onChange={handleChange}
            style={lcarsInputStyle}
          />
        </div>
      </div>

      {/* Monitored checkbox */}
      <div style={{ marginTop: '0.75rem' }}>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          cursor: 'pointer',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.8rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--lcars-space-white)',
        }}>
          <input
            type="checkbox"
            name="is_monitored"
            checked={form.is_monitored}
            onChange={handleChange}
            style={{ accentColor: 'var(--lcars-tanoi)' }}
          />
          Enable Monitoring
        </label>
      </div>

      {/* Notes */}
      <div style={{ marginTop: '0.75rem' }}>
        <label style={lcarsLabelStyle}>Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          rows={2}
          style={{ ...lcarsInputStyle, resize: 'vertical' }}
        />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
        <button
          type="submit"
          className="lcars-element button rounded auto"
          style={{
            padding: '0.4rem 1rem',
            background: 'var(--lcars-tanoi)',
            border: 'none',
            fontSize: '0.8rem',
            height: 'auto',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {initial.id ? 'Save Changes' : 'Add Service'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="lcars-element button rounded auto"
            style={{
              padding: '0.4rem 1rem',
              background: 'var(--lcars-gray)',
              border: 'none',
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


/**
 * LCARSInfraServices - Main services monitoring page (LCARS theme).
 */
export default function LCARSInfraServices() {
  const [services, setServices] = useState([])
  const [hosts, setHosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [checking, setChecking] = useState(null) // Track which service is being checked

  // ── Load data ────────────────────────────────────────────────
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

  // ── Handlers ─────────────────────────────────────────────────
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
    setChecking(service.id)
    try {
      await infrastructure.services.check(service.id)
      await loadData()
    } catch (err) {
      alert('Check failed: ' + err.message)
    } finally {
      setChecking(null)
    }
  }

  // ── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-tanoi)',
          fontSize: '0.9rem',
        }}>
          SCANNING SERVICES...
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1100px' }}>
      {/* Back link */}
      <Link
        to="/infrastructure"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--lcars-gray)',
          fontSize: '0.8rem',
          textDecoration: 'none',
          marginBottom: '1rem',
          fontFamily: "'Antonio', sans-serif",
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-tanoi)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
      >
        <ArrowLeft size={14} /> Back to Infrastructure
      </Link>

      {/* Header */}
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
            margin: 0,
          }}>
            Service Monitor
          </h1>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: 'var(--lcars-tanoi)',
            marginTop: '0.25rem',
          }}>
            {services.length} service{services.length !== 1 ? 's' : ''} registered
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={loadData}
            className="lcars-element button rounded auto"
            style={{
              display: 'inline-flex',
              gap: '0.375rem',
              padding: '0.4rem 0.75rem',
              background: 'var(--lcars-gray)',
              border: 'none',
              fontSize: '0.8rem',
              height: 'auto',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setEditing(null) }}
            className="lcars-element button rounded auto"
            style={{
              display: 'inline-flex',
              gap: '0.375rem',
              padding: '0.4rem 0.75rem',
              background: 'var(--lcars-tanoi)',
              border: 'none',
              fontSize: '0.8rem',
              height: 'auto',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'Add Service'}
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      {(showForm || editing) && (
        <LCARSPanel
          title={editing ? 'Edit Service' : 'Register New Service'}
          color="var(--lcars-tanoi)"
          style={{ marginBottom: '1.5rem' }}
        >
          <ServiceForm
            initial={editing || {}}
            hosts={hosts}
            onSubmit={editing ? handleUpdate : handleAdd}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </LCARSPanel>
      )}

      {/* Service List */}
      {services.length === 0 ? (
        <LCARSPanel title="No Services" color="var(--lcars-gray)">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Globe size={28} style={{ color: 'var(--lcars-gray)', marginBottom: '0.5rem' }} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem',
              color: 'var(--lcars-gray)',
            }}>
              No services registered. Add one to begin monitoring.
            </div>
          </div>
        </LCARSPanel>
      ) : (
        <LCARSPanel
          title={`Service Registry -- ${services.length} Total`}
          color="var(--lcars-tanoi)"
          noPadding
        >
          {services.map(s => {
            const statusColor = STATUS_COLORS[s.status] || STATUS_COLORS.unknown
            const isChecking = checking === s.id
            // Find the host name if host_id is set
            const host = s.host_id ? hosts.find(h => h.id === s.host_id) : null

            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(102, 102, 136, 0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Status dot */}
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: statusColor,
                  flexShrink: 0,
                  boxShadow: s.status === 'up'
                    ? '0 0 6px var(--lcars-green)'
                    : s.status === 'down'
                      ? '0 0 6px var(--lcars-tomato)'
                      : 'none',
                }} />

                {/* Name + URL */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--lcars-space-white)',
                  }}>
                    {s.name}
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.7rem',
                    color: 'var(--lcars-gray)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '1px',
                  }}>
                    {s.url || 'No URL'}
                    {host ? ` / ${host.name}` : ''}
                  </div>
                </div>

                {/* Response time */}
                {s.last_response_time_ms != null && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--lcars-ice)',
                    flexShrink: 0,
                  }}>
                    {s.last_response_time_ms}ms
                  </span>
                )}

                {/* Status badge */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  color: statusColor,
                  flexShrink: 0,
                  minWidth: '52px',
                  textAlign: 'center',
                }}>
                  {s.status}
                </span>

                {/* Check button */}
                <button
                  onClick={() => handleCheck(s)}
                  disabled={isChecking}
                  title="Check now"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isChecking ? 'var(--lcars-gray)' : 'var(--lcars-tanoi)',
                    color: 'var(--lcars-text-on-color)',
                    border: 'none',
                    cursor: isChecking ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    opacity: isChecking ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {isChecking
                    ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Play size={13} />
                  }
                </button>

                {/* Edit button */}
                <button
                  onClick={() => { setEditing(s); setShowForm(false) }}
                  title="Edit"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(102, 102, 136, 0.2)',
                    color: 'var(--lcars-space-white)',
                    border: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(102, 102, 136, 0.4)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(102, 102, 136, 0.2)'}
                >
                  <Edit3 size={13} />
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(s)}
                  title="Delete"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'rgba(102, 102, 136, 0.2)',
                    color: 'var(--lcars-tomato)',
                    border: 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 85, 85, 0.15)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(102, 102, 136, 0.2)'}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )
          })}
        </LCARSPanel>
      )}

      {/* Inline keyframes for the spin animation on the check button */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
