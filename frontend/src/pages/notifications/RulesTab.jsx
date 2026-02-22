/**
 * Rules Tab
 *
 * Manages notification rules -- the "when and why" of notifications.
 * Shows a card list of existing rules with:
 *   - Name, module badge, rule type badge, priority indicator
 *   - Enabled toggle, channel count, last fired timestamp
 *   - Edit / Delete / Manual Trigger actions
 *   - "Create Rule" button that opens a modal with RuleForm
 *
 * Fetches rules, channels, schemas, and available events on mount.
 */
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Play, Clock, Zap, Filter } from 'lucide-react'
import { notifications } from '../../api/client'
import { formatShortDate } from '../../utils/formatDate'
import RuleForm from './RuleForm'

// Color mapping for priority badges
const PRIORITY_STYLES = {
  low: { bg: 'rgba(148, 226, 213, 0.1)', color: 'var(--color-teal)' },
  normal: { bg: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)' },
  high: { bg: 'rgba(250, 179, 135, 0.1)', color: 'var(--color-peach)' },
  critical: { bg: 'rgba(243, 139, 168, 0.1)', color: 'var(--color-red)' },
}

// Color mapping for rule type badges
const RULE_TYPE_STYLES = {
  event: { bg: 'rgba(166, 227, 161, 0.1)', color: 'var(--color-green)', icon: Zap, label: 'Event' },
  scheduled: { bg: 'rgba(203, 166, 247, 0.1)', color: 'var(--color-mauve)', icon: Clock, label: 'Scheduled' },
  condition: { bg: 'rgba(249, 226, 175, 0.1)', color: 'var(--color-yellow)', icon: Filter, label: 'Condition' },
}

// Color mapping for module badges
const MODULE_STYLES = {
  vehicles: { bg: 'rgba(250, 179, 135, 0.1)', color: 'var(--color-peach)' },
  notes: { bg: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)' },
  fuel: { bg: 'rgba(166, 227, 161, 0.1)', color: 'var(--color-green)' },
}

