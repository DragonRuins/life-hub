/**
 * LCARSServiceIntervalsTab - LCARS-native service intervals display.
 *
 * Replaces ServiceIntervalsTab when LCARS theme is active.
 * Uses left accent bars colored by status, Antonio headers,
 * squared progress bars, and LCARS action/modal patterns.
 *
 * Props:
 *   vehicleId (number) - The vehicle ID to load intervals for
 *   vehicle (object) - The vehicle object (with current_mileage, etc.)
 */
import { useState, useEffect, useCallback } from 'react'
import { Wrench, Plus, Pencil, Trash2, X, Settings, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { vehicles } from '../../api/client'
import { formatShortDateWithYear } from '../../utils/formatDate'
import LCARSPanel from './LCARSPanel'

export default function LCARSServiceIntervalsTab({ vehicleId, vehicle }) {
  // ── State ──────────────────────────────────────────────────────
  const [intervals, setIntervals] = useState([])
  const [maintenanceItems, setMaintenanceItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    item_id: '',
    miles_interval: '',
    months_interval: '',
    condition_type: 'or',
    notify_miles_thresholds: '',
    notify_months_thresholds: '',
  })

  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [confirmEditId, setConfirmEditId] = useState(null)

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

  async function handleSetupDefaults() {
    try {
      await vehicles.intervals.setupDefaults(vehicleId)
      await loadData()
    } catch (err) {
      alert('Failed to set up defaults: ' + err.message)
    }
  }

  function startEditing(interval) {
    setConfirmEditId(null)
    setEditingId(interval.id)
    setEditForm({
      miles_interval: interval.miles_interval ?? '',
      months_interval: interval.months_interval ?? '',
      condition_type: interval.condition_type || 'or',
      notify_miles_thresholds: (interval.notify_miles_thresholds || []).join(', '),
      notify_months_thresholds: (interval.notify_months_thresholds || []).join(', '),
      last_service_date: interval.last_service_date || '',
      last_service_mileage: interval.last_service_mileage ?? '',
    })
  }

  async function handleSaveEdit(intervalId) {
    try {
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
        last_service_date: editForm.last_service_date || null,
        last_service_mileage: editForm.last_service_mileage ? parseInt(editForm.last_service_mileage) : null,
      })
      setEditingId(null)
      await loadData()
    } catch (err) {
      alert('Failed to update interval: ' + err.message)
    }
  }

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

  async function handleDelete(intervalId) {
    try {
      await vehicles.intervals.delete(intervalId)
      setConfirmDeleteId(null)
      await loadData()
    } catch (err) {
      alert('Failed to delete interval: ' + err.message)
    }
  }

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

  function getGroupedIntervals() {
    const itemSortOrder = {}
    for (const item of maintenanceItems) {
      itemSortOrder[item.id] = item.sort_order ?? 999
    }

    const common = intervals.filter(i => (itemSortOrder[i.item_id] ?? 999) < 100)
    const rest = intervals.filter(i => (itemSortOrder[i.item_id] ?? 999) >= 100)

    const catGroups = {}
    for (const interval of rest) {
      const cat = interval.item_category || 'Other'
      if (!catGroups[cat]) catGroups[cat] = []
      catGroups[cat].push(interval)
    }

    const sections = []
    if (common.length > 0) {
      common.sort((a, b) => (itemSortOrder[a.item_id] ?? 999) - (itemSortOrder[b.item_id] ?? 999))
      sections.push({ label: 'Common', items: common })
    }
    for (const key of Object.keys(catGroups).sort()) {
      sections.push({ label: key, items: catGroups[key] })
    }
    return sections
  }

  function getAvailableItems() {
    const configuredItemIds = new Set(intervals.map(i => i.item_id))
    return maintenanceItems.filter(item => !configuredItemIds.has(item.id))
  }

  // ── Status helpers ─────────────────────────────────────────────

  function statusColor(status) {
    switch (status) {
      case 'ok': return 'var(--lcars-green)'
      case 'due_soon': return 'var(--lcars-butterscotch)'
      case 'due': return 'var(--lcars-sunflower)'
      case 'overdue': return 'var(--lcars-tomato)'
      default: return 'var(--lcars-gray)'
    }
  }

  function statusLabel(status) {
    switch (status) {
      case 'ok': return 'OK'
      case 'due_soon': return 'Due Soon'
      case 'due': return 'Due'
      case 'overdue': return 'Overdue'
      default: return 'Unknown'
    }
  }

  function statusIcon(status) {
    switch (status) {
      case 'ok': return <CheckCircle size={12} />
      case 'due_soon': return <Clock size={12} />
      case 'due': return <AlertTriangle size={12} />
      case 'overdue': return <AlertTriangle size={12} />
      default: return <Clock size={12} />
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.85rem',
        color: 'var(--lcars-gray)',
      }}>
        Loading service intervals...
      </div>
    )
  }

  if (error) {
    return (
      <LCARSPanel title="System Error" color="var(--lcars-tomato)">
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <AlertTriangle size={24} style={{ color: 'var(--lcars-tomato)', marginBottom: '0.75rem' }} />
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.85rem',
            color: 'var(--lcars-tomato)',
            marginBottom: '1rem',
          }}>
            Failed to load intervals: {error}
          </div>
          <LCARSBtn onClick={loadData} color="var(--lcars-ice)">Retry</LCARSBtn>
        </div>
      </LCARSPanel>
    )
  }

  // No intervals configured yet
  if (intervals.length === 0) {
    return (
      <>
        <LCARSPanel title="No Intervals Configured" color="var(--lcars-gray)">
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Settings size={32} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem',
              color: 'var(--lcars-gray)',
              marginBottom: '0.5rem',
            }}>
              No maintenance intervals configured yet.
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.78rem',
              color: 'var(--lcars-gray)',
              opacity: 0.7,
              marginBottom: '1.5rem',
            }}>
              Set up defaults to track oil changes, filters, fluids, and more.
            </div>
            <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
              <LCARSBtn onClick={handleSetupDefaults} color="var(--lcars-ice)">
                <Settings size={14} /> Setup Defaults
              </LCARSBtn>
              <LCARSBtn onClick={() => setShowAddModal(true)} color="var(--lcars-sunflower)">
                <Plus size={14} /> Add Custom
              </LCARSBtn>
            </div>
          </div>
        </LCARSPanel>
        {showAddModal && renderAddModal()}
      </>
    )
  }

  const statusCounts = getStatusCounts()
  const sections = getGroupedIntervals()

  return (
    <div>
      {/* Status Overview Strip */}
      <div style={{
        display: 'flex',
        background: '#000000',
        border: '1px solid rgba(102, 102, 136, 0.3)',
        overflow: 'hidden',
        marginBottom: '1.25rem',
      }}>
        <div style={{ width: '5px', background: 'var(--lcars-butterscotch)', flexShrink: 0 }} />
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          padding: '0.625rem 1rem',
          flexWrap: 'wrap',
        }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.78rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--lcars-butterscotch)',
          }}>
            Status Overview
          </span>
          {statusCounts.overdue > 0 && (
            <StatusCount color="var(--lcars-tomato)" count={statusCounts.overdue} label="Overdue" />
          )}
          {statusCounts.due > 0 && (
            <StatusCount color="var(--lcars-sunflower)" count={statusCounts.due} label="Due" />
          )}
          {statusCounts.due_soon > 0 && (
            <StatusCount color="var(--lcars-butterscotch)" count={statusCounts.due_soon} label="Due Soon" />
          )}
          {statusCounts.ok > 0 && (
            <StatusCount color="var(--lcars-green)" count={statusCounts.ok} label="OK" />
          )}
          {statusCounts.unknown > 0 && (
            <StatusCount color="var(--lcars-gray)" count={statusCounts.unknown} label="Unknown" />
          )}
        </div>
      </div>

      {/* Add Interval Button */}
      <div style={{ marginBottom: '1.25rem' }}>
        <LCARSBtn onClick={() => setShowAddModal(true)} color="var(--lcars-ice)">
          <Plus size={14} /> Add Interval
        </LCARSBtn>
      </div>

      {/* Grouped Interval Cards */}
      {sections.map(section => (
        <div key={section.label} style={{ marginBottom: '1.5rem' }}>
          {/* Section Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.75rem',
            paddingBottom: '0.5rem',
            borderBottom: '2px solid var(--lcars-ice)',
          }}>
            <Wrench size={14} style={{ color: 'var(--lcars-ice)' }} />
            <span style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '0.88rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--lcars-ice)',
            }}>
              {section.label}
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.72rem',
              color: 'var(--lcars-gray)',
            }}>
              ({section.items.length})
            </span>
          </div>

          {/* Interval Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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

    const milesRemaining = interval.miles_remaining
    const daysRemaining = interval.days_remaining
    const percentMiles = interval.percent_miles ?? null

    return (
      <div key={interval.id} style={{
        display: 'flex',
        background: '#000000',
        border: '1px solid rgba(102, 102, 136, 0.3)',
        overflow: 'hidden',
        opacity: interval.is_enabled === false ? 0.45 : 1,
        transition: 'opacity 0.2s',
      }}>
        {/* Left accent bar - colored by status */}
        <div style={{
          width: '5px',
          background: color,
          flexShrink: 0,
        }} />

        <div style={{ flex: 1, padding: '0.75rem 1rem' }}>
          {/* Top row: Name + Status badge + actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.625rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap', minWidth: 0 }}>
              <span style={{
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--lcars-space-white)',
              }}>
                {interval.item_name}
              </span>

              {/* Category badge */}
              <span style={{
                padding: '0.1rem 0.5rem',
                background: 'rgba(102, 102, 136, 0.25)',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.62rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--lcars-gray)',
              }}>
                {interval.item_category || 'Other'}
              </span>

              {/* Status badge */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.1rem 0.5rem',
                background: color,
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.65rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--lcars-text-on-color)',
              }}>
                {statusIcon(interval.status)}
                {label}
              </span>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
              {/* Enable/Disable toggle */}
              <LCARSToggle
                enabled={interval.is_enabled !== false}
                onToggle={() => handleToggleEnabled(interval)}
              />

              {!isEditing && (
                <ActionBtn
                  onClick={() => setConfirmEditId(interval.id)}
                  title="Edit"
                >
                  <Pencil size={13} />
                </ActionBtn>
              )}

              <ActionBtn
                onClick={() => setConfirmDeleteId(interval.id)}
                title="Delete"
                hoverColor="var(--lcars-tomato)"
              >
                <Trash2 size={13} />
              </ActionBtn>
            </div>
          </div>

          {/* Progress indicators */}
          {interval.status !== 'unknown' ? (
            <div style={{ marginBottom: '0.625rem' }}>
              {/* Miles progress */}
              {interval.miles_interval && interval.last_service_mileage != null && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '0.25rem',
                  }}>
                    <span style={{
                      fontFamily: "'Antonio', sans-serif",
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--lcars-gray)',
                    }}>
                      Mileage
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: milesRemaining !== null && milesRemaining < 0
                        ? 'var(--lcars-tomato)'
                        : 'var(--lcars-space-white)',
                    }}>
                      {(() => {
                        if (interval.next_due_mileage == null) return '\u2014'
                        const current = vehicle?.current_mileage || 0
                        const used = current - (interval.last_service_mileage || 0)
                        return `${Math.max(0, used).toLocaleString()} / ${interval.miles_interval.toLocaleString()} mi`
                      })()}
                    </span>
                  </div>
                  {/* Squared LCARS progress bar */}
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(102, 102, 136, 0.2)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min(Math.max(percentMiles || 0, 0), 100)}%`,
                      height: '100%',
                      transition: 'width 0.3s',
                      background: (percentMiles || 0) >= 100
                        ? 'var(--lcars-tomato)'
                        : (percentMiles || 0) >= 80
                          ? 'var(--lcars-sunflower)'
                          : 'var(--lcars-green)',
                    }} />
                  </div>
                  {milesRemaining !== null && milesRemaining < 0 && (
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.7rem',
                      color: 'var(--lcars-tomato)',
                      marginTop: '0.125rem',
                      fontWeight: 600,
                    }}>
                      {Math.abs(milesRemaining).toLocaleString()} mi overdue
                    </div>
                  )}
                </div>
              )}

              {/* Time progress */}
              {interval.months_interval && interval.last_service_date && (
                <div style={{ marginBottom: '0.25rem' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: '0.25rem',
                  }}>
                    <span style={{
                      fontFamily: "'Antonio', sans-serif",
                      fontSize: '0.68rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--lcars-gray)',
                    }}>
                      Time
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: daysRemaining !== null && daysRemaining < 0
                        ? 'var(--lcars-tomato)'
                        : 'var(--lcars-space-white)',
                    }}>
                      {(() => {
                        if (interval.last_service_date == null) return '\u2014'
                        const lastDate = new Date(interval.last_service_date)
                        const now = new Date()
                        const elapsedMonths = Math.round((now - lastDate) / (1000 * 60 * 60 * 24 * 30.44))
                        return `${Math.max(0, elapsedMonths)} / ${interval.months_interval} mo`
                      })()}
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(102, 102, 136, 0.2)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min(Math.max(interval.percent_time || 0, 0), 100)}%`,
                      height: '100%',
                      transition: 'width 0.3s',
                      background: (interval.percent_time || 0) >= 100
                        ? 'var(--lcars-tomato)'
                        : (interval.percent_time || 0) >= 80
                          ? 'var(--lcars-sunflower)'
                          : 'var(--lcars-green)',
                    }} />
                  </div>
                  {daysRemaining !== null && daysRemaining < 0 && (
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.7rem',
                      color: 'var(--lcars-tomato)',
                      marginTop: '0.125rem',
                      fontWeight: 600,
                    }}>
                      {Math.abs(daysRemaining)} days overdue
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.78rem',
              color: 'var(--lcars-gray)',
              opacity: 0.7,
              marginBottom: '0.625rem',
              fontStyle: 'italic',
            }}>
              No service history — log a maintenance record to start tracking.
            </div>
          )}

          {/* Details row: last serviced + next due + interval config */}
          <div style={{
            display: 'flex',
            gap: '1.25rem',
            flexWrap: 'wrap',
            marginBottom: '0.25rem',
          }}>
            <DataField
              label="Serviced"
              value={interval.last_service_date
                ? `${formatShortDateWithYear(interval.last_service_date)}${interval.last_service_mileage ? ` @ ${interval.last_service_mileage.toLocaleString()} mi` : ''}`
                : 'Never'}
            />
            {(interval.next_due_mileage || interval.next_due_date) && (
              <DataField
                label="Due"
                value={[
                  interval.next_due_mileage ? `${interval.next_due_mileage.toLocaleString()} mi` : '',
                  interval.next_due_date ? formatShortDateWithYear(interval.next_due_date) : '',
                ].filter(Boolean).join(' / ')}
                color={color}
              />
            )}
            <DataField
              label="Interval"
              value={[
                interval.miles_interval ? `${interval.miles_interval.toLocaleString()} mi` : '',
                interval.miles_interval && interval.months_interval ? ` ${(interval.condition_type || 'or').toUpperCase()} ` : '',
                interval.months_interval ? `${interval.months_interval} mo` : '',
              ].join('')}
            />
          </div>

          {/* Notification thresholds */}
          {interval.notify_miles_thresholds && interval.notify_miles_thresholds.length > 0 && (
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.68rem',
              color: 'var(--lcars-gray)',
              opacity: 0.7,
              marginTop: '0.25rem',
            }}>
              Notify at: [{interval.notify_miles_thresholds.join(', ')}] miles past due
            </div>
          )}

          {/* Confirm edit dialog */}
          {confirmEditId === interval.id && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.625rem 0.75rem',
              background: 'rgba(153, 204, 255, 0.08)',
              border: '1px solid rgba(153, 204, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <Pencil size={14} style={{ color: 'var(--lcars-ice)', flexShrink: 0 }} />
              <span style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--lcars-space-white)',
              }}>
                Edit this interval?
              </span>
              <div style={{ display: 'flex', gap: '3px', marginLeft: 'auto' }}>
                <LCARSBtn onClick={() => setConfirmEditId(null)} color="var(--lcars-gray)">Cancel</LCARSBtn>
                <LCARSBtn onClick={() => startEditing(interval)} color="var(--lcars-ice)">Edit</LCARSBtn>
              </div>
            </div>
          )}

          {/* Confirm delete dialog */}
          {confirmDeleteId === interval.id && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.625rem 0.75rem',
              background: 'rgba(255, 85, 85, 0.08)',
              border: '1px solid rgba(255, 85, 85, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <AlertTriangle size={14} style={{ color: 'var(--lcars-tomato)', flexShrink: 0 }} />
              <span style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--lcars-space-white)',
              }}>
                Delete this interval?
              </span>
              <div style={{ display: 'flex', gap: '3px', marginLeft: 'auto' }}>
                <LCARSBtn onClick={() => setConfirmDeleteId(null)} color="var(--lcars-gray)">Cancel</LCARSBtn>
                <LCARSBtn onClick={() => handleDelete(interval.id)} color="var(--lcars-tomato)">Delete</LCARSBtn>
              </div>
            </div>
          )}

          {/* Inline Edit Form */}
          {isEditing && (
            <div style={{
              marginTop: '0.75rem',
              padding: '1rem',
              background: 'rgba(102, 102, 136, 0.06)',
              border: '1px solid rgba(102, 102, 136, 0.2)',
            }}>
              <div className="form-grid-3col" style={{ marginBottom: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Miles Interval</label>
                  <input
                    type="number"
                    value={editForm.miles_interval}
                    onChange={e => setEditForm({ ...editForm, miles_interval: e.target.value })}
                    placeholder="5000"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Months Interval</label>
                  <input
                    type="number"
                    value={editForm.months_interval}
                    onChange={e => setEditForm({ ...editForm, months_interval: e.target.value })}
                    placeholder="6"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Condition</label>
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
                  <label style={labelStyle}>Miles Thresholds (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.notify_miles_thresholds}
                    onChange={e => setEditForm({ ...editForm, notify_miles_thresholds: e.target.value })}
                    placeholder="0, 500, 1000"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Months Thresholds (comma-separated)</label>
                  <input
                    type="text"
                    value={editForm.notify_months_thresholds}
                    onChange={e => setEditForm({ ...editForm, notify_months_thresholds: e.target.value })}
                    placeholder="0, 1"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Last Serviced override */}
              <div style={{
                padding: '0.75rem',
                background: 'rgba(153, 204, 255, 0.06)',
                border: '1px solid rgba(153, 204, 255, 0.15)',
                marginBottom: '0.75rem',
              }}>
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--lcars-ice)',
                  marginBottom: '0.5rem',
                }}>
                  Last Serviced
                </div>
                <div className="form-grid-2col">
                  <div>
                    <label style={labelStyle}>Date</label>
                    <input
                      type="date"
                      value={editForm.last_service_date}
                      onChange={e => setEditForm({ ...editForm, last_service_date: e.target.value })}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Mileage</label>
                    <input
                      type="number"
                      value={editForm.last_service_mileage}
                      onChange={e => setEditForm({ ...editForm, last_service_mileage: e.target.value })}
                      placeholder="e.g. 52000"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                <LCARSBtn onClick={() => setEditingId(null)} color="var(--lcars-gray)">Cancel</LCARSBtn>
                <LCARSBtn onClick={() => handleSaveEdit(interval.id)} color="var(--lcars-ice)">Save</LCARSBtn>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Sub-render: Add Interval Modal ─────────────────────────────

  function renderAddModal() {
    const availableItems = getAvailableItems()

    const grouped = {}
    for (const item of availableItems) {
      const cat = item.category || 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(item)
    }

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div style={{
          width: '100%', maxWidth: '520px', margin: '1rem',
          background: '#000000',
          border: '2px solid var(--lcars-butterscotch)',
          overflow: 'hidden',
        }}>
          {/* Modal title bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 1rem',
            background: 'var(--lcars-butterscotch)',
          }}>
            <span style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '0.85rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--lcars-text-on-color)',
            }}>
              Add Maintenance Interval
            </span>
            <button
              onClick={() => setShowAddModal(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.2)', border: 'none',
                color: 'var(--lcars-text-on-color)', cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '1.25rem' }}>
            {availableItems.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '1rem 0',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
                color: 'var(--lcars-gray)',
              }}>
                All maintenance items already have intervals configured.
              </div>
            ) : (
              <form onSubmit={handleAddInterval}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Maintenance Item *</label>
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
                    <label style={labelStyle}>Miles Interval</label>
                    <input
                      type="number"
                      value={addForm.miles_interval}
                      onChange={e => setAddForm({ ...addForm, miles_interval: e.target.value })}
                      placeholder="5000"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Months Interval</label>
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
                  <label style={labelStyle}>Condition Type</label>
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
                    <label style={labelStyle}>Miles Notify Thresholds</label>
                    <input
                      type="text"
                      value={addForm.notify_miles_thresholds}
                      onChange={e => setAddForm({ ...addForm, notify_miles_thresholds: e.target.value })}
                      placeholder="0, 500, 1000"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Months Notify Thresholds</label>
                    <input
                      type="text"
                      value={addForm.notify_months_thresholds}
                      onChange={e => setAddForm({ ...addForm, notify_months_thresholds: e.target.value })}
                      placeholder="0, 1"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}>
                  <LCARSBtn type="button" onClick={() => setShowAddModal(false)} color="var(--lcars-gray)">Cancel</LCARSBtn>
                  <LCARSBtn type="submit" color="var(--lcars-ice)">Add Interval</LCARSBtn>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }
}


// ── Shared styles ────────────────────────────────────────────────

const labelStyle = {
  fontFamily: "'Antonio', sans-serif",
  fontSize: '0.68rem',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--lcars-gray)',
  display: 'block',
  marginBottom: '0.25rem',
}


// ── Helper components ────────────────────────────────────────────

/** Status count indicator for the overview strip */
function StatusCount({ color, count, label }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      <span style={{
        width: '10px',
        height: '10px',
        background: color,
        display: 'inline-block',
      }} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.78rem',
        fontWeight: 600,
        color: color,
      }}>
        {count}
      </span>
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: color,
      }}>
        {label}
      </span>
    </span>
  )
}


