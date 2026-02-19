/**
 * InfraIncidents.jsx - Incident Log Page
 *
 * Track infrastructure outages and incidents with severity,
 * status (active/investigating/resolved), and resolution notes.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, Plus, X, ArrowLeft, CheckCircle, Edit3, Trash2 } from 'lucide-react'
import { infrastructure } from '../api/client'
import InfraIncidentForm from '../components/InfraIncidentForm'

export default function InfraIncidents() {
  const [incidents, setIncidents] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')

  async function loadIncidents() {
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const data = await infrastructure.incidents.list(params)
      setIncidents(data)
    } catch (err) {
      console.error('Failed to load incidents:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadIncidents() }, [statusFilter])

  async function handleAdd(data) {
    try {
      await infrastructure.incidents.create(data)
      await loadIncidents()
      setShowForm(false)
    } catch (err) {
      alert('Failed to create incident: ' + err.message)
    }
  }

  async function handleUpdate(data) {
    try {
      await infrastructure.incidents.update(editing.id, data)
      await loadIncidents()
      setEditing(null)
    } catch (err) {
      alert('Failed to update incident: ' + err.message)
    }
  }

  async function handleResolve(incident) {
    try {
      await infrastructure.incidents.update(incident.id, { status: 'resolved' })
      await loadIncidents()
    } catch (err) {
      alert('Failed to resolve: ' + err.message)
    }
  }

  async function handleDelete(incident) {
    if (!confirm(`Delete incident "${incident.title}"?`)) return
    try {
      await infrastructure.incidents.delete(incident.id)
      await loadIncidents()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  const severityColors = {
    critical: 'var(--color-red)',
    high: 'var(--color-peach)',
    medium: 'var(--color-yellow)',
    low: 'var(--color-blue)',
  }

  const statusColors = {
    active: 'var(--color-red)',
    investigating: 'var(--color-yellow)',
    resolved: 'var(--color-green)',
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      <Link to="/infrastructure" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-subtext-0)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Infrastructure
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Incidents</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Track outages, issues, and their resolution
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null) }}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Log Incident'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {['', 'active', 'investigating', 'resolved'].map(f => (
          <button
            key={f}
            className={`btn ${statusFilter === f ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setStatusFilter(f)}
            style={{ fontSize: '0.8rem' }}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      {/* Form */}
      {(showForm || editing) && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <InfraIncidentForm
            initial={editing || {}}
            onSubmit={editing ? handleUpdate : handleAdd}
            onCancel={() => { setShowForm(false); setEditing(null) }}
          />
        </div>
      )}

      {/* Incident List */}
      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
      ) : incidents.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <CheckCircle size={40} style={{ color: 'var(--color-green)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)' }}>
            {statusFilter ? `No ${statusFilter} incidents.` : 'No incidents recorded. All clear!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {incidents.map(i => {
            const sevC = severityColors[i.severity] || 'var(--color-overlay-0)'
            const statC = statusColors[i.status] || 'var(--color-overlay-0)'
            return (
              <div key={i.id} className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                {/* Severity dot */}
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: sevC, flexShrink: 0, marginTop: '6px',
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{i.title}</span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                      color: sevC, background: `${sevC}15`, padding: '0.15rem 0.4rem', borderRadius: '3px',
                    }}>
                      {i.severity}
                    </span>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase',
                      color: statC, background: `${statC}15`, padding: '0.15rem 0.4rem', borderRadius: '3px',
                    }}>
                      {i.status}
                    </span>
                  </div>
                  {i.description && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginTop: '0.375rem' }}>
                      {i.description}
                    </p>
                  )}
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.375rem' }}>
                    Started: {new Date(i.started_at).toLocaleString()}
                    {i.resolved_at && ` / Resolved: ${new Date(i.resolved_at).toLocaleString()}`}
                  </div>
                  {i.resolution && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-green)', marginTop: '0.375rem', fontStyle: 'italic' }}>
                      Resolution: {i.resolution}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {i.status !== 'resolved' && (
                    <button className="btn btn-ghost" style={{ padding: '0.375rem', color: 'var(--color-green)' }} title="Resolve" onClick={() => handleResolve(i)}>
                      <CheckCircle size={14} />
                    </button>
                  )}
                  <button className="btn btn-ghost" style={{ padding: '0.375rem' }} onClick={() => { setEditing(i); setShowForm(false) }}>
                    <Edit3 size={14} />
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '0.375rem', color: 'var(--color-red)' }} onClick={() => handleDelete(i)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
