/**
 * Rule Form
 *
 * Complex form for creating/editing notification rules. Divided into sections:
 *   1. Basics: name, description, module, priority
 *   2. Trigger: event / schedule / condition picker
 *   3. Conditions: dynamic condition rows [field] [operator] [value]
 *   4. Message Template: title and body with clickable variable chips
 *   5. Delivery: channel checkboxes
 *   6. Advanced: cooldown, enabled toggle
 *
 * Props:
 *   rule     - existing rule to edit (null for create)
 *   channels - array of channel objects for delivery checkboxes
 *   schemas  - channel schemas (for display names)
 *   events   - array of available events from the backend
 *   onSubmit - callback(data) to pass form data to the parent
 *   onCancel - callback() to close the form
 *
 * IMPORTANT: This form does NOT call the API directly.
 * It passes data to the parent via onSubmit.
 */
import { useState } from 'react'
import { Plus, X } from 'lucide-react'

// Available modules for the module selector
const MODULES = [
  { value: '', label: 'Global (any module)' },
  { value: 'vehicles', label: 'Vehicles' },
  { value: 'notes', label: 'Notes' },
  { value: 'fuel', label: 'Fuel' },
]

// Priority options
const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

// Available condition operators
const OPERATORS = [
  { value: '==', label: 'equals' },
  { value: '!=', label: 'not equals' },
  { value: '>', label: 'greater than' },
  { value: '>=', label: 'greater or equal' },
  { value: '<', label: 'less than' },
  { value: '<=', label: 'less or equal' },
  { value: 'contains', label: 'contains' },
]

// Section heading style used throughout the form
const sectionHeadingStyle = {
  fontSize: '0.9rem',
  fontWeight: 600,
  marginBottom: '0.75rem',
  paddingBottom: '0.375rem',
  borderBottom: '1px solid var(--color-surface-0)',
  color: 'var(--color-text)',
}

