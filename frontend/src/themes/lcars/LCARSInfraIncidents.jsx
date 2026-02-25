/**
 * LCARSInfraIncidents.jsx - LCARS Incident Log Page
 *
 * Full incident management page in LCARS visual language.
 * Features: filter pills (all/active/investigating/resolved),
 * incident list with severity dots and status badges,
 * add/edit/delete incidents, quick-resolve button,
 * and "ALL SYSTEMS NOMINAL" empty state.
 *
 * Route: /infrastructure/incidents
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, Plus, X, Trash2, Pencil, CheckCircle, AlertTriangle, ShieldAlert,
} from 'lucide-react'
import { infrastructure } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'
import InfraIncidentForm from '../../components/InfraIncidentForm'

// ── Color Maps ────────────────────────────────────────────────────

/** Severity dot colors — maps severity level to LCARS palette */
const SEVERITY_COLORS = {
  critical: 'var(--lcars-red-alert)',
  high: 'var(--lcars-tomato)',
  medium: 'var(--lcars-sunflower)',
  low: 'var(--lcars-ice)',
}

/** Status badge colors — maps incident status to LCARS palette */
const STATUS_COLORS = {
  active: 'var(--lcars-tomato)',
  investigating: 'var(--lcars-sunflower)',
  resolved: 'var(--lcars-green)',
}

// ── Filter Pill Definitions ───────────────────────────────────────

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'investigating', label: 'Investigating' },
  { key: 'resolved', label: 'Resolved' },
]