/** Data field: Antonio label + monospace value */
function DataField({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--lcars-gray)',
        whiteSpace: 'nowrap',
      }}>
        {label}:
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.72rem',
        fontWeight: 600,
        color: color || 'var(--lcars-space-white)',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}


/** LCARS enable/disable toggle */
function LCARSToggle({ enabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={enabled ? 'Disable interval' : 'Enable interval'}
      style={{
        padding: '0.15rem 0.5rem',
        border: 'none',
        background: enabled ? 'var(--lcars-green)' : 'rgba(102, 102, 136, 0.25)',
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.6rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: enabled ? 'var(--lcars-text-on-color)' : 'var(--lcars-gray)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        minWidth: '38px',
      }}
    >
      {enabled ? 'ON' : 'OFF'}
    </button>
  )
}


/** Squared icon action button */
function ActionBtn({ children, onClick, title, hoverColor = 'var(--lcars-sunflower)' }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        background: 'rgba(102, 102, 136, 0.15)',
        border: 'none',
        color: 'var(--lcars-gray)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = hoverColor
        e.currentTarget.style.color = 'var(--lcars-text-on-color)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(102, 102, 136, 0.15)'
        e.currentTarget.style.color = 'var(--lcars-gray)'
      }}
    >
      {children}
    </button>
  )
}


/** LCARS pill-style action button */
function LCARSBtn({ children, onClick, color, type = 'button' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.3rem 0.75rem',
        border: 'none',
        background: 'rgba(102, 102, 136, 0.2)',
        color: 'var(--lcars-gray)',
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = color
        e.currentTarget.style.color = 'var(--lcars-text-on-color)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(102, 102, 136, 0.2)'
        e.currentTarget.style.color = 'var(--lcars-gray)'
      }}
    >
      {children}
    </button>
  )
}


