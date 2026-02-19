/**
 * LCARSNotificationSettings.jsx - Full Notification Configuration (LCARS Theme)
 *
 * Consolidates all notification configuration into one settings sub-page:
 *   - Settings: global toggle, quiet hours, priority, retention
 *   - Channels: manage delivery channels (Pushover, Discord, Email, etc.)
 *   - Intervals: per-interval notification delivery config
 *   - Rules: create/edit notification rules
 *   - History: paginated log of all sent notifications
 *
 * The Settings tab is LCARS-native. The other tabs reuse the shared Catppuccin
 * tab components (same behavior as the old /notifications page under LCARS).
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { notifications } from '../../../api/client'
import LCARSPanel from '../LCARSPanel'
import ChannelsTab from '../../../pages/notifications/ChannelsTab'
import IntervalsTab from '../../../pages/notifications/IntervalsTab'
import RulesTab from '../../../pages/notifications/RulesTab'
import HistoryTab from '../../../pages/notifications/HistoryTab'

// Tab definitions for the pill-button row
const TABS = [
  { key: 'settings', label: 'Settings' },
  { key: 'channels', label: 'Channels' },
  { key: 'intervals', label: 'Intervals' },
  { key: 'rules', label: 'Rules' },
  { key: 'history', label: 'History' },
]

// Common US timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'UTC', label: 'UTC' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export default function LCARSNotificationSettings() {
  const [activeTab, setActiveTab] = useState('settings')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Back link */}
      <Link
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--lcars-ice)',
          textDecoration: 'none',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      {/* Tab pill buttons */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.375rem 1rem',
              background: activeTab === tab.key ? 'var(--lcars-butterscotch)' : 'var(--lcars-sunflower)',
              color: '#000',
              border: 'none',
              borderRadius: '999px',
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              opacity: activeTab === tab.key ? 1 : 0.55,
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'settings' && <LCARSGeneralSettings />}
      {activeTab === 'channels' && <ChannelsTab />}
      {activeTab === 'intervals' && <IntervalsTab />}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  )
}


/**
 * LCARS-native general settings panel.
 * Global toggle, quiet hours, priority, retention — styled with LCARSPanel.
 */
