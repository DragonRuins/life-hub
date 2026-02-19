/**
 * LCARSAstroSettingsSection.jsx - Astrometrics Settings (LCARS Theme)
 *
 * LCARS-styled settings for the Astrometrics module.
 */
import { useState, useEffect } from 'react'
import { astrometrics as api } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from '../../themes/lcars/LCARSPanel'

export default function LCARSAstroSettingsSection() {
  const [settings, setSettings] = useState(null)
  const [cacheStatus, setCacheStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => { loadSettings() }, [])

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
    } catch (e) {}
    finally { setLoading(false) }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.settings.update(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {}
    finally { setSaving(false) }
  }

  if (loading) return null

  const inputStyle = {
    width: '100%', padding: '0.4rem 0.75rem',
    background: 'rgba(102, 102, 136, 0.1)',
    border: '1px solid rgba(102, 102, 136, 0.3)',
    borderRadius: '4px', color: 'var(--lcars-space-white)',
    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem',
  }

  const labelStyle = {
    fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
    color: 'var(--lcars-ice)', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: '0.25rem',
    display: 'block',
  }

  return (
    <LCARSPanel title="Astrometrics" color="var(--lcars-ice)">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>NASA API Key</label>
          <input type="text" value={form.nasa_api_key || ''} onChange={e => setForm({ ...form, nasa_api_key: e.target.value })}
            style={inputStyle} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: 'var(--lcars-gray)', marginTop: '0.25rem' }}>
            DEMO_KEY: 30 req/hour limit
          </div>
        </div>

        <div>
          <label style={labelStyle}>Launch Reminder — Gate 1 (hours)</label>
          <input type="number" value={form.launch_reminder_hours || ''} min={1} max={168}
            onChange={e => setForm({ ...form, launch_reminder_hours: parseInt(e.target.value) || 24 })}
            style={inputStyle} />
        </div>

        <div>
          <label style={labelStyle}>Launch Reminder — Gate 2 (minutes)</label>
          <input type="number" value={form.launch_reminder_minutes_2 || ''} min={1} max={1440}
            placeholder="Disabled"
            onChange={e => {
              const val = parseInt(e.target.value)
              setForm({ ...form, launch_reminder_minutes_2: isNaN(val) ? null : val })
            }}
            style={inputStyle} />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: 'var(--lcars-gray)', marginTop: '0.25rem' }}>
            Optional — leave empty to disable
          </div>
        </div>

        <div>
          <label style={labelStyle}>NEO Alert Threshold (LD)</label>
          <input type="number" value={form.neo_close_approach_threshold_ld || ''} min={0.1} max={100} step={0.1}
            onChange={e => setForm({ ...form, neo_close_approach_threshold_ld: parseFloat(e.target.value) || 5.0 })}
            style={inputStyle} />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={{
        padding: '0.375rem 1rem', background: saved ? 'var(--lcars-green, #66CC00)' : 'var(--lcars-ice)',
        border: 'none', borderRadius: '999px', color: '#000', cursor: 'pointer',
        fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save Configuration'}
      </button>

      {/* Cache Status */}
      {cacheStatus && Object.keys(cacheStatus).length > 0 && (
        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(102, 102, 136, 0.2)' }}>
          <div style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
            color: 'var(--lcars-gray)', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: '0.5rem',
          }}>
            Cache Status
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {Object.entries(cacheStatus).map(([source, info]) => (
              <span key={source} style={{
                fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '999px',
                fontFamily: "'JetBrains Mono', monospace",
                background: info.stale ? 'rgba(255, 204, 102, 0.15)' : 'rgba(102, 204, 0, 0.15)',
                color: info.stale ? 'var(--lcars-tanoi)' : 'var(--lcars-green, #66CC00)',
              }}>
                {source}: {info.stale ? 'stale' : 'fresh'}
              </span>
            ))}
          </div>
        </div>
      )}
    </LCARSPanel>
  )
}
