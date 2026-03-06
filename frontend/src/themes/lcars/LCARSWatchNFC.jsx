/**
 * LCARSWatchNFC - NFC action management (LCARS theme).
 *
 * 3-tab LCARS layout: Command Actions, Timer Archive, Event Telemetry.
 * Uses LCARSModal for action forms, LCARSPanel for content sections.
 *
 * Route: /watch/nfc
 */
import { useState, useEffect, useRef } from 'react'
import { Nfc, Plus } from 'lucide-react'
import { watchNFC } from '../../api/watchApi'
import { formatDate } from '../../utils/formatDate'
import LCARSPanel, { LCARSDataRow, LCARSMiniPanel } from './LCARSPanel'
import LCARSModal from './LCARSModal'
import NFCActionForm from '../../components/watch/NFCActionForm'

const TABS = [
  { key: 'actions', label: 'COMMAND ACTIONS' },
  { key: 'timers', label: 'TIMER ARCHIVE' },
  { key: 'events', label: 'EVENT TELEMETRY' },
]

export default function LCARSWatchNFC() {
  const [tab, setTab] = useState('actions')
  const [actions, setActions] = useState([])
  const [timers, setTimers] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingAction, setEditingAction] = useState(null)
  const eventRefreshRef = useRef(null)

  useEffect(() => { loadAllData() }, [])

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
      const [a, t, e] = await Promise.all([
        watchNFC.listActions(),
        watchNFC.listTimers(),
        watchNFC.listEvents(),
      ])
      setActions(Array.isArray(a) ? a : a.actions || [])
      setTimers(Array.isArray(t) ? t : t.timers || [])
      setEvents(Array.isArray(e) ? e : e.events || [])
    } catch (err) {
      console.error('Failed to load NFC data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadEvents() {
    try {
      const e = await watchNFC.listEvents()
      setEvents(Array.isArray(e) ? e : e.events || [])
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

  if (loading) {
    return (
      <LCARSPanel title="NFC COMMAND INTERFACE // LOADING" color="var(--lcars-tanoi)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
          }}>
            ACCESSING NFC SUBSYSTEM...
          </span>
        </div>
      </LCARSPanel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Error state */}
      {error && (
        <LCARSPanel title="SUBSYSTEM ERROR" color="var(--lcars-red-alert)">
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-red-alert)' }}>
            {error}
          </p>
        </LCARSPanel>
      )}

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className="lcars-element button rounded"
            onClick={() => setTab(t.key)}
            style={{
              background: tab === t.key ? 'var(--lcars-tanoi)' : 'var(--lcars-gray)',
              border: 'none',
              padding: '0.25rem 0.75rem',
              fontSize: '0.7rem',
              height: 'auto',
              width: 'auto',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Actions tab */}
      {tab === 'actions' && (
        <LCARSPanel
          title="COMMAND ACTIONS"
          color="var(--lcars-tanoi)"
          headerRight={
            <button
              className="lcars-element button rounded"
              onClick={() => { setEditingAction(null); setShowForm(true) }}
              style={{
                background: 'var(--lcars-green)',
                border: 'none',
                padding: '0.2rem 0.5rem',
                fontSize: '0.65rem',
                height: 'auto',
                width: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Plus size={12} />
              NEW
            </button>
          }
        >
          {actions.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <span style={{ fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem', color: 'var(--lcars-gray)', textTransform: 'uppercase' }}>
                NO ACTIONS CONFIGURED
              </span>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.5rem',
            }}>
              {actions.map(action => (
                <LCARSMiniPanel
                  key={action.id}
                  title={action.name?.toUpperCase() || 'ACTION'}
                  color="var(--lcars-tanoi)"
                >
                  <div style={{ fontSize: '0.75rem' }}>
                    <div style={{
                      fontFamily: "'Antonio', sans-serif",
                      color: 'var(--lcars-gray)',
                      textTransform: 'uppercase',
                      marginBottom: '0.25rem',
                    }}>
                      TYPE: {action.action_type?.toUpperCase()}
                    </div>
                    {action.tag_id && (
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.65rem',
                        color: 'var(--lcars-space-white)',
                        marginBottom: '0.25rem',
                      }}>
                        {action.tag_id}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.375rem' }}>
                      <button
                        className="lcars-element button rounded"
                        onClick={() => { setEditingAction(action); setShowForm(true) }}
                        style={{
                          background: 'var(--lcars-sunflower)',
                          border: 'none',
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.6rem',
                          height: 'auto', width: 'auto',
                        }}
                      >
                        EDIT
                      </button>
                      <button
                        className="lcars-element button rounded"
                        onClick={() => handleDeleteAction(action.id)}
                        style={{
                          background: 'var(--lcars-red-alert)',
                          border: 'none',
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.6rem',
                          height: 'auto', width: 'auto',
                        }}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                </LCARSMiniPanel>
              ))}
            </div>
          )}
        </LCARSPanel>
      )}

      {/* Timers tab */}
      {tab === 'timers' && (
        <LCARSPanel title="TIMER ARCHIVE" color="var(--lcars-tanoi)">
          {timers.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <span style={{ fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem', color: 'var(--lcars-gray)', textTransform: 'uppercase' }}>
                NO TIMER RECORDS
              </span>
            </div>
          ) : (
            timers.map(timer => (
              <LCARSDataRow
                key={timer.id}
                label={timer.action_name || 'TIMER'}
                value={`${formatDuration(timer.duration_seconds)} // ${timer.status?.toUpperCase() || 'COMPLETE'}`}
                color={timer.status === 'active' ? 'var(--lcars-green)' : 'var(--lcars-tanoi)'}
              />
            ))
          )}
        </LCARSPanel>
      )}

      {/* Events tab */}
      {tab === 'events' && (
        <LCARSPanel
          title="EVENT TELEMETRY"
          color="var(--lcars-tanoi)"
          headerRight={
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.6rem',
              color: 'var(--lcars-gray)',
              textTransform: 'uppercase',
            }}>
              AUTO-REFRESH 30S
            </span>
          }
        >
          {events.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <span style={{ fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem', color: 'var(--lcars-gray)', textTransform: 'uppercase' }}>
                NO EVENTS RECORDED
              </span>
            </div>
          ) : (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {events.map(event => (
                <LCARSDataRow
                  key={event.id}
                  label={event.action_name || 'UNKNOWN'}
                  value={formatDate(event.scanned_at)}
                  color={event.status === 'error' ? 'var(--lcars-red-alert)' : 'var(--lcars-green)'}
                />
              ))}
            </div>
          )}
        </LCARSPanel>
      )}

      {/* Action form modal */}
      <LCARSModal
        isOpen={showForm}
        onClose={() => { setShowForm(false); setEditingAction(null) }}
        title={editingAction ? 'MODIFY ACTION' : 'NEW COMMAND ACTION'}
        color="var(--lcars-tanoi)"
      >
        <NFCActionForm
          action={editingAction}
          onSubmit={editingAction ? handleUpdateAction : handleCreateAction}
          onCancel={() => { setShowForm(false); setEditingAction(null) }}
        />
      </LCARSModal>
    </div>
  )
}

function formatDuration(seconds) {
  if (seconds == null) return '\u2014'
  if (seconds < 60) return `${seconds}S`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}M ${seconds % 60}S`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}H ${m}M`
}