function LCARSGeneralSettings() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false)

  async function loadSettings() {
    try {
      const data = await notifications.settings()
      setSettings(data)
      setQuietHoursEnabled(!!(data.quiet_hours_start && data.quiet_hours_end))
    } catch (err) {
      console.error('Failed to load notification settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSettings() }, [])

  function updateSetting(field, value) {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setMessage(null)
    try {
      const payload = {
        enabled: settings.enabled,
        default_priority: settings.default_priority,
        quiet_hours_start: quietHoursEnabled ? settings.quiet_hours_start : null,
        quiet_hours_end: quietHoursEnabled ? settings.quiet_hours_end : null,
        quiet_hours_timezone: settings.quiet_hours_timezone,
        retention_days: settings.retention_days,
      }
      await notifications.updateSettings(payload)
      setMessage({ type: 'success', text: 'Configuration saved.' })
      setTimeout(() => setMessage(null), 4000)
    } catch (err) {
      setMessage({ type: 'error', text: 'Save failed: ' + err.message })
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '0.4rem 0.75rem',
    background: 'rgba(102, 102, 136, 0.1)',
    border: '1px solid rgba(102, 102, 136, 0.3)',
    borderRadius: '4px', color: 'var(--lcars-space-white)',
    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem',
  }

  const selectStyle = {
    ...inputStyle,
    fontFamily: "'Antonio', sans-serif",
    fontSize: '0.85rem',
    textTransform: 'uppercase',
  }

  const labelStyle = {
    fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
    color: 'var(--lcars-ice)', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: '0.25rem',
    display: 'block',
  }

  if (loading) {
    return (
      <LCARSPanel title="Notification Configuration" color="var(--lcars-butterscotch)">
        <p style={{ fontFamily: "'Antonio', sans-serif", color: 'var(--lcars-gray)', textTransform: 'uppercase' }}>
          Loading configuration...
        </p>
      </LCARSPanel>
    )
  }

  if (!settings) {
    return (
      <LCARSPanel title="Notification Configuration" color="var(--lcars-tomato)">
        <p style={{ fontFamily: "'Antonio', sans-serif", color: 'var(--lcars-tomato)', textTransform: 'uppercase' }}>
          Failed to load notification settings
        </p>
      </LCARSPanel>
    )
  }

  return (
    <>
      {/* Global toggle panel */}
      <LCARSPanel
        title="Global Notifications"
        color={settings.enabled ? 'var(--lcars-green, #66CC00)' : 'var(--lcars-tomato)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--lcars-space-white)',
            }}>
              {settings.enabled ? 'System Active' : 'System Offline'}
            </div>
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.75rem',
              color: 'var(--lcars-gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: '0.25rem',
            }}>
              {settings.enabled
                ? 'All notification rules are operational'
                : 'All notification rules are suspended'}
            </div>
          </div>
          <button
            onClick={() => updateSetting('enabled', !settings.enabled)}
            style={{
              padding: '0.375rem 1.25rem',
              background: settings.enabled ? 'var(--lcars-green, #66CC00)' : 'var(--lcars-tomato)',
              color: '#000',
              border: 'none',
              borderRadius: '999px',
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.8rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
            }}
          >
            {settings.enabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>
      </LCARSPanel>

      {/* Quiet Hours panel */}
      <LCARSPanel title="Quiet Hours" color="var(--lcars-african-violet)">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: quietHoursEnabled ? '1rem' : 0 }}>
          <div style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.8rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Suppress notifications during specified hours
          </div>
          <button
            onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
            style={{
              padding: '0.25rem 1rem',
              background: quietHoursEnabled ? 'var(--lcars-african-violet)' : 'rgba(102, 102, 136, 0.3)',
              color: quietHoursEnabled ? '#000' : 'var(--lcars-gray)',
              border: 'none',
              borderRadius: '999px',
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {quietHoursEnabled ? 'Active' : 'Inactive'}
          </button>
        </div>

        {quietHoursEnabled && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Start Time</label>
              <input
                type="time"
                value={settings.quiet_hours_start || '22:00'}
                onChange={e => updateSetting('quiet_hours_start', e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>End Time</label>
              <input
                type="time"
                value={settings.quiet_hours_end || '07:00'}
                onChange={e => updateSetting('quiet_hours_end', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        )}
      </LCARSPanel>

      {/* General settings panel */}
      <LCARSPanel title="General Configuration" color="var(--lcars-sunflower)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>Timezone</label>
            <select
              value={settings.quiet_hours_timezone || 'America/Chicago'}
              onChange={e => updateSetting('quiet_hours_timezone', e.target.value)}
              style={selectStyle}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Default Priority</label>
            <select
              value={settings.default_priority || 'normal'}
              onChange={e => updateSetting('default_priority', e.target.value)}
              style={selectStyle}
            >
              {PRIORITIES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Log Retention (days)</label>
            <input
              type="number"
              min="1"
              max="365"
              value={settings.retention_days ?? 90}
              onChange={e => updateSetting('retention_days', e.target.value ? Number(e.target.value) : 90)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Status message */}
        {message && (
          <div style={{
            padding: '0.5rem 0.75rem', borderRadius: '4px', marginBottom: '0.75rem',
            fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            background: message.type === 'success' ? 'rgba(102, 204, 0, 0.15)' : 'rgba(204, 51, 51, 0.15)',
            color: message.type === 'success' ? 'var(--lcars-green, #66CC00)' : 'var(--lcars-tomato)',
          }}>
            {message.text}
          </div>
        )}

        <button onClick={handleSave} disabled={saving} style={{
          padding: '0.375rem 1rem',
          background: 'var(--lcars-sunflower)',
          border: 'none', borderRadius: '999px', color: '#000', cursor: 'pointer',
          fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </LCARSPanel>
    </>
  )
}