export default function LCARSInfraIncidents() {
  // ── State ─────────────────────────────────────────────────────
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingIncident, setEditingIncident] = useState(null)

  // ── Data Loading ──────────────────────────────────────────────

  async function loadIncidents() {
    try {
      // Pass status filter to the API (skip for 'all')
      const params = filter !== 'all' ? { status: filter } : {}
      const data = await infrastructure.incidents.list(params)
      setIncidents(data)
    } catch (err) {
      console.error('Failed to load incidents:', err)
    } finally {
      setLoading(false)
    }
  }

  // Reload whenever the filter changes
  useEffect(() => {
    setLoading(true)
    loadIncidents()
  }, [filter])

  // ── Handlers ──────────────────────────────────────────────────

  /** Create a new incident */
  async function handleCreate(data) {
    try {
      await infrastructure.incidents.create(data)
      setShowForm(false)
      await loadIncidents()
    } catch (err) {
      alert('Failed to create incident: ' + err.message)
    }
  }

  /** Update an existing incident */
  async function handleUpdate(data) {
    try {
      await infrastructure.incidents.update(editingIncident.id, data)
      setEditingIncident(null)
      await loadIncidents()
    } catch (err) {
      alert('Failed to update incident: ' + err.message)
    }
  }

  /** Delete an incident with confirmation */
  async function handleDelete(incident) {
    if (!window.confirm(`Delete incident "${incident.title}"?`)) return
    try {
      await infrastructure.incidents.delete(incident.id)
      await loadIncidents()
    } catch (err) {
      alert('Failed to delete incident: ' + err.message)
    }
  }

  /** Quick-resolve: set status to 'resolved' and resolved_at to now */
  async function handleResolve(incident) {
    try {
      await infrastructure.incidents.update(incident.id, {
        ...incident,
        status: 'resolved',
      })
      await loadIncidents()
    } catch (err) {
      alert('Failed to resolve incident: ' + err.message)
    }
  }

  // ── Loading State ─────────────────────────────────────────────

  if (loading && incidents.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-butterscotch)',
          fontSize: '0.9rem',
        }}>
          SCANNING INCIDENT LOGS...
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Back link + Header */}
      <Link
        to="/infrastructure"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '0.8rem', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--lcars-butterscotch)',
          textDecoration: 'none', marginBottom: '1rem',
          opacity: 0.85, transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '1'}
        onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
      >
        <ArrowLeft size={14} /> Infrastructure
      </Link>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <h1 style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '1.5rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.12em',
          color: 'var(--lcars-space-white)', margin: 0,
        }}>
          Incident Log
        </h1>

        <button
          className="lcars-element button rounded auto"
          onClick={() => {
            setEditingIncident(null)
            setShowForm(!showForm)
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 'auto', gap: '0.375rem',
            padding: '0.4rem 0.85rem',
            background: 'var(--lcars-butterscotch)', border: 'none',
            fontSize: '0.8rem',
          }}
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? 'Cancel' : 'Log Incident'}
        </button>
      </div>

      {/* ── Add Incident Form ───────────────────────────────────── */}
      {showForm && (
        <LCARSPanel
          title="New Incident Report"
          color="var(--lcars-butterscotch)"
          style={{ marginBottom: '1.5rem' }}
        >
          <InfraIncidentForm
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
          />
        </LCARSPanel>
      )}

      {/* ── Edit Incident Form ──────────────────────────────────── */}
      {editingIncident && (
        <LCARSPanel
          title={`Edit Incident — ${editingIncident.title}`}
          color="var(--lcars-butterscotch)"
          style={{ marginBottom: '1.5rem' }}
        >
          <InfraIncidentForm
            initial={editingIncident}
            onSubmit={handleUpdate}
            onCancel={() => setEditingIncident(null)}
          />
        </LCARSPanel>
      )}

      {/* ── Filter Pills ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap',
      }}>
        {FILTERS.map(f => {
          const isActive = filter === f.key
          // Active pill gets the butterscotch accent; inactive gets muted gray
          const pillBg = isActive ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)'
          const pillColor = isActive ? 'var(--lcars-text-on-color)' : 'var(--lcars-space-white)'

          return (
            <button
              className="lcars-element button rounded auto"
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: '0.35rem 0.85rem', height: 'auto',
                alignItems: 'center', justifyContent: 'center',
                background: pillBg, color: pillColor, border: 'none',
                fontSize: '0.8rem',
                transition: 'all 0.15s',
                opacity: isActive ? 1 : 0.75,
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* ── Incident List ───────────────────────────────────────── */}
      <LCARSPanel
        title={`Incidents${filter !== 'all' ? ` — ${filter.toUpperCase()}` : ''}`}
        color="var(--lcars-butterscotch)"
        noPadding
      >
        {incidents.length === 0 ? (
          /* Empty state: all systems nominal */
          <div style={{
            textAlign: 'center', padding: '3rem 1.5rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem',
          }}>
            <ShieldAlert size={32} style={{ color: 'var(--lcars-green)' }} />
            <div style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '1.1rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.15em',
              color: 'var(--lcars-green)',
            }}>
              All Systems Nominal
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.75rem', color: 'var(--lcars-gray)',
            }}>
              No incidents matching current filter
            </div>
          </div>
        ) : (
          incidents.map(incident => (
            <div
              key={incident.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
              }}
            >
              {/* Severity dot */}
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: SEVERITY_COLORS[incident.severity] || 'var(--lcars-gray)',
                flexShrink: 0, marginTop: '0.3rem',
              }} />

              {/* Incident info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  flexWrap: 'wrap', marginBottom: '0.25rem',
                }}>
                  <span style={{
                    fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
                    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                    color: 'var(--lcars-space-white)',
                  }}>
                    {incident.title}
                  </span>

                  {/* Severity badge */}
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem',
                    fontWeight: 600, textTransform: 'uppercase',
                    padding: '0.125rem 0.5rem', borderRadius: '999px',
                    background: SEVERITY_COLORS[incident.severity] || 'var(--lcars-gray)',
                    color: 'var(--lcars-text-on-color)', letterSpacing: '0.04em',
                  }}>
                    {incident.severity}
                  </span>

                  {/* Status badge */}
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem',
                    fontWeight: 600, textTransform: 'uppercase',
                    padding: '0.125rem 0.5rem', borderRadius: '999px',
                    background: STATUS_COLORS[incident.status] || 'var(--lcars-gray)',
                    color: 'var(--lcars-text-on-color)', letterSpacing: '0.04em',
                  }}>
                    {incident.status}
                  </span>
                </div>

                {/* Description (if present) */}
                {incident.description && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                    color: 'var(--lcars-gray)', marginBottom: '0.25rem',
                    lineHeight: 1.4,
                  }}>
                    {incident.description}
                  </div>
                )}

                {/* Resolution text — displayed in green when available */}
                {incident.resolution && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                    color: 'var(--lcars-green)', marginBottom: '0.25rem',
                    lineHeight: 1.4,
                  }}>
                    Resolution: {incident.resolution}
                  </div>
                )}

                {/* Started date */}
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
                  color: 'var(--lcars-gray)', marginTop: '0.125rem',
                }}>
                  Started: {incident.started_at
                    ? new Date(incident.started_at).toLocaleString()
                    : '—'}
                  {incident.resolved_at && (
                    <span style={{ marginLeft: '0.75rem' }}>
                      Resolved: {new Date(incident.resolved_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div style={{
                display: 'flex', gap: '0.375rem', flexShrink: 0, alignItems: 'center',
              }}>
                {/* Resolve button — only shown for non-resolved incidents */}
                {incident.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(incident)}
                    title="Resolve"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'rgba(153, 153, 51, 0.2)', border: 'none',
                      color: 'var(--lcars-green)', cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(153, 153, 51, 0.4)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(153, 153, 51, 0.2)'}
                  >
                    <CheckCircle size={14} />
                  </button>
                )}

                {/* Edit button */}
                <button
                  onClick={() => {
                    setShowForm(false)
                    setEditingIncident(incident)
                  }}
                  title="Edit"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'rgba(255, 153, 102, 0.15)', border: 'none',
                    color: 'var(--lcars-butterscotch)', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 153, 102, 0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255, 153, 102, 0.15)'}
                >
                  <Pencil size={14} />
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(incident)}
                  title="Delete"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'rgba(204, 68, 68, 0.15)', border: 'none',
                    color: 'var(--lcars-red)', cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(204, 68, 68, 0.3)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(204, 68, 68, 0.15)'}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </LCARSPanel>
    </div>
  )
}
