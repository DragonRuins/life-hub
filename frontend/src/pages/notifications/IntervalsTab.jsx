/**
 * Intervals Tab
 *
 * Configures notification delivery for maintenance intervals.
 * Instead of creating complex rules, users pick a vehicle,
 * see its intervals with their threshold settings, and configure
 * which channels to notify directly on each interval.
 *
 * Data flow:
 *   1. Load vehicles list on mount
 *   2. On vehicle selection: load that vehicle's intervals + available channels
 *   3. Expand an interval to see thresholds (read-only) and configure delivery
 *   4. Save updates via vehicles.intervals.update()
 */
import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Bell, BellOff, Save, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react'
import { vehicles, notifications } from '../../api/client'

// Status badge styles (matches ServiceIntervalsTab)
const STATUS_STYLES = {
  ok: { bg: 'rgba(166, 227, 161, 0.1)', color: 'var(--color-green)', label: 'OK', icon: CheckCircle },
  due_soon: { bg: 'rgba(249, 226, 175, 0.1)', color: 'var(--color-yellow)', label: 'Due Soon', icon: Clock },
  due: { bg: 'rgba(250, 179, 135, 0.1)', color: 'var(--color-peach)', label: 'Due', icon: AlertTriangle },
  overdue: { bg: 'rgba(243, 139, 168, 0.1)', color: 'var(--color-red)', label: 'Overdue', icon: AlertTriangle },
  unknown: { bg: 'rgba(108, 112, 134, 0.1)', color: 'var(--color-overlay-0)', label: 'Unknown', icon: Clock },
}

// Available template variables shown as clickable chips
const TEMPLATE_VARIABLES = [
  'vehicle_name', 'item_name', 'item_category', 'status',
  'miles_remaining', 'days_remaining', 'miles_overdue', 'days_overdue',
  'next_due_mileage', 'next_due_date',
]

const DEFAULT_TITLE = '{{item_name}} - {{status}}'
const DEFAULT_BODY = '{{item_name}} on {{vehicle_name}} is {{status}}. Miles: {{miles_overdue}} overdue. Days: {{days_overdue}} overdue.'

