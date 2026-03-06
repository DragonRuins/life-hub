/**
 * WatchNFC - NFC action management page (Catppuccin theme).
 *
 * 3-tab layout:
 *   1. Actions — CRUD grid of NFC action definitions
 *   2. Timers — Filterable timer history table
 *   3. Events — Chronological NFC tap events with 30s auto-refresh
 *
 * Parent handles all API calls (form → onSubmit pattern).
 *
 * Route: /watch/nfc
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Plus, Nfc, X } from 'lucide-react'
import { watchNFC } from '../api/watchApi'
import NFCActionCard from '../components/watch/NFCActionCard'
import NFCActionForm from '../components/watch/NFCActionForm'
import NFCTimerHistory from '../components/watch/NFCTimerHistory'
import NFCEventLog from '../components/watch/NFCEventLog'

const TABS = [
  { key: 'actions', label: 'Actions' },
  { key: 'timers', label: 'Timers' },
  { key: 'events', label: 'Events' },
]

export default function WatchNFC() {
  const [tab, setTab] = useState('actions')
  const [actions, setActions] = useState([])
  const [timers, setTimers] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Modal state
  const [showForm, setShowForm] = useState(false)
  const [editingAction, setEditingAction] = useState(null)

  // Timer filter
  const [timerFilter, setTimerFilter] = useState('')

  // Auto-refresh for events tab
  const eventRefreshRef = useRef(null)

  // Load initial data
  useEffect(() => {
    loadAllData()
  }, [])

  // Auto-refresh events every 30s when on events tab
  useEffect(() => {
    if (tab === 'events') {
      eventRefreshRef.current = setInterval(loadEvents, 30000)
    } else {
      clearInterval(eventRefreshRef.current)
      eventRefreshRef.current = null
    }
    return () => {
      clearInterval(eventRefreshRef.current)
      eventRefreshRef.current = null
    }
  }, [tab])

  async function loadAllData() {
    try {
      const [actionsData, timersData, eventsData] = await Promise.all([
        watchNFC.listActions(),
        watchNFC.listTimers(),
        watchNFC.listEvents(),
      ])
      setActions(Array.isArray(actionsData) ? actionsData : actionsData.actions || [])
      setTimers(Array.isArray(timersData) ? timersData : timersData.timers || [])
      setEvents(Array.isArray(eventsData) ? eventsData : eventsData.events || [])
    } catch (err) {
      console.error('Failed to load NFC data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadEvents() {
    try {
      const eventsData = await watchNFC.listEvents()
      setEvents(Array.isArray(eventsData) ? eventsData : eventsData.events || [])
    } catch (err) {
      console.error('Failed to refresh events:', err)
    }
  }

  async function handleCreateAction(data) {
    try {
      await watchNFC.createAction(data)
      const updated = await watchNFC.listActions()
      setActions(Array.isArray(updated) ? updated : updated.actions || [])
      setShowForm(false)
    } catch (err) {
      alert('Failed to create action: ' + err.message)
    }
  }

  async function handleUpdateAction(data) {
    try {
      await watchNFC.updateAction(editingAction.id, data)
      const updated = await watchNFC.listActions()
      setActions(Array.isArray(updated) ? updated : updated.actions || [])
      setEditingAction(null)
      setShowForm(false)
    } catch (err) {
      alert('Failed to update action: ' + err.message)
    }
  }

  async function handleDeleteAction(id) {
    if (!confirm('Delete this NFC action?')) return
    try {
      await watchNFC.deleteAction(id)
      setActions(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      alert('Failed to delete action: ' + err.message)
    }
  }

  // Filter timers by action name
  const filteredTimers = timerFilter
    ? timers.filter(t => t.action_name === timerFilter || t.action_id?.toString() === timerFilter)
    : timers

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/watch"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem',
            marginBottom: '0.5rem',
          }}
        >
          <ChevronLeft size={16} />
          Watch Data
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Nfc size={22} style={{ color: 'var(--color-peach)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            NFC Actions
          </h1>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '3px solid var(--color-red)' }}>
          <p style={{ color: 'var(--color-red)', fontSize: '0.85rem' }}>Failed to load NFC data: {error}</p>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-surface-0)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--color-peach)' : 'var(--color-subtext-0)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--color-peach)' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.2s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'actions' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => { setEditingAction(null); setShowForm(true) }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
            >
              <Plus size={16} />
              Add Action
            </button>
          </div>

          {loading ? (
            <div className="card-grid">
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: '120px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
              ))}
            </div>
          ) : actions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <Nfc size={32} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
              <p style={{ color: 'var(--color-subtext-0)' }}>No NFC actions defined yet.</p>
              <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.85rem' }}>Create an action to map NFC tag taps to automations.</p>
            </div>
          ) : (
            <div className="card-grid">
              {actions.map(action => (
                <NFCActionCard
                  key={action.id}
                  action={action}
                  onEdit={(a) => { setEditingAction(a); setShowForm(true) }}
                  onDelete={handleDeleteAction}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'timers' && (
        <>
          {/* Action filter dropdown */}
          {actions.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <select
                value={timerFilter}
                onChange={(e) => setTimerFilter(e.target.value)}
                style={{ maxWidth: '250px' }}
              >
                <option value="">All Actions</option>
                {actions.map(a => (
                  <option key={a.id} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
          )}
          <NFCTimerHistory timers={filteredTimers} loading={loading} />
        </>
      )}

      {tab === 'events' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-surface-0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>Event Log</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-overlay-0)' }}>Auto-refreshes every 30s</span>
          </div>
          <NFCEventLog events={events} loading={loading} />
        </div>
      )}

      {/* Action Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: 'min(500px, calc(100vw - 2rem))',
            margin: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {editingAction ? 'Edit Action' : 'New NFC Action'}
              </h2>
              <button
                className="btn btn-ghost"
                onClick={() => { setShowForm(false); setEditingAction(null) }}
              >
                <X size={18} />
              </button>
            </div>
            <NFCActionForm
              action={editingAction}
              onSubmit={editingAction ? handleUpdateAction : handleCreateAction}
              onCancel={() => { setShowForm(false); setEditingAction(null) }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
