/**
 * AstroSettingsSection.jsx - Astrometrics Settings (Catppuccin Theme)
 *
 * Configuration form for the Astrometrics module:
 *   - NASA API key
 *   - Notification thresholds (launch reminder hours, NEO distance)
 *   - Cache status display
 */
import { useState, useEffect } from 'react'
import { astrometrics as api } from '../../api/client'
import { Telescope, Save, RefreshCw } from 'lucide-react'

export default function AstroSettingsSection() {
  const [settings, setSettings] = useState(null)
  const [cacheStatus, setCacheStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const [s, c] = await Promise.all([
        api.settings.get(),
        api.status().catch(() => ({})),
      ])
      setSettings(s)
      setCacheStatus(c)
      setForm({
        nasa_api_key: s.nasa_api_key || 'DEMO_KEY',
        launch_reminder_hours: s.launch_reminder_hours || 24,
        launch_reminder_minutes_2: s.launch_reminder_minutes_2 || '',
        neo_close_approach_threshold_ld: s.neo_close_approach_threshold_ld || 5.0,
      })
    } catch (e) {
      // Settings may not exist yet
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.settings.update(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      alert('Failed to save settings: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Telescope size={18} style={{ color: 'var(--color-blue)' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Astrometrics</h2>
      </div>

      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        {/* NASA API Key */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-subtext-0)' }}>
            NASA API Key
          </label>
          <input
            type="text"
            value={form.nasa_api_key || ''}
            onChange={e => setForm({ ...form, nasa_api_key: e.target.value })}
            placeholder="DEMO_KEY"
            style={{
              width: '100%', padding: '0.5rem 0.75rem',
              background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
              borderRadius: '6px', color: 'var(--color-text)', fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem',
            }}
          />
          <p style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', margin: '0.25rem 0 0' }}>
            DEMO_KEY works but is limited to 30 requests/hour. Get a free key at api.nasa.gov.
          </p>
        </div>

        {/* Launch Reminder Gate 1 */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-subtext-0)' }}>
            Launch Reminder — Gate 1 (hours before)
          </label>
          <input
            type="number"
            value={form.launch_reminder_hours || ''}
            onChange={e => setForm({ ...form, launch_reminder_hours: parseInt(e.target.value) || 24 })}
            min={1}
            max={168}
            style={{
              width: '100%', padding: '0.5rem 0.75rem',
              background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
              borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.85rem',
            }}
          />
        </div>

        {/* Launch Reminder Gate 2 (optional) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-subtext-0)' }}>
            Launch Reminder — Gate 2 (minutes before, optional)
          </label>
          <input
            type="number"
            value={form.launch_reminder_minutes_2 || ''}
            onChange={e => {
              const val = parseInt(e.target.value)
              setForm({ ...form, launch_reminder_minutes_2: isNaN(val) ? null : val })
            }}
            min={1}
            max={1440}
            placeholder="Disabled"
            style={{
              width: '100%', padding: '0.5rem 0.75rem',
              background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
              borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.85rem',
            }}
          />
          <p style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', margin: '0.25rem 0 0' }}>
            Leave empty to disable. e.g. 30 for a second alert 30 minutes before launch.
          </p>
        </div>

        {/* NEO Threshold */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.25rem', color: 'var(--color-subtext-0)' }}>
            NEO Alert Threshold (lunar distances)
          </label>
          <input
            type="number"
            value={form.neo_close_approach_threshold_ld || ''}
            onChange={e => setForm({ ...form, neo_close_approach_threshold_ld: parseFloat(e.target.value) || 5.0 })}
            min={0.1}
            max={100}
            step={0.1}
            style={{
              width: '100%', padding: '0.5rem 0.75rem',
              background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
              borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.85rem',
            }}
          />
          <p style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', margin: '0.25rem 0 0' }}>
            Alert when an asteroid passes closer than this many lunar distances (1 LD = ~384,400 km).
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </button>
      </div>

      {/* Cache Status */}
      {cacheStatus && Object.keys(cacheStatus).length > 0 && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-surface-0)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
            <RefreshCw size={14} style={{ color: 'var(--color-subtext-0)' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-subtext-0)' }}>Cache Status</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {Object.entries(cacheStatus).map(([source, info]) => (
              <span key={source} style={{
                fontSize: '0.7rem', padding: '0.25rem 0.5rem', borderRadius: '999px',
                background: info.stale ? 'rgba(249, 226, 175, 0.1)' : 'rgba(166, 227, 161, 0.1)',
                color: info.stale ? 'var(--color-yellow)' : 'var(--color-green)',
              }}>
                {source}: {info.stale ? 'stale' : 'fresh'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