export default function RuleForm({ rule, channels, schemas, events, onSubmit, onCancel }) {
  // ── Form state ──────────────────────────────────────────────
  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    module: rule?.module || '',
    priority: rule?.priority || 'normal',
    rule_type: rule?.rule_type || 'event',
    event_name: rule?.event_name || '',
    schedule_config: rule?.schedule_config || { type: 'interval', hours: 24 },
    conditions: rule?.conditions || [],
    title_template: rule?.title_template || '',
    body_template: rule?.body_template || '',
    channel_ids: rule?.channel_ids || [],
    cooldown_minutes: rule?.cooldown_minutes ?? 0,
    is_enabled: rule?.is_enabled ?? true,
  })

  /** Update a single form field */
  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  /** Update a nested schedule_config field */
  function updateSchedule(field, value) {
    setForm(prev => ({
      ...prev,
      schedule_config: { ...prev.schedule_config, [field]: value },
    }))
  }

  // ── Conditions management ───────────────────────────────────

  /** Add a new empty condition row */
  function addCondition() {
    setForm(prev => ({
      ...prev,
      conditions: [...prev.conditions, { field: '', operator: '==', value: '' }],
    }))
  }

  /** Update a single condition row */
  function updateCondition(index, key, value) {
    setForm(prev => {
      const updated = [...prev.conditions]
      updated[index] = { ...updated[index], [key]: value }
      return { ...prev, conditions: updated }
    })
  }

  /** Remove a condition row by index */
  function removeCondition(index) {
    setForm(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }))
  }

  // ── Channel selection ───────────────────────────────────────

  /** Toggle a channel in the selected channel_ids list */
  function toggleChannel(channelId) {
    setForm(prev => {
      const ids = prev.channel_ids.includes(channelId)
        ? prev.channel_ids.filter(id => id !== channelId)
        : [...prev.channel_ids, channelId]
      return { ...prev, channel_ids: ids }
    })
  }

  // ── Template variable insertion ─────────────────────────────

  /** Get available fields based on selected event or module */
  function getAvailableFields() {
    // If a specific event is selected, use its fields
    if (form.event_name) {
      const event = events.find(e => e.name === form.event_name)
      return event?.fields || []
    }
    // Otherwise, collect all fields for the selected module
    if (form.module) {
      const moduleEvents = events.filter(e => e.module === form.module)
      const allFields = new Set()
      moduleEvents.forEach(e => e.fields.forEach(f => allFields.add(f)))
      return Array.from(allFields).sort()
    }
    // Global: collect all fields from all events
    const allFields = new Set()
    events.forEach(e => e.fields.forEach(f => allFields.add(f)))
    return Array.from(allFields).sort()
  }

  /** Insert a {{variable}} placeholder into the body template at cursor position */
  function insertVariable(variable) {
    const insertion = `{{${variable}}}`
    updateField('body_template', form.body_template + insertion)
  }

  // ── Events filtered by module ───────────────────────────────

  /** Get events relevant to the selected module (or all if no module) */
  function getFilteredEvents() {
    if (!form.module) return events
    return events.filter(e => e.module === form.module)
  }

  // ── Submit ──────────────────────────────────────────────────

  function handleSubmit(e) {
    e.preventDefault()
    // Clean up: strip empty conditions
    const cleanConditions = form.conditions.filter(c => c.field && c.value)
    onSubmit({
      ...form,
      conditions: cleanConditions,
      module: form.module || null,
      event_name: form.rule_type === 'event' ? form.event_name : null,
      schedule_config: form.rule_type === 'scheduled' ? form.schedule_config : null,
    })
  }

  // ── Render ──────────────────────────────────────────────────

  const availableFields = getAvailableFields()
  const filteredEvents = getFilteredEvents()

  return (
    <form onSubmit={handleSubmit}>

      {/* ── Section 1: Basics ──────────────────────────────── */}
      <h3 style={sectionHeadingStyle}>Basics</h3>

      <div style={{ marginBottom: '1rem' }}>
        <label>Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={e => updateField('name', e.target.value)}
          placeholder="e.g., Oil Change Reminder"
          required
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Description</label>
        <textarea
          rows={2}
          value={form.description}
          onChange={e => updateField('description', e.target.value)}
          placeholder="Optional description of what this rule does..."
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <label>Module</label>
          <select value={form.module} onChange={e => updateField('module', e.target.value)}>
            {MODULES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Priority</label>
          <select value={form.priority} onChange={e => updateField('priority', e.target.value)}>
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Section 2: Trigger ─────────────────────────────── */}
      <h3 style={sectionHeadingStyle}>Trigger</h3>

      {/* Rule type radio buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        {[
          { value: 'event', label: 'Event' },
          { value: 'scheduled', label: 'Schedule' },
          { value: 'condition', label: 'Condition' },
        ].map(opt => (
          <label key={opt.value} style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer',
            fontSize: '0.875rem', color: form.rule_type === opt.value ? 'var(--color-blue)' : 'var(--color-subtext-0)',
          }}>
            <input
              type="radio"
              name="rule_type"
              value={opt.value}
              checked={form.rule_type === opt.value}
              onChange={e => updateField('rule_type', e.target.value)}
              style={{ width: 'auto' }}
            />
            <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>{opt.label}</span>
          </label>
        ))}
      </div>

      {/* Event trigger: event name dropdown */}
      {form.rule_type === 'event' && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Event Name *</label>
          <select
            value={form.event_name}
            onChange={e => updateField('event_name', e.target.value)}
            required={form.rule_type === 'event'}
          >
            <option value="">-- Select an event --</option>
            {filteredEvents.map(ev => (
              <option key={ev.name} value={ev.name}>
                {ev.name} -- {ev.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Schedule trigger: interval or cron */}
      {form.rule_type === 'scheduled' && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="radio"
                name="schedule_type"
                value="interval"
                checked={form.schedule_config?.type === 'interval'}
                onChange={() => updateSchedule('type', 'interval')}
                style={{ width: 'auto' }}
              />
              <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>Interval</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
              <input
                type="radio"
                name="schedule_type"
                value="cron"
                checked={form.schedule_config?.type === 'cron'}
                onChange={() => updateSchedule('type', 'cron')}
                style={{ width: 'auto' }}
              />
              <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>Cron Expression</span>
            </label>
          </div>

          {form.schedule_config?.type === 'interval' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label>Every (hours)</label>
                <input
                  type="number"
                  min="0"
                  value={form.schedule_config.hours || ''}
                  onChange={e => updateSchedule('hours', e.target.value ? Number(e.target.value) : '')}
                  placeholder="24"
                />
              </div>
              <div>
                <label>Or every (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={form.schedule_config.minutes || ''}
                  onChange={e => updateSchedule('minutes', e.target.value ? Number(e.target.value) : '')}
                  placeholder="0"
                />
              </div>
            </div>
          )}

          {form.schedule_config?.type === 'cron' && (
            <div>
              <label>Cron Expression *</label>
              <input
                type="text"
                value={form.schedule_config.cron || ''}
                onChange={e => updateSchedule('cron', e.target.value)}
                placeholder="0 9 * * MON"
                required
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>
                Format: minute hour day-of-month month day-of-week (e.g., "0 9 * * MON" = every Monday at 9am)
              </p>
            </div>
          )}
        </div>
      )}

      {/* Condition trigger: same event dropdown as event type */}
      {form.rule_type === 'condition' && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Event to Monitor</label>
          <select
            value={form.event_name}
            onChange={e => updateField('event_name', e.target.value)}
          >
            <option value="">-- Select an event --</option>
            {filteredEvents.map(ev => (
              <option key={ev.name} value={ev.name}>
                {ev.name} -- {ev.description}
              </option>
            ))}
          </select>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>
            The rule will fire when this event occurs AND the conditions below are met.
          </p>
        </div>
      )}

      {/* ── Section 3: Conditions ──────────────────────────── */}
      <h3 style={sectionHeadingStyle}>Conditions</h3>

      {form.conditions.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }}>
          No conditions. The rule will fire on every trigger.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {form.conditions.map((cond, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {/* Field select */}
              <select
                value={cond.field}
                onChange={e => updateCondition(idx, 'field', e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Field...</option>
                {availableFields.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              {/* Operator select */}
              <select
                value={cond.operator}
                onChange={e => updateCondition(idx, 'operator', e.target.value)}
                style={{ width: '140px' }}
              >
                {OPERATORS.map(op => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>

              {/* Value input */}
              <input
                type="text"
                value={cond.value}
                onChange={e => updateCondition(idx, 'value', e.target.value)}
                placeholder="Value"
                style={{ flex: 1 }}
              />

              {/* Remove button */}
              <button
                type="button"
                className="btn btn-danger"
                style={{ padding: '0.375rem', flexShrink: 0 }}
                onClick={() => removeCondition(idx)}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        className="btn btn-ghost"
        style={{ fontSize: '0.8rem', marginBottom: '1.25rem' }}
        onClick={addCondition}
      >
        <Plus size={14} />
        Add Condition
      </button>

      {/* ── Section 4: Message Template ────────────────────── */}
      <h3 style={sectionHeadingStyle}>Message Template</h3>

      <div style={{ marginBottom: '1rem' }}>
        <label>Title Template</label>
        <input
          type="text"
          value={form.title_template}
          onChange={e => updateField('title_template', e.target.value)}
          placeholder="e.g., Maintenance Due for {{service_type}}"
        />
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label>Body Template *</label>
        <textarea
          rows={4}
          value={form.body_template}
          onChange={e => updateField('body_template', e.target.value)}
          placeholder="e.g., A new {{service_type}} was logged on {{date}} at {{mileage}} miles."
          required
        />
      </div>

      {/* Variable chips -- clicking inserts {{variable}} into body */}
      {availableFields.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginBottom: '0.375rem' }}>
            Click to insert variable:
          </p>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {availableFields.map(field => (
              <button
                key={field}
                type="button"
                onClick={() => insertVariable(field)}
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
                {`{{${field}}}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 5: Delivery Channels ───────────────────── */}
      <h3 style={sectionHeadingStyle}>Delivery Channels</h3>

      {channels.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--color-overlay-0)', marginBottom: '1.25rem' }}>
          No channels available. Create a channel first on the Channels tab.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {channels.map(ch => {
            const isSelected = form.channel_ids.includes(ch.id)
            const displayName = schemas[ch.channel_type]?.display_name || ch.channel_type
            return (
              <label
                key={ch.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: 'pointer',
                  padding: '0.5rem 0.75rem', borderRadius: '8px',
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
                <span style={{ fontSize: '0.875rem', fontWeight: 500, textTransform: 'none', letterSpacing: 'normal' }}>
                  {ch.name}
                </span>
                <span style={{
                  fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '4px',
                  background: 'var(--color-surface-0)', color: 'var(--color-overlay-1)', marginLeft: 'auto',
                }}>
                  {displayName}
                </span>
                {!ch.is_enabled && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-overlay-0)' }}>(disabled)</span>
                )}
              </label>
            )
          })}
        </div>
      )}

      {/* ── Section 6: Advanced ────────────────────────────── */}
      <h3 style={sectionHeadingStyle}>Advanced</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Cooldown (minutes)</label>
          <input
            type="number"
            min="0"
            value={form.cooldown_minutes}
            onChange={e => updateField('cooldown_minutes', e.target.value ? Number(e.target.value) : 0)}
            placeholder="0"
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>
            Minimum minutes between firings. 0 = no cooldown.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.is_enabled}
              onChange={e => updateField('is_enabled', e.target.checked)}
              style={{ width: 'auto' }}
            />
            <span style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.875rem' }}>
              Enable this rule
            </span>
          </label>
        </div>
      </div>

      {/* ── Action buttons ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid var(--color-surface-0)' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">
          {rule ? 'Save Changes' : 'Create Rule'}
        </button>
      </div>
    </form>
  )
}
