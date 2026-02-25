/**
 * LCARSInfraIntegrations.jsx - LCARS Integration Control Panel
 *
 * Manages infrastructure integrations (Proxmox, Portainer, etc.) in
 * the LCARS visual language. Lists configured integrations with status,
 * provides add/edit forms with dynamic config fields driven by schemas,
 * and supports test/sync actions per integration.
 */
import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, X, Play, RefreshCw, Pencil, Trash2,
  Settings, Check, AlertCircle, Clock, Plug,
} from 'lucide-react'
import { infrastructure } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

// ── Styles ────────────────────────────────────────────────────────

/** Shared input style for LCARS forms */
const INPUT_STYLE = {
  background: 'rgba(102, 102, 136, 0.1)',
  border: '1px solid rgba(102, 102, 136, 0.3)',
  borderRadius: '4px',
  color: 'var(--lcars-space-white)',
  fontSize: '0.85rem',
  fontFamily: "'JetBrains Mono', monospace",
  padding: '0.5rem 0.75rem',
  width: '100%',
  boxSizing: 'border-box',
}

/** Label style for LCARS form fields */
const LABEL_STYLE = {
  fontFamily: "'Antonio', sans-serif",
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--lcars-gray)',
  marginBottom: '0.25rem',
  display: 'block',
}

// Sync status icon/color mapping
const SYNC_STATUS = {
  success: { icon: Check, color: 'var(--lcars-green)', label: 'SUCCESS' },
  error: { icon: AlertCircle, color: 'var(--lcars-tomato)', label: 'ERROR' },
  pending: { icon: Clock, color: 'var(--lcars-sunflower)', label: 'PENDING' },
}

// ── Helper: format seconds into a human-readable interval ─────────
function formatInterval(seconds) {
  if (!seconds) return '—'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  return `${Math.round(seconds / 86400)}d`
}

// ── Main Component ────────────────────────────────────────────────

