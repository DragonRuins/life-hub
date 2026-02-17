/**
 * General Settings Tab
 *
 * Global notification settings form. Fetches and updates the singleton
 * settings row from the backend. Settings include:
 *   - Global notifications enabled/disabled (kill switch)
 *   - Quiet hours (start time, end time, timezone)
 *   - Default priority for new rules
 *   - Log retention period in days
 *
 * Uses the backend's GET/PUT /api/notifications/settings endpoints.
 */
import { useState, useEffect } from 'react'
import { Save, Power } from 'lucide-react'
import { notifications } from '../../api/client'

// Common US timezones for the timezone selector
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
]

// Priority options for the default priority selector
const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export default function GeneralTab() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text: '' }

  // Track whether quiet hours are enabled (derived from having start/end values)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)

  // ── Data loading ────────────────────────────────────────────
  async function loadSettings() {
    try {
      const data = await notifications.settings()
      setSettings(data)
      // Consider quiet hours enabled if both start and end are set
      setQuietHoursEnabled(!!(data.quiet_hours_start && data.quiet_hours_end))
    } catch (err) {
      console.error('Failed to load notification settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  // ── Handlers ────────────────────────────────────────────────

  /** Update a single setting field in local state */
  function updateSetting(field, value) {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  /** Save all settings to the backend */
  async function handleSave() {
    setSaving(true)
    setMessage(null)

    try {
      // Build the payload -- clear quiet hours if toggle is off
      const payload = {
        enabled: settings.enabled,
        default_priority: settings.default_priority,
        quiet_hours_start: quietHoursEnabled ? settings.quiet_hours_start : null,
        quiet_hours_end: quietHoursEnabled ? settings.quiet_hours_end : null,
        quiet_hours_timezone: settings.quiet_hours_timezone,
        retention_days: settings.retention_days,
      }

      await notifications.updateSettings(payload)
      setMessage({ type: 'success', text: 'Settings saved successfully.' })

      // Clear the success message after 4 seconds
      setTimeout(() => setMessage(null), 4000)
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to save settings: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return <p style={{ color: 'var(--color-subtext-0)' }}>Loading settings...</p>
  }

  if (!settings) {
    return <p style={{ color: 'var(--color-red)' }}>Failed to load notification settings.</p>
  }

  return (
    <div style={{ maxWidth: '600px' }}>

      {/* ── Global enabled toggle (prominent styling) ─────── */}
      <div className="card" style={{
        marginBottom: '1.5rem', padding: '1.25rem',
        border: settings.enabled ? '1px solid rgba(166, 227, 161, 0.3)' : '1px solid rgba(243, 139, 168, 0.3)',
        background: settings.enabled ? 'rgba(166, 227, 161, 0.04)' : 'rgba(243, 139, 168, 0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Power size={20} style={{ color: settings.enabled ? 'var(--color-green)' : 'var(--color-red)' }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                Global Notifications
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                {settings.enabled ? 'Notifications are active and will fire normally.' : 'All notifications are paused. No rules will fire.'}
              </div>
            </div>
          </div>
          <button
            onClick={() => updateSetting('enabled', !settings.enabled)}
            style={{
              width: '48px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
              background: settings.enabled ? 'var(--color-green)' : 'var(--color-surface-1)',
              position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '3px',
              left: settings.enabled ? '24px' : '3px',
              width: '20px', height: '20px', borderRadius: '50%',
              background: 'white', transition: 'left 0.2s ease',
            }} />
          </button>
        </div>
      </div>

      {/* ── Quiet Hours ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Quiet Hours</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
              Suppress notifications during these hours.
            </div>
          </div>
          <button
            onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
            style={{
              width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
              background: quietHoursEnabled ? 'var(--color-blue)' : 'var(--color-surface-1)',
              position: 'relative', transition: 'background 0.2s ease', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '2px',
              left: quietHoursEnabled ? '20px' : '2px',
              width: '18px', height: '18px', borderRadius: '50%',
              background: 'white', transition: 'left 0.2s ease',
            }} />
          </button>
        </div>

        {/* Quiet hours fields (only shown when enabled) */}
        {quietHoursEnabled && (
          <div className="form-grid-2col">
            <div>
              <label>Start Time</label>
              <input
                type="time"
                value={settings.quiet_hours_start || '22:00'}
                onChange={e => updateSetting('quiet_hours_start', e.target.value)}
              />
            </div>
            <div>
              <label>End Time</label>
              <input
                type="time"
                value={settings.quiet_hours_end || '07:00'}
                onChange={e => updateSetting('quiet_hours_end', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Other Settings ───────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '1rem' }}>General</h3>

        {/* Timezone */}
        <div style={{ marginBottom: '1rem' }}>
          <label>Timezone</label>
          <select
            value={settings.quiet_hours_timezone || 'America/Chicago'}
            onChange={e => updateSetting('quiet_hours_timezone', e.target.value)}
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>
            Used for quiet hours and scheduled rule timing.
          </p>
        </div>

        {/* Default priority */}
        <div style={{ marginBottom: '1rem' }}>
          <label>Default Priority</label>
          <select
            value={settings.default_priority || 'normal'}
            onChange={e => updateSetting('default_priority', e.target.value)}
          >
            {PRIORITIES.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>
            Priority used when a rule does not specify one.
          </p>
        </div>

        {/* Log retention */}
        <div style={{ marginBottom: '0' }}>
          <label>Log Retention (days)</label>
          <input
            type="number"
            min="1"
            max="365"
            value={settings.retention_days ?? 90}
            onChange={e => updateSetting('retention_days', e.target.value ? Number(e.target.value) : 90)}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>
            How long to keep notification log entries before automatic cleanup.
          </p>
        </div>
      </div>

      {/* ── Save button and feedback message ──────────────── */}
      {message && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
          background: message.type === 'success' ? 'rgba(166, 227, 161, 0.1)' : 'rgba(243, 139, 168, 0.1)',
          color: message.type === 'success' ? 'var(--color-green)' : 'var(--color-red)',
          fontSize: '0.875rem',
        }}>
          {message.text}
        </div>
      )}

      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={saving}
        style={{ width: '100%', justifyContent: 'center' }}
      >
        <Save size={16} />
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