// Priority options
const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export default function IntervalsTab() {
  // Vehicle selection
  const [vehicleList, setVehicleList] = useState([])
  const [selectedVehicleId, setSelectedVehicleId] = useState('')

  // Interval + channel data
  const [intervalList, setIntervalList] = useState([])
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [intervalsLoading, setIntervalsLoading] = useState(false)

  // Which interval is expanded for editing
  const [expandedId, setExpandedId] = useState(null)

  // Local edit state for the expanded interval's delivery config
  const [editState, setEditState] = useState({
    notification_channel_ids: [],
    notification_priority: 'normal',
    notification_title_template: DEFAULT_TITLE,
    notification_body_template: DEFAULT_BODY,
    notification_timing: 'immediate',
  })

  // Save feedback
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState(null)

  // ── Load vehicles on mount ─────────────────────────────────────
  useEffect(() => {
    async function loadVehicles() {
      try {
        const data = await vehicles.list()
        setVehicleList(data)
        // Auto-select if only one vehicle
        if (data.length === 1) {
          handleVehicleChange(String(data[0].id))
        }
      } catch (err) {
        console.error('Failed to load vehicles:', err)
      } finally {
        setLoading(false)
      }
    }
    loadVehicles()
  }, [])

  // ── Handlers ───────────────────────────────────────────────────

  /** Load intervals + channels when vehicle is selected */
  async function handleVehicleChange(vehicleId) {
    setSelectedVehicleId(vehicleId)
    setExpandedId(null)
    setSaveMessage(null)
    if (!vehicleId) {
      setIntervalList([])
      return
    }
    setIntervalsLoading(true)
    try {
      const [intervalsData, channelData] = await Promise.all([
        vehicles.intervals.list(vehicleId),
        notifications.channels.list(),
      ])
      setIntervalList(intervalsData)
      setChannels(channelData)
    } catch (err) {
      console.error('Failed to load intervals:', err)
    } finally {
      setIntervalsLoading(false)
    }
  }

  /** Expand/collapse an interval. Initializes edit state from current config. */
  function handleExpand(interval) {
    if (expandedId === interval.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(interval.id)
    setSaveMessage(null)
    // Initialize from existing config or defaults
    setEditState({
      notification_channel_ids: interval.notification_channel_ids || [],
      notification_priority: interval.notification_priority || 'normal',
      notification_title_template: interval.notification_title_template || DEFAULT_TITLE,
      notification_body_template: interval.notification_body_template || DEFAULT_BODY,
      notification_timing: interval.notification_timing || 'immediate',
    })
  }

  /** Toggle a channel in the edit state */
  function toggleChannel(channelId) {
    setEditState(prev => {
      const ids = prev.notification_channel_ids || []
      const next = ids.includes(channelId)
        ? ids.filter(id => id !== channelId)
        : [...ids, channelId]
      return { ...prev, notification_channel_ids: next }
    })
  }

  /** Insert a {{variable}} into a template field */
  function insertVariable(varKey, fieldName) {
    const insertion = `{{${varKey}}}`
    setEditState(prev => ({
      ...prev,
      [fieldName]: (prev[fieldName] || '') + insertion,
    }))
  }

  /** Save the notification delivery config for the expanded interval */
  async function handleSave(intervalId) {
    setSaving(true)
    setSaveMessage(null)
    try {
      await vehicles.intervals.update(intervalId, {
        notification_channel_ids: editState.notification_channel_ids,
        notification_priority: editState.notification_priority,
        notification_title_template: editState.notification_title_template,
        notification_body_template: editState.notification_body_template,
        notification_timing: editState.notification_timing,
      })
      // Reload intervals to reflect saved state
      const updated = await vehicles.intervals.list(selectedVehicleId)
      setIntervalList(updated)
      setSaveMessage({ type: 'success', text: 'Notification config saved.' })
      setTimeout(() => setSaveMessage(null), 4000)
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to save: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  /** Clear notification config for an interval (revert to generic rules) */
  async function handleClearConfig(intervalId) {
    setSaving(true)
    setSaveMessage(null)
    try {
      await vehicles.intervals.update(intervalId, {
        notification_channel_ids: null,
        notification_priority: null,
        notification_title_template: null,
        notification_body_template: null,
        notification_timing: 'immediate',
      })
      const updated = await vehicles.intervals.list(selectedVehicleId)
      setIntervalList(updated)
      setEditState({
        notification_channel_ids: [],
        notification_priority: 'normal',
        notification_title_template: DEFAULT_TITLE,
        notification_body_template: DEFAULT_BODY,
        notification_timing: 'immediate',
      })
      setSaveMessage({ type: 'success', text: 'Notification config cleared.' })
      setTimeout(() => setSaveMessage(null), 4000)
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'Failed to clear: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Group intervals into sections: Common first (sort_order < 100), then by category.
   * Returns array of { label, items }.
   */
  function getGroupedIntervals() {
    // Items are returned sorted by sort_order from the API.
    // Items with sort_order < 100 are "common" and should appear first.
    const common = intervalList.filter(i => (i.sort_order || 999) < 100)
    const rest = intervalList.filter(i => (i.sort_order || 999) >= 100)

    const catGroups = {}
    for (const interval of rest) {
      const cat = interval.item_category || 'Other'
      if (!catGroups[cat]) catGroups[cat] = []
      catGroups[cat].push(interval)
    }

    const sections = []
    if (common.length > 0) {
      sections.push({ label: 'Common', items: common })
    }
    for (const key of Object.keys(catGroups).sort()) {
      sections.push({ label: key, items: catGroups[key] })
    }
    return sections
  }

  /** Check if an interval has notification delivery configured */
  function hasConfig(interval) {
    return interval.notification_channel_ids !== null && interval.notification_channel_ids !== undefined
  }

  /** Format threshold arrays for display */
  function formatThresholds(thresholds, unit) {
    if (!thresholds || thresholds.length === 0) return 'None configured'
    return thresholds.map(t => t === 0 ? 'At due' : `${t.toLocaleString()} ${unit} overdue`).join(', ')
  }

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
  }

  return (
    <div>
      {/* Description */}
      <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
        Configure which notification channels each maintenance interval delivers to when milestones are reached.
        Thresholds are set on the vehicle's Service Intervals tab.
      </p>

      {/* Vehicle selector */}
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.375rem' }}>
          Vehicle
        </label>
        <select
          value={selectedVehicleId}
          onChange={e => handleVehicleChange(e.target.value)}
          style={{ maxWidth: '400px' }}
        >
          <option value="">-- Select a vehicle --</option>
          {vehicleList.map(v => (
            <option key={v.id} value={v.id}>
              {v.year} {v.make} {v.model}{v.trim ? ` ${v.trim}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* No vehicle selected */}
      {!selectedVehicleId && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>
            Select a vehicle to configure interval notifications.
          </p>
        </div>
      )}

      {/* Loading intervals */}
      {selectedVehicleId && intervalsLoading && (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading intervals...</p>
      )}

      {/* No intervals */}
      {selectedVehicleId && !intervalsLoading && intervalList.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>
            No maintenance intervals configured for this vehicle.
          </p>
          <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Set up intervals on the vehicle's Service Intervals tab first.
          </p>
        </div>
      )}

      {/* No channels available */}
      {selectedVehicleId && !intervalsLoading && intervalList.length > 0 && channels.length === 0 && (
        <div className="card" style={{
          padding: '0.75rem 1rem', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'rgba(249, 226, 175, 0.08)', border: '1px solid rgba(249, 226, 175, 0.2)',
        }}>
          <Info size={16} style={{ color: 'var(--color-yellow)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--color-yellow)' }}>
            No notification channels configured. Create a channel on the Channels tab first.
          </span>
        </div>
      )}

      {/* Interval list grouped by section (Common first, then by category) */}
      {selectedVehicleId && !intervalsLoading && intervalList.length > 0 && (
        <div>
          {getGroupedIntervals().map(section => (
            <div key={section.label} style={{ marginBottom: '1.5rem' }}>
              {/* Section header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                marginBottom: '0.5rem', paddingBottom: '0.375rem',
                borderBottom: '1px solid var(--color-surface-1)',
              }}>
                <h3 style={{
                  fontSize: '0.95rem', fontWeight: 600,
                  color: section.label === 'Common' ? 'var(--color-blue)' : 'var(--color-text)',
                }}>
                  {section.label}
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                  ({section.items.length})
                </span>
              </div>

              {/* Interval rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {section.items.map(interval => {
                  const isExpanded = expandedId === interval.id
                  const configured = hasConfig(interval)
                  const statusStyle = STATUS_STYLES[interval.status || 'unknown'] || STATUS_STYLES.unknown
                  const StatusIcon = statusStyle.icon

                  return (
                    <div key={interval.id} className="card" style={{
                      padding: 0,
                      overflow: 'hidden',
                      opacity: interval.is_enabled === false ? 0.5 : 1,
                    }}>
                      {/* Clickable row header */}
                      <button
                        onClick={() => handleExpand(interval)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          width: '100%',
                          padding: '0.75rem 1rem',
                          background: isExpanded ? 'rgba(137, 180, 250, 0.04)' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--color-text)',
                          fontFamily: 'inherit',
                          fontSize: '0.9rem',
                          textAlign: 'left',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.03)' }}
                        onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                      >
                        {/* Expand chevron */}
                        {isExpanded ? <ChevronDown size={16} style={{ flexShrink: 0, color: 'var(--color-blue)' }} /> : <ChevronRight size={16} style={{ flexShrink: 0, color: 'var(--color-overlay-0)' }} />}

                        {/* Item name */}
                        <span style={{ fontWeight: 600, minWidth: '140px' }}>
                          {interval.item_name}
                        </span>

                        {/* Status badge */}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          fontSize: '0.7rem', padding: '0.125rem 0.5rem',
                          borderRadius: '9999px', background: statusStyle.bg,
                          color: statusStyle.color, fontWeight: 600, flexShrink: 0,
                        }}>
                          <StatusIcon size={10} />
                          {statusStyle.label}
                        </span>

                        {/* Progress summary */}
                        <span style={{
                          fontSize: '0.8rem', color: 'var(--color-overlay-0)',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                        }}>
                          {interval.status !== 'unknown' ? (
                            <>
                              {interval.miles_interval && interval.miles_remaining != null && (() => {
                                const used = Math.max(0, interval.miles_interval - interval.miles_remaining)
                                return `${used.toLocaleString()}/${interval.miles_interval.toLocaleString()} mi`
                              })()}
                              {interval.miles_interval && interval.miles_remaining != null && interval.months_interval && interval.last_service_date ? '  ·  ' : ''}
                              {interval.months_interval && interval.last_service_date && (() => {
                                const lastDate = new Date(interval.last_service_date)
                                const now = new Date()
                                const elapsed = Math.round((now - lastDate) / (1000 * 60 * 60 * 24 * 30.44))
                                return `${Math.max(0, elapsed)}/${interval.months_interval} mo`
                              })()}
                            </>
                          ) : (
                            <span style={{ fontStyle: 'italic', fontFamily: 'inherit' }}>No data</span>
                          )}
                        </span>

                        {/* Delivery status icon */}
                        {configured ? (
                          <Bell size={16} style={{ color: 'var(--color-green)', flexShrink: 0 }} />
                        ) : (
                          <BellOff size={16} style={{ color: 'var(--color-overlay-0)', flexShrink: 0 }} />
                        )}
                      </button>

                      {/* Expanded config panel */}
                      {isExpanded && (
                        <div style={{
                          padding: '1rem 1.25rem',
                          borderTop: '1px solid var(--color-surface-0)',
                          background: 'rgba(0, 0, 0, 0.1)',
                        }}>
                          {/* Thresholds section (read-only) */}
                          <div style={{
                            padding: '0.75rem 1rem',
                            background: 'var(--color-surface-0)',
                            borderRadius: '8px',
                            marginBottom: '1.25rem',
                          }}>
                            <div style={{
                              fontSize: '0.8rem', fontWeight: 600,
                              color: 'var(--color-subtext-0)', marginBottom: '0.5rem',
                            }}>
                              Notification Thresholds
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                              Miles: {formatThresholds(interval.notify_miles_thresholds, 'mi')}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text)', marginBottom: '0.5rem' }}>
                              Months: {formatThresholds(interval.notify_months_thresholds, 'mo')}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', fontStyle: 'italic' }}>
                              Edit thresholds on the vehicle's Service Intervals tab.
                            </p>
                          </div>

                          {/* Delivery Channels */}
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.5rem' }}>
                              Delivery Channels
                            </label>
                            {channels.length === 0 ? (
                              <p style={{ fontSize: '0.8rem', color: 'var(--color-overlay-0)' }}>
                                No channels available. Create one on the Channels tab.
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                {channels.map(ch => {
                                  const isSelected = (editState.notification_channel_ids || []).includes(ch.id)
                                  return (
                                    <label
                                      key={ch.id}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                                        cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: '8px',
                                        background: isSelected ? 'rgba(137, 180, 250, 0.06)' : 'transparent',
                                        border: isSelected ? '1px solid rgba(137, 180, 250, 0.2)' : '1px solid var(--color-surface-0)',
                                        transition: 'all 0.15s ease',
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleChannel(ch.id)}
                                        style={{ width: 'auto' }}
                                      />
                                      <span style={{ fontSize: '0.85rem', fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>
                                        {ch.name}
                                      </span>
                                      <span style={{
                                        fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                                        background: 'var(--color-surface-0)', color: 'var(--color-overlay-1)', marginLeft: 'auto',
                                      }}>
                                        {ch.channel_type}
                                      </span>
                                      {!ch.is_enabled && (
                                        <span style={{ fontSize: '0.65rem', color: 'var(--color-overlay-0)' }}>(disabled)</span>
                                      )}
                                    </label>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Priority */}
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.375rem' }}>
                              Priority
                            </label>
                            <select
                              value={editState.notification_priority}
                              onChange={e => setEditState(prev => ({ ...prev, notification_priority: e.target.value }))}
                              style={{ maxWidth: '200px' }}
                            >
                              {PRIORITIES.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* Timing */}
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.5rem' }}>
                              When to Notify
                            </label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                              {[
                                { value: 'immediate', label: 'Immediately', desc: 'As soon as a threshold is reached (fuel-up, maintenance log, or daily check)' },
                                { value: 'scheduled', label: 'Daily Check Only', desc: 'Only during the daily 9 AM scheduled check' },
                              ].map(opt => {
                                const isSelected = editState.notification_timing === opt.value
                                return (
                                  <label
                                    key={opt.value}
                                    style={{
                                      flex: 1,
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '0.5rem',
                                      cursor: 'pointer',
                                      padding: '0.625rem 0.75rem',
                                      borderRadius: '8px',
                                      background: isSelected ? 'rgba(137, 180, 250, 0.06)' : 'transparent',
                                      border: isSelected ? '1px solid rgba(137, 180, 250, 0.2)' : '1px solid var(--color-surface-0)',
                                      transition: 'all 0.15s ease',
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name="notification_timing"
                                      value={opt.value}
                                      checked={isSelected}
                                      onChange={e => setEditState(prev => ({ ...prev, notification_timing: e.target.value }))}
                                      style={{ width: 'auto', marginTop: '0.15rem' }}
                                    />
                                    <div>
                                      <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{opt.label}</div>
                                      <div style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.125rem' }}>{opt.desc}</div>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>

                          {/* Title template */}
                          <div style={{ marginBottom: '1rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.375rem' }}>
                              Title Template
                            </label>
                            <input
                              type="text"
                              value={editState.notification_title_template}
                              onChange={e => setEditState(prev => ({ ...prev, notification_title_template: e.target.value }))}
                              placeholder={DEFAULT_TITLE}
                            />
                          </div>

                          {/* Body template */}
                          <div style={{ marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.375rem' }}>
                              Body Template
                            </label>
                            <textarea
                              rows={3}
                              value={editState.notification_body_template}
                              onChange={e => setEditState(prev => ({ ...prev, notification_body_template: e.target.value }))}
                              placeholder={DEFAULT_BODY}
                            />
                          </div>

                          {/* Variable chips */}
                          <div style={{ marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginBottom: '0.375rem' }}>
                              Click to insert variable into body:
                            </p>
                            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                              {TEMPLATE_VARIABLES.map(v => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => insertVariable(v, 'notification_body_template')}
                                  style={{
                                    fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                                    background: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)',
                                    border: '1px solid rgba(137, 180, 250, 0.2)', cursor: 'pointer',
                                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(137, 180, 250, 0.2)' }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(137, 180, 250, 0.1)' }}
                                >
                                  {`{{${v}}}`}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Save message */}
                          {saveMessage && (
                            <div style={{
                              padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.75rem',
                              fontSize: '0.85rem',
                              background: saveMessage.type === 'success' ? 'rgba(166, 227, 161, 0.1)' : 'rgba(243, 139, 168, 0.1)',
                              color: saveMessage.type === 'success' ? 'var(--color-green)' : 'var(--color-red)',
                            }}>
                              {saveMessage.text}
                            </div>
                          )}

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            {configured && (
                              <button
                                className="btn btn-ghost"
                                onClick={() => handleClearConfig(interval.id)}
                                disabled={saving}
                                style={{ fontSize: '0.85rem' }}
                              >
                                Clear Config
                              </button>
                            )}
                            <button
                              className="btn btn-primary"
                              onClick={() => handleSave(interval.id)}
                              disabled={saving || channels.length === 0}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}
                            >
                              <Save size={14} />
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
