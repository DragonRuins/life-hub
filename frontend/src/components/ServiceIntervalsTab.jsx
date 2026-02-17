/**
 * ServiceIntervalsTab - Displays all configured maintenance intervals for a vehicle.
 *
 * Shows interval cards grouped by category with visual status indicators,
 * progress bars, and inline editing. Allows setting up default intervals
 * or adding custom ones from the global maintenance items catalog.
 *
 * Props:
 *   vehicleId (number) - The vehicle ID to load intervals for
 *   vehicle (object) - The vehicle object (with current_mileage, etc.)
 */
import { useState, useEffect, useCallback } from 'react'
import { Wrench, Plus, Pencil, Trash2, X, Settings, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { vehicles } from '../api/client'

export default function ServiceIntervalsTab({ vehicleId, vehicle }) {
  // ── State ──────────────────────────────────────────────────────
  const [intervals, setIntervals] = useState([])
  const [maintenanceItems, setMaintenanceItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Which interval card is being edited (by interval id)
  const [editingId, setEditingId] = useState(null)
  // Edit form data for the interval currently being edited
  const [editForm, setEditForm] = useState({})

  // "Add Interval" modal state
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    item_id: '',
    miles_interval: '',
    months_interval: '',
    condition_type: 'or',
    notify_miles_thresholds: '',
    notify_months_thresholds: '',
  })

  // Confirmation dialog for deleting an interval
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // ── Data loading ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [intervalsData, itemsData] = await Promise.all([
        vehicles.intervals.list(vehicleId),
        vehicles.maintenanceItems.list(),
      ])
      setIntervals(intervalsData)
      setMaintenanceItems(itemsData)
      setError(null)
    } catch (err) {
      console.error('Failed to load intervals:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Handlers ───────────────────────────────────────────────────

  /** Set up default intervals for this vehicle */
  async function handleSetupDefaults() {
    try {
      await vehicles.intervals.setupDefaults(vehicleId)
      await loadData()
    } catch (err) {
      alert('Failed to set up defaults: ' + err.message)
    }
  }

  /** Start editing an interval inline */
  function startEditing(interval) {
    setEditingId(interval.id)
    setEditForm({
      miles_interval: interval.miles_interval ?? '',
      months_interval: interval.months_interval ?? '',
      condition_type: interval.condition_type || 'or',
      notify_miles_thresholds: (interval.notify_miles_thresholds || []).join(', '),
      notify_months_thresholds: (interval.notify_months_thresholds || []).join(', '),
    })
  }

  /** Save the inline edit for an interval */
  async function handleSaveEdit(intervalId) {
    try {
      // Parse comma-separated threshold strings into arrays of numbers
      const milesThresholds = editForm.notify_miles_thresholds
        ? editForm.notify_miles_thresholds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : []
      const monthsThresholds = editForm.notify_months_thresholds
        ? editForm.notify_months_thresholds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : []

      await vehicles.intervals.update(intervalId, {
        miles_interval: editForm.miles_interval ? parseInt(editForm.miles_interval) : null,
        months_interval: editForm.months_interval ? parseInt(editForm.months_interval) : null,
        condition_type: editForm.condition_type,
        notify_miles_thresholds: milesThresholds,
        notify_months_thresholds: monthsThresholds,
      })
      setEditingId(null)
      await loadData()
    } catch (err) {
      alert('Failed to update interval: ' + err.message)
    }
  }

  /** Toggle enabled/disabled for an interval */
  async function handleToggleEnabled(interval) {
    try {
      await vehicles.intervals.update(interval.id, {
        is_enabled: !interval.is_enabled,
      })
      await loadData()
    } catch (err) {
      alert('Failed to toggle interval: ' + err.message)
    }
  }

  /** Delete an interval after confirmation */
  async function handleDelete(intervalId) {
    try {
      await vehicles.intervals.delete(intervalId)
      setConfirmDeleteId(null)
      await loadData()
    } catch (err) {
      alert('Failed to delete interval: ' + err.message)
    }
  }

  /** Add a new interval from the add modal */
  async function handleAddInterval(e) {
    e.preventDefault()
    try {
      const milesThresholds = addForm.notify_miles_thresholds
        ? addForm.notify_miles_thresholds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : []
      const monthsThresholds = addForm.notify_months_thresholds
        ? addForm.notify_months_thresholds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
        : []

      await vehicles.intervals.create(vehicleId, {
        item_id: parseInt(addForm.item_id),
        miles_interval: addForm.miles_interval ? parseInt(addForm.miles_interval) : null,
        months_interval: addForm.months_interval ? parseInt(addForm.months_interval) : null,
        condition_type: addForm.condition_type,
        notify_miles_thresholds: milesThresholds,
        notify_months_thresholds: monthsThresholds,
      })
      setShowAddModal(false)
      setAddForm({
        item_id: '',
        miles_interval: '',
        months_interval: '',
        condition_type: 'or',
        notify_miles_thresholds: '',
        notify_months_thresholds: '',
      })
      await loadData()
    } catch (err) {
      alert('Failed to add interval: ' + err.message)
    }
  }

  // ── Derived data ───────────────────────────────────────────────

  /** Count intervals by status for the summary banner */
  function getStatusCounts() {
    const counts = { overdue: 0, due: 0, due_soon: 0, ok: 0, unknown: 0 }
    for (const interval of intervals) {
      const status = interval.status || 'unknown'
      if (counts[status] !== undefined) {
        counts[status]++
      } else {
        counts.unknown++
      }
    }
    return counts
  }

  /**
   * Group intervals into sections: "Common" items first (sort_order < 100),
   * then the rest grouped by category. Returns array of { label, items }.
   */
  function getGroupedIntervals() {
    // Use the sort_order from the item to determine common vs rest.
    // Items returned by the API are sorted by sort_order, and each interval
    // has item_sort_order if the to_dict includes it. We'll use the
    // maintenanceItems list to look up sort_order.
    const itemSortOrder = {}
    for (const item of maintenanceItems) {
      itemSortOrder[item.id] = item.sort_order ?? 999
    }

    const common = intervals.filter(i => (itemSortOrder[i.item_id] ?? 999) < 100)
    const rest = intervals.filter(i => (itemSortOrder[i.item_id] ?? 999) >= 100)

    // Group the rest by category
    const catGroups = {}
    for (const interval of rest) {
      const cat = interval.item_category || 'Other'
      if (!catGroups[cat]) catGroups[cat] = []
      catGroups[cat].push(interval)
    }

    const sections = []
    if (common.length > 0) {
      // Sort common items by their sort_order
      common.sort((a, b) => (itemSortOrder[a.item_id] ?? 999) - (itemSortOrder[b.item_id] ?? 999))
      sections.push({ label: 'Common', items: common })
    }
    for (const key of Object.keys(catGroups).sort()) {
      sections.push({ label: key, items: catGroups[key] })
    }
    return sections
  }

  /** Items not yet configured as intervals for this vehicle */
  function getAvailableItems() {
    const configuredItemIds = new Set(intervals.map(i => i.item_id))
    return maintenanceItems.filter(item => !configuredItemIds.has(item.id))
  }

  // ── Status helpers ─────────────────────────────────────────────

  /** Get the color CSS variable for a given status */
  function statusColor(status) {
    switch (status) {
      case 'ok': return 'var(--color-green)'
      case 'due_soon': return 'var(--color-yellow)'
      case 'due': return 'var(--color-peach)'
      case 'overdue': return 'var(--color-red)'
      default: return 'var(--color-overlay-0)'
    }
  }

  /** Get a human-readable label for a status */
  function statusLabel(status) {
    switch (status) {
      case 'ok': return 'OK'
      case 'due_soon': return 'Due Soon'
      case 'due': return 'Due'
      case 'overdue': return 'Overdue'
      default: return 'Unknown'
    }
  }

  /** Get the icon for a status */
  function statusIcon(status) {
    switch (status) {
      case 'ok': return <CheckCircle size={14} />
      case 'due_soon': return <Clock size={14} />
      case 'due': return <AlertTriangle size={14} />
      case 'overdue': return <AlertTriangle size={14} />
      default: return <Clock size={14} />
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-subtext-0)' }}>
        Loading service intervals...
      </div>
    )
  }

  if (error) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <AlertTriangle size={24} style={{ color: 'var(--color-red)', marginBottom: '0.5rem' }} />
        <p style={{ color: 'var(--color-red)' }}>Failed to load intervals: {error}</p>
        <button className="btn btn-primary" onClick={loadData} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    )
  }

  // No intervals configured yet - show setup button
  if (intervals.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <Settings size={32} style={{ color: 'var(--color-subtext-0)', marginBottom: '1rem' }} />
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.95rem', marginBottom: '1rem' }}>
          No maintenance intervals configured yet.
        </p>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          Set up default intervals to track oil changes, filters, fluids, and more.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={handleSetupDefaults}>
            <Settings size={16} style={{ marginRight: '0.5rem' }} />
            Setup Default Intervals
          </button>
          <button className="btn btn-ghost" onClick={() => setShowAddModal(true)}>
            <Plus size={16} style={{ marginRight: '0.5rem' }} />
            Add Custom Interval
          </button>
        </div>

        {/* Add Interval Modal (also available when empty) */}
        {showAddModal && renderAddModal()}
      </div>
    )
  }

  const statusCounts = getStatusCounts()
  const sections = getGroupedIntervals()

  return (
    <div>
      {/* Summary Banner */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text)' }}>
            Status Overview
          </span>
          {statusCounts.overdue > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-red)', display: 'inline-block' }} />
              <span style={{ color: 'var(--color-red)', fontWeight: 600 }}>{statusCounts.overdue} Overdue</span>
            </span>
          )}
          {statusCounts.due > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-peach)', display: 'inline-block' }} />
              <span style={{ color: 'var(--color-peach)', fontWeight: 600 }}>{statusCounts.due} Due</span>
            </span>
          )}
          {statusCounts.due_soon > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-yellow)', display: 'inline-block' }} />
              <span style={{ color: 'var(--color-yellow)', fontWeight: 600 }}>{statusCounts.due_soon} Due Soon</span>
            </span>
          )}
          {statusCounts.ok > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-green)', display: 'inline-block' }} />
              <span style={{ color: 'var(--color-green)', fontWeight: 600 }}>{statusCounts.ok} OK</span>
            </span>
          )}
          {statusCounts.unknown > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-overlay-0)', display: 'inline-block' }} />
              <span style={{ color: 'var(--color-overlay-0)' }}>{statusCounts.unknown} Unknown</span>
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          <Plus size={14} style={{ marginRight: '0.5rem' }} />
          Add Interval
        </button>
      </div>

      {/* Grouped Interval Cards (Common first, then by category) */}
      {sections.map(section => (
        <div key={section.label} style={{ marginBottom: '1.5rem' }}>
          {/* Section Header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            marginBottom: '0.75rem', paddingBottom: '0.5rem',
            borderBottom: '1px solid var(--color-surface-1)',
          }}>
            <Wrench size={16} style={{ color: section.label === 'Common' ? 'var(--color-blue)' : 'var(--color-blue)' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {section.label}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
              ({section.items.length})
            </span>
          </div>

          {/* Interval Cards in this section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {section.items.map(interval => renderIntervalCard(interval))}
          </div>
        </div>
      ))}

      {/* Add Interval Modal */}
      {showAddModal && renderAddModal()}
    </div>
  )

  // ── Sub-render: Single interval card ───────────────────────────

  function renderIntervalCard(interval) {
    const isEditing = editingId === interval.id
    const color = statusColor(interval.status)
    const label = statusLabel(interval.status)

    // Calculate miles remaining/overdue text
    const milesRemaining = interval.miles_remaining
    const daysRemaining = interval.days_remaining
    const percentMiles = interval.percent_miles ?? null

    return (
      <div key={interval.id} className="card" style={{
        padding: '1rem 1.25rem',
        opacity: interval.is_enabled === false ? 0.5 : 1,
        borderLeft: `3px solid ${color}`,
      }}>
        {/* Top row: Name + Status badge + actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>
              {interval.item_name}
            </span>
            {/* Category badge */}
            <span style={{
              fontSize: '0.7rem', padding: '0.125rem 0.5rem',
              borderRadius: '9999px', background: 'var(--color-surface-1)',
              color: 'var(--color-subtext-0)', fontWeight: 500,
            }}>
              {interval.item_category || 'Other'}
            </span>
            {/* Status badge */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
              fontSize: '0.75rem', padding: '0.125rem 0.5rem',
              borderRadius: '9999px', background: color + '22',
              color: color, fontWeight: 600,
            }}>
              {statusIcon(interval.status)}
              {label}
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            {/* Enabled toggle */}
            <button
              onClick={() => handleToggleEnabled(interval)}
              title={interval.is_enabled ? 'Disable interval' : 'Enable interval'}
              style={{
                width: '36px', height: '20px', borderRadius: '10px', border: 'none',
                background: interval.is_enabled !== false ? 'var(--color-green)' : 'var(--color-surface-1)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: '2px',
                left: interval.is_enabled !== false ? '18px' : '2px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'white', transition: 'left 0.2s',
              }} />
            </button>

            {/* Edit button */}
            {!isEditing && (
              <button
                className="btn btn-ghost"
                onClick={() => startEditing(interval)}
                style={{ padding: '0.375rem' }}
                title="Edit interval"
              >
                <Pencil size={14} />
              </button>
            )}

            {/* Delete button */}
            <button
              className="btn btn-ghost"
              onClick={() => setConfirmDeleteId(interval.id)}
              style={{ padding: '0.375rem', color: 'var(--color-red)' }}
              title="Delete interval"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* Progress indicators */}
        {interval.status !== 'unknown' ? (
          <div style={{ marginBottom: '0.75rem' }}>
            {/* Miles progress */}
            {interval.miles_interval && interval.last_service_mileage != null && (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>Mileage</span>
                  <span style={{
                    fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                    color: milesRemaining !== null && milesRemaining < 0 ? 'var(--color-red)' : 'var(--color-text)',
                  }}>
                    {(() => {
                      if (interval.next_due_mileage == null) return '—'
                      const current = vehicle?.current_mileage || 0
                      const used = current - (interval.last_service_mileage || 0)
                      return `${Math.max(0, used).toLocaleString()} / ${interval.miles_interval.toLocaleString()} mi`
                    })()}
                  </span>
                </div>
                <div style={{
                  width: '100%', height: '6px', borderRadius: '3px',
                  background: 'var(--color-surface-1)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(Math.max(percentMiles || 0, 0), 100)}%`,
                    height: '100%', borderRadius: '3px', transition: 'width 0.3s',
                    background: (percentMiles || 0) >= 100
                      ? 'var(--color-red)'
                      : (percentMiles || 0) >= 80
                        ? 'var(--color-yellow)'
                        : 'var(--color-green)',
                  }} />
                </div>
                {milesRemaining !== null && milesRemaining < 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-red)', marginTop: '0.125rem', fontWeight: 500 }}>
                    {Math.abs(milesRemaining).toLocaleString()} mi overdue
                  </div>
                )}
              </div>
            )}

            {/* Time progress */}
            {interval.months_interval && interval.last_service_date && (
              <div style={{ marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>Time</span>
                  <span style={{
                    fontSize: '0.85rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                    color: daysRemaining !== null && daysRemaining < 0 ? 'var(--color-red)' : 'var(--color-text)',
                  }}>
                    {(() => {
                      if (interval.last_service_date == null) return '—'
                      const lastDate = new Date(interval.last_service_date)
                      const now = new Date()
                      // Elapsed months (approximate)
                      const elapsedMonths = Math.round((now - lastDate) / (1000 * 60 * 60 * 24 * 30.44))
                      return `${Math.max(0, elapsedMonths)} / ${interval.months_interval} mo`
                    })()}
                  </span>
                </div>
                <div style={{
                  width: '100%', height: '6px', borderRadius: '3px',
                  background: 'var(--color-surface-1)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(Math.max(interval.percent_time || 0, 0), 100)}%`,
                    height: '100%', borderRadius: '3px', transition: 'width 0.3s',
                    background: (interval.percent_time || 0) >= 100
                      ? 'var(--color-red)'
                      : (interval.percent_time || 0) >= 80
                        ? 'var(--color-yellow)'
                        : 'var(--color-green)',
                  }} />
                </div>
                {daysRemaining !== null && daysRemaining < 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-red)', marginTop: '0.125rem', fontWeight: 500 }}>
                    {Math.abs(daysRemaining)} days overdue
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: '0.8rem', color: 'var(--color-overlay-0)', marginBottom: '0.75rem', fontStyle: 'italic' }}>
            No service history — log a maintenance record to start tracking.
          </div>
        )}

        {/* Details row: last serviced + next due + interval config */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginBottom: '0.25rem' }}>
          <span>
            {interval.last_service_date
              ? `Serviced: ${formatDate(interval.last_service_date)}${interval.last_service_mileage ? ` @ ${interval.last_service_mileage.toLocaleString()} mi` : ''}`
              : 'Never serviced'}
          </span>
          {(interval.next_due_mileage || interval.next_due_date) && (
            <span>
              Due: {interval.next_due_mileage ? `${interval.next_due_mileage.toLocaleString()} mi` : ''}
              {interval.next_due_mileage && interval.next_due_date ? ' / ' : ''}
              {interval.next_due_date ? formatDate(interval.next_due_date) : ''}
            </span>
          )}
          <span style={{ color: 'var(--color-overlay-0)' }}>
            Every {interval.miles_interval ? `${interval.miles_interval.toLocaleString()} mi` : ''}
            {interval.miles_interval && interval.months_interval ? ` ${(interval.condition_type || 'or').toUpperCase()} ` : ''}
            {interval.months_interval ? `${interval.months_interval} mo` : ''}
          </span>
        </div>

        {/* Notification thresholds */}
        {interval.notify_miles_thresholds && interval.notify_miles_thresholds.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', fontFamily: 'var(--font-mono)' }}>
            Notify at: [{interval.notify_miles_thresholds.join(', ')}] miles past due
          </div>
        )}

        {/* Confirm delete dialog */}
        {confirmDeleteId === interval.id && (
          <div style={{
            marginTop: '0.75rem', padding: '0.75rem',
            background: 'var(--color-surface-0)', borderRadius: '8px',
            display: 'flex', alignItems: 'center', gap: '0.75rem',
          }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>Delete this interval?</span>
            <div style={{ display: 'flex', gap: '0.375rem', marginLeft: 'auto' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteId(null)} style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={() => handleDelete(interval.id)} style={{ fontSize: '0.8rem' }}>
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Inline Edit Form */}
        {isEditing && (
          <div style={{
            marginTop: '0.75rem', padding: '1rem',
            background: 'var(--color-surface-0)', borderRadius: '8px',
          }}>
            <div className="form-grid-3col" style={{ marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                  Miles Interval
                </label>
                <input
                  type="number"
                  value={editForm.miles_interval}
                  onChange={e => setEditForm({ ...editForm, miles_interval: e.target.value })}
                  placeholder="5000"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                  Months Interval
                </label>
                <input
                  type="number"
                  value={editForm.months_interval}
                  onChange={e => setEditForm({ ...editForm, months_interval: e.target.value })}
                  placeholder="6"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                  Condition
                </label>
                <select
                  value={editForm.condition_type}
                  onChange={e => setEditForm({ ...editForm, condition_type: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="or">OR (whichever first)</option>
                  <option value="and">AND (both must be met)</option>
                </select>
              </div>
            </div>
            <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                  Miles Thresholds (comma-separated)
                </label>
                <input
                  type="text"
                  value={editForm.notify_miles_thresholds}
                  onChange={e => setEditForm({ ...editForm, notify_miles_thresholds: e.target.value })}
                  placeholder="0, 500, 1000"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                  Months Thresholds (comma-separated)
                </label>
                <input
                  type="text"
                  value={editForm.notify_months_thresholds}
                  onChange={e => setEditForm({ ...editForm, notify_months_thresholds: e.target.value })}
                  placeholder="0, 1"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setEditingId(null)} style={{ fontSize: '0.8rem' }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => handleSaveEdit(interval.id)} style={{ fontSize: '0.8rem' }}>
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Sub-render: Add Interval Modal ─────────────────────────────

  function renderAddModal() {
    const availableItems = getAvailableItems()

    // Group available items by category for the dropdown
    const grouped = {}
    for (const item of availableItems) {
      const cat = item.category || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    }

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div className="card" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Add Maintenance Interval</h2>
            <button className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
              <X size={18} />
            </button>
          </div>

          {availableItems.length === 0 ? (
            <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem', textAlign: 'center', padding: '1rem 0' }}>
              All maintenance items already have intervals configured.
            </p>
          ) : (
            <form onSubmit={handleAddInterval}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                  Maintenance Item *
                </label>
                <select
                  value={addForm.item_id}
                  onChange={e => setAddForm({ ...addForm, item_id: e.target.value })}
                  required
                  style={{ width: '100%' }}
                >
                  <option value="">Select an item...</option>
                  {Object.entries(grouped).map(([cat, items]) => (
                    <optgroup key={cat} label={cat}>
                      {items.map(item => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                    Miles Interval
                  </label>
                  <input
                    type="number"
                    value={addForm.miles_interval}
                    onChange={e => setAddForm({ ...addForm, miles_interval: e.target.value })}
                    placeholder="5000"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                    Months Interval
                  </label>
                  <input
                    type="number"
                    value={addForm.months_interval}
                    onChange={e => setAddForm({ ...addForm, months_interval: e.target.value })}
                    placeholder="6"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                  Condition Type
                </label>
                <select
                  value={addForm.condition_type}
                  onChange={e => setAddForm({ ...addForm, condition_type: e.target.value })}
                  style={{ width: '100%' }}
                >
                  <option value="or">OR (whichever comes first)</option>
                  <option value="and">AND (both must be met)</option>
                </select>
              </div>

              <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                    Miles Notify Thresholds
                  </label>
                  <input
                    type="text"
                    value={addForm.notify_miles_thresholds}
                    onChange={e => setAddForm({ ...addForm, notify_miles_thresholds: e.target.value })}
                    placeholder="0, 500, 1000"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', display: 'block', marginBottom: '0.25rem' }}>
                    Months Notify Thresholds
                  </label>
                  <input
                    type="text"
                    value={addForm.notify_months_thresholds}
                    onChange={e => setAddForm({ ...addForm, notify_months_thresholds: e.target.value })}
                    placeholder="0, 1"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Interval
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )
  }
}

// ── Utility ────────────────────────────────────────────────────

/** Format an ISO date string to a human-readable format (e.g., "Jan 15, 2025") */
function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