export default function RulesTab() {
  const [ruleList, setRuleList] = useState([])
  const [channels, setChannels] = useState([])
  const [schemas, setSchemas] = useState({})
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal state for creating / editing rules
  const [showForm, setShowForm] = useState(false)
  const [editingRule, setEditingRule] = useState(null)

  // ── Data loading ────────────────────────────────────────────
  async function loadData() {
    try {
      const [ruleData, channelData, schemaData, eventData] = await Promise.all([
        notifications.rules.list(),
        notifications.channels.list(),
        notifications.schemas(),
        notifications.rules.events(),
      ])
      setRuleList(ruleData)
      setChannels(channelData)
      setSchemas(schemaData)
      setEvents(eventData)
    } catch (err) {
      console.error('Failed to load rules data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Handlers ────────────────────────────────────────────────

  /** Create a new rule */
  async function handleCreate(data) {
    try {
      await notifications.rules.create(data)
      await loadData()
      setShowForm(false)
    } catch (err) {
      alert('Failed to create rule: ' + err.message)
    }
  }

  /** Update an existing rule */
  async function handleUpdate(data) {
    try {
      await notifications.rules.update(editingRule.id, data)
      await loadData()
      setShowForm(false)
      setEditingRule(null)
    } catch (err) {
      alert('Failed to update rule: ' + err.message)
    }
  }

  /** Toggle a rule's enabled state */
  async function handleToggleEnabled(rule) {
    try {
      await notifications.rules.update(rule.id, { is_enabled: !rule.is_enabled })
      await loadData()
    } catch (err) {
      alert('Failed to toggle rule: ' + err.message)
    }
  }

  /** Manually trigger a rule */
  async function handleTrigger(ruleId) {
    try {
      const result = await notifications.rules.trigger(ruleId)
      alert(result.message)
      await loadData()
    } catch (err) {
      alert('Failed to trigger rule: ' + err.message)
    }
  }

  /** Delete a rule with confirmation */
  async function handleDelete(ruleId) {
    if (!window.confirm('Delete this notification rule?')) return
    try {
      await notifications.rules.delete(ruleId)
      await loadData()
    } catch (err) {
      alert('Failed to delete rule: ' + err.message)
    }
  }

  /** Open the edit form modal for an existing rule */
  function startEdit(rule) {
    setEditingRule(rule)
    setShowForm(true)
  }

  /** Close the form modal */
  function closeForm() {
    setShowForm(false)
    setEditingRule(null)
  }

  // ── Helpers ─────────────────────────────────────────────────

  /** Format a timestamp for display */
  function formatTimestamp(isoString) {
    if (!isoString) return 'Never'
    const date = new Date(isoString)
    return formatShortDate(isoString) +
           ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return <p style={{ color: 'var(--color-subtext-0)' }}>Loading rules...</p>
  }

  return (
    <div>
      {/* Header with create button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem' }}>
          {ruleList.length} rule{ruleList.length !== 1 ? 's' : ''} configured
        </p>
        <button className="btn btn-primary" onClick={() => { setEditingRule(null); setShowForm(true) }}>
          <Plus size={16} />
          Create Rule
        </button>
      </div>

      {/* Rule cards */}
      {ruleList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>
            No rules yet. Create a rule to automate your notifications.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {ruleList.map(rule => {
            const typeStyle = RULE_TYPE_STYLES[rule.rule_type] || RULE_TYPE_STYLES.event
            const priorityStyle = PRIORITY_STYLES[rule.priority] || PRIORITY_STYLES.normal
            const moduleStyle = rule.module ? (MODULE_STYLES[rule.module] || { bg: 'var(--color-surface-0)', color: 'var(--color-subtext-0)' }) : null
            const TypeIcon = typeStyle.icon

            return (
              <div key={rule.id} className="card" style={{ padding: '1rem 1.25rem', opacity: rule.is_enabled ? 1 : 0.6 }}>
                {/* Top row: name + badges */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rule.name}
                    </span>

                    {/* Module badge */}
                    {moduleStyle && (
                      <span style={{
                        fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '4px',
                        background: moduleStyle.bg, color: moduleStyle.color, flexShrink: 0,
                      }}>
                        {rule.module}
                      </span>
                    )}

                    {/* Rule type badge */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                      fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '4px',
                      background: typeStyle.bg, color: typeStyle.color, flexShrink: 0,
                    }}>
                      <TypeIcon size={10} />
                      {typeStyle.label}
                    </span>

                    {/* Priority badge */}
                    <span style={{
                      fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '4px',
                      background: priorityStyle.bg, color: priorityStyle.color, flexShrink: 0,
                    }}>
                      {rule.priority}
                    </span>
                  </div>

                  {/* Enabled toggle */}
                  <button
                    onClick={() => handleToggleEnabled(rule)}
                    style={{
                      width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                      background: rule.is_enabled ? 'var(--color-green)' : 'var(--color-surface-1)',
                      position: 'relative', transition: 'background 0.2s ease', flexShrink: 0, marginLeft: '0.75rem',
                    }}
                    title={rule.is_enabled ? 'Disable rule' : 'Enable rule'}
                  >
                    <span style={{
                      position: 'absolute', top: '2px',
                      left: rule.is_enabled ? '18px' : '2px',
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: 'white', transition: 'left 0.2s ease',
                    }} />
                  </button>
                </div>

                {/* Description */}
                {rule.description && (
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginBottom: '0.5rem' }}>
                    {rule.description}
                  </p>
                )}

                {/* Bottom row: metadata + actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-overlay-0)' }}>
                    <span>{rule.channel_ids?.length || 0} channel{(rule.channel_ids?.length || 0) !== 1 ? 's' : ''}</span>
                    <span>Last fired: {formatTimestamp(rule.last_fired_at)}</span>
                    {rule.event_name && <span>Event: {rule.event_name}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '0.375rem', fontSize: '0.75rem' }}
                      onClick={() => handleTrigger(rule.id)}
                      title="Manually trigger this rule"
                    >
                      <Play size={14} />
                    </button>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '0.375rem', fontSize: '0.75rem' }}
                      onClick={() => startEdit(rule)}
                      title="Edit rule"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '0.375rem', fontSize: '0.75rem' }}
                      onClick={() => handleDelete(rule.id)}
                      title="Delete rule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Rule Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', margin: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {editingRule ? 'Edit Rule' : 'Create Rule'}
              </h2>
              <button className="btn btn-ghost" onClick={closeForm}>
                <X size={18} />
              </button>
            </div>
            <RuleForm
              rule={editingRule}
              channels={channels}
              schemas={schemas}
              events={events}
              onSubmit={editingRule ? handleUpdate : handleCreate}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}
    </div>
  )
}
