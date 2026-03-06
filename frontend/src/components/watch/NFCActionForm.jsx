/**
 * NFCActionForm - Create/edit form for NFC action definitions.
 *
 * Does NOT call the API directly — passes form data to parent
 * via onSubmit(data) callback. Parent handles the API call.
 *
 * Props:
 *   action     - Existing action object for edit mode (null for create)
 *   onSubmit   - Callback with form data { name, action_type, tag_id, url, payload }
 *   onCancel   - Callback to close the form
 */
import { useState } from 'react'

const ACTION_TYPES = [
  { value: 'url', label: 'Open URL' },
  { value: 'timer', label: 'Start Timer' },
  { value: 'trigger', label: 'Trigger Action' },
  { value: 'shortcut', label: 'Run Shortcut' },
]

export default function NFCActionForm({ action, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: action?.name || '',
    action_type: action?.action_type || 'url',
    tag_id: action?.tag_id || '',
    url: action?.url || '',
    payload: action?.payload || '',
    shortcut_name: action?.shortcut_name || '',
    timer_label: action?.timer_label || '',
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()

    const data = {
      name: form.name,
      action_type: form.action_type,
      tag_id: form.tag_id || null,
    }

    // Include type-specific fields
    if (form.action_type === 'url') {
      data.url = form.url
    } else if (form.action_type === 'timer') {
      data.timer_label = form.timer_label
    } else if (form.action_type === 'trigger') {
      data.payload = form.payload
    } else if (form.action_type === 'shortcut') {
      data.shortcut_name = form.shortcut_name
    }

    onSubmit(data)
  }

  const isEdit = Boolean(action)

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Action Name *</label>
          <input
            name="name"
            placeholder="Start Laundry Timer"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>
        <div>
          <label>Action Type *</label>
          <select
            name="action_type"
            value={form.action_type}
            onChange={handleChange}
            required
          >
            {ACTION_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>NFC Tag ID</label>
        <input
          name="tag_id"
          placeholder="04:A3:B2:C1:D0:E9:F8"
          value={form.tag_id}
          onChange={handleChange}
          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}
        />
      </div>

      {/* Dynamic fields based on action_type */}
      {form.action_type === 'url' && (
        <div style={{ marginBottom: '1rem' }}>
          <label>URL *</label>
          <input
            name="url"
            type="url"
            placeholder="https://example.com/webhook"
            value={form.url}
            onChange={handleChange}
            required
          />
        </div>
      )}

      {form.action_type === 'timer' && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Timer Label</label>
          <input
            name="timer_label"
            placeholder="Laundry"
            value={form.timer_label}
            onChange={handleChange}
          />
        </div>
      )}

      {form.action_type === 'trigger' && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Payload (JSON)</label>
          <textarea
            name="payload"
            rows={3}
            placeholder='{"action": "toggle_lights", "room": "living_room"}'
            value={form.payload}
            onChange={handleChange}
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem' }}
          />
        </div>
      )}

      {form.action_type === 'shortcut' && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Shortcut Name *</label>
          <input
            name="shortcut_name"
            placeholder="My Shortcut"
            value={form.shortcut_name}
            onChange={handleChange}
            required
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {isEdit ? 'Update Action' : 'Create Action'}
        </button>
      </div>
    </form>
  )
}