export default function LCARSInfraIntegrations() {
  // Data state
  const [integrations, setIntegrations] = useState([])
  const [schemas, setSchemas] = useState({})
  const [hosts, setHosts] = useState([])
  const [loading, setLoading] = useState(true)

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [actionLoading, setActionLoading] = useState({}) // { [id]: 'test' | 'sync' | 'delete' }
  const [error, setError] = useState(null)

  // Form state
  const [form, setForm] = useState({
    name: '',
    integration_type: '',
    host_id: '',
    sync_interval_seconds: 300,
    is_enabled: true,
    config: {},
  })

  // ── Data loading ──────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const [intList, schemaData, hostList] = await Promise.all([
        infrastructure.integrations.list(),
        infrastructure.integrations.schemas(),
        infrastructure.hosts.list(),
      ])
      setIntegrations(intList)
      setSchemas(schemaData)
      setHosts(hostList)
      setError(null)
    } catch (err) {
      console.error('Failed to load integrations:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Form helpers ──────────────────────────────────────────────

  /** Reset form to defaults */
  function resetForm() {
    setForm({
      name: '',
      integration_type: '',
      host_id: '',
      sync_interval_seconds: 300,
      is_enabled: true,
      config: {},
    })
    setEditingId(null)
    setShowForm(false)
  }

  /** Open the form to add a new integration */
  function handleAdd() {
    resetForm()
    setShowForm(true)
    setEditingId(null)
  }

  /** Open the form to edit an existing integration */
  function handleEdit(integration) {
    setForm({
      name: integration.name || '',
      integration_type: integration.integration_type || '',
      host_id: integration.host_id || '',
      sync_interval_seconds: integration.sync_interval_seconds || 300,
      is_enabled: integration.is_enabled ?? true,
      config: integration.config || {},
    })
    setEditingId(integration.id)
    setShowForm(true)
  }

  /** Update a top-level form field */
  function updateField(key, value) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      // When the integration type changes, reset config to schema defaults
      if (key === 'integration_type' && value !== prev.integration_type) {
        const schema = schemas[value]
        const defaults = {}
        if (schema?.fields) {
          schema.fields.forEach(f => {
            defaults[f.key] = f.default ?? (f.type === 'boolean' ? false : '')
          })
        }
        next.config = defaults
      }
      return next
    })
  }

  /** Update a dynamic config field */
  function updateConfigField(key, value) {
    setForm(prev => ({
      ...prev,
      config: { ...prev.config, [key]: value },
    }))
  }

  // ── CRUD actions ──────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    try {
      const payload = {
        name: form.name,
        integration_type: form.integration_type,
        host_id: form.host_id || null,
        sync_interval_seconds: Number(form.sync_interval_seconds) || 300,
        is_enabled: form.is_enabled,
        config: form.config,
      }

      if (editingId) {
        await infrastructure.integrations.update(editingId, payload)
      } else {
        await infrastructure.integrations.create(payload)
      }
      resetForm()
      await loadData()
    } catch (err) {
      alert('Failed to save integration: ' + err.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this integration? This cannot be undone.')) return
    setActionLoading(prev => ({ ...prev, [id]: 'delete' }))
    try {
      await infrastructure.integrations.delete(id)
      await loadData()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }))
    }
  }

  async function handleTest(id) {
    setActionLoading(prev => ({ ...prev, [id]: 'test' }))
    try {
      const result = await infrastructure.integrations.test(id)
      alert(result.message || 'Test completed successfully.')
      await loadData()
    } catch (err) {
      alert('Test failed: ' + err.message)
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }))
    }
  }

  async function handleSync(id) {
    setActionLoading(prev => ({ ...prev, [id]: 'sync' }))
    try {
      await infrastructure.integrations.sync(id)
      await loadData()
    } catch (err) {
      alert('Sync failed: ' + err.message)
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }))
    }
  }

  // ── Loading state ─────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-ice)',
          fontSize: '0.9rem',
        }}>
          SCANNING INTEGRATIONS...
        </div>
      </div>
    )
  }

  // Get the list of dynamic fields for the currently selected type
  const currentSchema = schemas[form.integration_type]
  const dynamicFields = currentSchema?.fields || []

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Back link + header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div>
          <Link to="/infrastructure" style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--lcars-ice)', textDecoration: 'none',
            marginBottom: '0.5rem',
          }}>
            <ArrowLeft size={14} /> Infrastructure
          </Link>
          <h1 style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '1.5rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--lcars-space-white)', margin: 0,
          }}>
            Integration Control
          </h1>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem', color: 'var(--lcars-tanoi)', marginTop: '0.25rem',
          }}>
            {integrations.length} integration{integrations.length !== 1 ? 's' : ''} configured
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="lcars-element button rounded auto"
            onClick={loadData}
            style={{
              background: 'var(--lcars-ice)',
              border: 'none', height: 'auto',
              padding: '0.4rem 0.75rem', fontSize: '0.8rem',
              alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="lcars-element button rounded auto"
            onClick={() => showForm ? resetForm() : handleAdd()}
            style={{
              background: 'var(--lcars-butterscotch)',
              border: 'none', height: 'auto',
              padding: '0.4rem 0.75rem', fontSize: '0.8rem',
              alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
            }}
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'Add Integration'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          border: '1px solid var(--lcars-tomato)',
          background: 'rgba(255, 69, 58, 0.1)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8rem', color: 'var(--lcars-tomato)',
        }}>
          <AlertCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          {error}
        </div>
      )}

      {/* ── Add / Edit Form ───────────────────────────────────── */}
      {showForm && (
        <LCARSPanel
          title={editingId ? 'Edit Integration' : 'New Integration'}
          color="var(--lcars-butterscotch)"
          style={{ marginBottom: '1.5rem' }}
        >
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Row 1: Name + Type */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Name */}
              <div>
                <label style={LABEL_STYLE}>Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => updateField('name', e.target.value)}
                  placeholder="e.g. Proxmox Main"
                  style={INPUT_STYLE}
                />
              </div>

              {/* Integration Type */}
              <div>
                <label style={LABEL_STYLE}>Integration Type</label>
                <select
                  required
                  value={form.integration_type}
                  onChange={e => updateField('integration_type', e.target.value)}
                  style={{ ...INPUT_STYLE, cursor: 'pointer' }}
                >
                  <option value="">— Select Type —</option>
                  {Object.keys(schemas).map(key => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Host + Sync Interval + Enabled */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
              {/* Host */}
              <div>
                <label style={LABEL_STYLE}>Host</label>
                <select
                  value={form.host_id}
                  onChange={e => updateField('host_id', e.target.value)}
                  style={{ ...INPUT_STYLE, cursor: 'pointer' }}
                >
                  <option value="">— No Host —</option>
                  {hosts.map(h => (
                    <option key={h.id} value={h.id}>{h.name}</option>
                  ))}
                </select>
              </div>

              {/* Sync Interval */}
              <div>
                <label style={LABEL_STYLE}>Sync Interval (seconds)</label>
                <input
                  type="number"
                  min="0"
                  value={form.sync_interval_seconds}
                  onChange={e => updateField('sync_interval_seconds', e.target.value)}
                  placeholder="300"
                  style={INPUT_STYLE}
                />
              </div>

              {/* Enabled checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.35rem' }}>
                <input
                  type="checkbox"
                  id="is_enabled"
                  checked={form.is_enabled}
                  onChange={e => updateField('is_enabled', e.target.checked)}
                  style={{ accentColor: 'var(--lcars-ice)', width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="is_enabled" style={{
                  ...LABEL_STYLE,
                  marginBottom: 0, cursor: 'pointer',
                }}>
                  Enabled
                </label>
              </div>
            </div>

            {/* Dynamic config fields from schema */}
            {dynamicFields.length > 0 && (
              <div style={{
                borderTop: '1px solid rgba(102, 102, 136, 0.3)',
                paddingTop: '1rem', marginTop: '0.25rem',
              }}>
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.8rem', textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--lcars-ice)',
                  marginBottom: '0.75rem',
                }}>
                  {form.integration_type} Configuration
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {dynamicFields.map(field => (
                    <div key={field.name} style={field.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}>
                      <label style={LABEL_STYLE}>{field.label || field.name}</label>

                      {/* Boolean fields render as checkbox */}
                      {field.type === 'boolean' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={!!form.config[field.name]}
                            onChange={e => updateConfigField(field.name, e.target.checked)}
                            style={{ accentColor: 'var(--lcars-ice)', width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          {field.help && (
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '0.7rem', color: 'var(--lcars-gray)',
                            }}>
                              {field.help}
                            </span>
                          )}
                        </div>
                      ) : field.type === 'textarea' ? (
                        /* Textarea fields */
                        <textarea
                          value={form.config[field.name] ?? ''}
                          onChange={e => updateConfigField(field.name, e.target.value)}
                          placeholder={field.placeholder || ''}
                          rows={3}
                          style={{ ...INPUT_STYLE, resize: 'vertical' }}
                        />
                      ) : (
                        /* Text and password fields */
                        <input
                          type={field.type === 'password' ? 'password' : 'text'}
                          value={form.config[field.name] ?? ''}
                          onChange={e => updateConfigField(field.name, e.target.value)}
                          placeholder={field.placeholder || ''}
                          style={INPUT_STYLE}
                        />
                      )}

                      {/* Help text (for non-boolean fields) */}
                      {field.help && field.type !== 'boolean' && (
                        <div style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.65rem', color: 'var(--lcars-gray)',
                          marginTop: '0.25rem',
                        }}>
                          {field.help}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit row */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                className="lcars-element button rounded auto"
                type="button"
                onClick={resetForm}
                style={{
                  background: 'var(--lcars-gray)',
                  border: 'none', height: 'auto',
                  padding: '0.4rem 0.75rem', fontSize: '0.8rem',
                  alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                }}
              >
                Cancel
              </button>
              <button
                className="lcars-element button rounded auto"
                type="submit"
                style={{
                  background: 'var(--lcars-butterscotch)',
                  border: 'none', height: 'auto',
                  padding: '0.4rem 0.75rem', fontSize: '0.8rem',
                  alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                }}
              >
                {editingId ? 'Update Integration' : 'Create Integration'}
              </button>
            </div>
          </form>
        </LCARSPanel>
      )}

      {/* ── Integrations List ─────────────────────────────────── */}
      <LCARSPanel title="Integration Registry" color="var(--lcars-ice)">
        {integrations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <Plug size={32} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.9rem', color: 'var(--lcars-gray)',
            }}>
              NO INTEGRATIONS CONFIGURED
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.75rem', color: 'var(--lcars-gray)',
              marginTop: '0.5rem', opacity: 0.6,
            }}>
              Add an integration to connect external services.
            </div>
          </div>
        ) : (
          integrations.map(intg => {
            const syncInfo = SYNC_STATUS[intg.last_sync_status] || SYNC_STATUS.pending
            const SyncIcon = syncInfo.icon
            const isLoading = actionLoading[intg.id]

            return (
              <div key={intg.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem',
                borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
              }}>
                {/* Icon */}
                <Settings size={16} style={{ color: 'var(--lcars-ice)', flexShrink: 0 }} />

                {/* Name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
                    fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--lcars-space-white)',
                  }}>
                    {intg.name}
                  </div>
                  {intg.host_name && (
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.65rem', color: 'var(--lcars-gray)',
                      marginTop: '2px',
                    }}>
                      Host: {intg.host_name}
                    </div>
                  )}
                </div>

                {/* Type badge */}
                <span style={{
                  display: 'inline-block',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  background: 'var(--lcars-ice)',
                  color: 'var(--lcars-text-on-color)',
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.65rem', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  flexShrink: 0,
                }}>
                  {intg.integration_type}
                </span>

                {/* Enabled / Disabled */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem',
                  color: intg.is_enabled ? 'var(--lcars-green)' : 'var(--lcars-gray)',
                  textTransform: 'uppercase', flexShrink: 0,
                  minWidth: '5rem', textAlign: 'center',
                }}>
                  {intg.is_enabled ? 'ENABLED' : 'DISABLED'}
                </span>

                {/* Last sync status */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  flexShrink: 0, minWidth: '5.5rem',
                }}>
                  <SyncIcon size={12} style={{ color: syncInfo.color }} />
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.65rem', color: syncInfo.color,
                    textTransform: 'uppercase',
                  }}>
                    {syncInfo.label}
                  </span>
                </div>

                {/* Sync interval */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem', color: 'var(--lcars-tanoi)',
                  flexShrink: 0, minWidth: '2.5rem', textAlign: 'right',
                }}>
                  {formatInterval(intg.sync_interval_seconds)}
                </span>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {/* Test */}
                  <button
                    onClick={() => handleTest(intg.id)}
                    disabled={!!isLoading}
                    title="Test connection"
                    style={{
                      background: 'rgba(102, 102, 136, 0.15)',
                      border: '1px solid rgba(102, 102, 136, 0.3)',
                      borderRadius: '4px',
                      padding: '0.3rem',
                      cursor: isLoading ? 'wait' : 'pointer',
                      color: 'var(--lcars-green)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isLoading === 'test' ? 0.5 : 1,
                    }}
                  >
                    <Play size={14} />
                  </button>

                  {/* Sync */}
                  <button
                    onClick={() => handleSync(intg.id)}
                    disabled={!!isLoading}
                    title="Trigger sync"
                    style={{
                      background: 'rgba(102, 102, 136, 0.15)',
                      border: '1px solid rgba(102, 102, 136, 0.3)',
                      borderRadius: '4px',
                      padding: '0.3rem',
                      cursor: isLoading ? 'wait' : 'pointer',
                      color: 'var(--lcars-ice)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isLoading === 'sync' ? 0.5 : 1,
                    }}
                  >
                    <RefreshCw size={14} style={isLoading === 'sync' ? { animation: 'spin 1s linear infinite' } : {}} />
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => handleEdit(intg)}
                    disabled={!!isLoading}
                    title="Edit integration"
                    style={{
                      background: 'rgba(102, 102, 136, 0.15)',
                      border: '1px solid rgba(102, 102, 136, 0.3)',
                      borderRadius: '4px',
                      padding: '0.3rem',
                      cursor: isLoading ? 'wait' : 'pointer',
                      color: 'var(--lcars-sunflower)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Pencil size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(intg.id)}
                    disabled={!!isLoading}
                    title="Delete integration"
                    style={{
                      background: 'rgba(102, 102, 136, 0.15)',
                      border: '1px solid rgba(102, 102, 136, 0.3)',
                      borderRadius: '4px',
                      padding: '0.3rem',
                      cursor: isLoading ? 'wait' : 'pointer',
                      color: 'var(--lcars-tomato)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: isLoading === 'delete' ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </LCARSPanel>
    </div>
  )
}
