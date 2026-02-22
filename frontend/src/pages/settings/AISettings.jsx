/**
 * AISettings.jsx - AI Assistant Settings Sub-Page (Catppuccin Theme)
 *
 * Settings for the AI assistant:
 *   - API status indicator (key configured or not)
 *   - Model selection dropdown
 *   - Custom system prompt textarea
 *   - Reset to default button
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bot, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { ai } from '../../api/client'

/** Available Claude models for the dropdown */
const MODEL_OPTIONS = [
  { value: 'claude-haiku-4-20250414', label: 'Claude Haiku (fastest)' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet (balanced)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus (most capable)' },
]

export default function AISettings() {
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const [settingsData, statusData] = await Promise.all([
        ai.settings.get(),
        ai.status(),
      ])
      setSettings(settingsData)
      setStatus(statusData)
    } catch (err) {
      console.error('Failed to load AI settings:', err)
    }
  }

  async function handleSave(updates) {
    setSaving(true)
    setSaved(false)
    try {
      const updated = await ai.settings.update(updates)
      setSettings(prev => ({ ...prev, ...updated }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save AI settings:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <div style={{ maxWidth: '900px' }}>
        <Link
          to="/settings"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            color: 'var(--color-subtext-0)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            marginBottom: '1rem',
          }}
        >
          <ArrowLeft size={16} />
          Settings
        </Link>
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Back link */}
      <Link
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--color-subtext-0)',
          textDecoration: 'none',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Bot size={22} style={{ color: 'var(--color-mauve)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>AI Assistant</h1>
      </div>

      {/* ── API Status ───────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>API Status</h2>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem',
          background: status?.configured
            ? 'rgba(166, 227, 161, 0.08)'
            : 'rgba(243, 139, 168, 0.08)',
          borderRadius: '8px',
          border: `1px solid ${status?.configured
            ? 'rgba(166, 227, 161, 0.2)'
            : 'rgba(243, 139, 168, 0.2)'}`,
        }}>
          {status?.configured ? (
            <>
              <CheckCircle size={18} style={{ color: 'var(--color-green)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>API Key Configured</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-subtext-0)', marginTop: '2px' }}>
                  The Anthropic API key is set. The AI assistant is ready to use.
                </div>
              </div>
            </>
          ) : (
            <>
              <XCircle size={18} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>API Key Not Configured</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-subtext-0)', marginTop: '2px' }}>
                  Add <code style={{
                    background: 'var(--color-surface-0)',
                    padding: '0.1em 0.3em',
                    borderRadius: '3px',
                    fontSize: '0.85em',
                  }}>ANTHROPIC_API_KEY</code> to your environment variables to enable the AI assistant.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Model Selection ──────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Model</h2>
        </div>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
          Select which Claude model to use for conversations. Haiku is fastest,
          Opus is most capable.
        </p>
        <select
          value={settings.model || 'claude-sonnet-4-20250514'}
          onChange={e => handleSave({ model: e.target.value })}
          style={{
            width: '100%',
            maxWidth: '350px',
            padding: '0.5rem 0.75rem',
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-1)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {MODEL_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── System Prompt ────────────────────────────────────── */}
      <div className="card">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>System Prompt</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saved && (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-green)' }}>Saved</span>
            )}
            {settings.system_prompt && (
              <button
                onClick={() => handleSave({ system_prompt: '' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-subtext-0)',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-peach)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-subtext-0)'}
              >
                <RotateCcw size={12} />
                Reset to default
              </button>
            )}
          </div>
        </div>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
          Customize the AI's personality and behavior. Leave empty to use the default prompt.
        </p>
        <textarea
          value={settings.system_prompt || ''}
          onChange={e => setSettings(prev => ({ ...prev, system_prompt: e.target.value }))}
          onBlur={e => {
            // Save on blur if changed
            const newValue = e.target.value
            handleSave({ system_prompt: newValue })
          }}
          placeholder={settings.default_prompt || 'Default system prompt...'}
          rows={8}
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-1)',
            borderRadius: '8px',
            padding: '0.75rem',
            color: 'var(--color-text)',
            fontSize: '0.82rem',
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.5,
            outline: 'none',
            transition: 'border-color 0.15s ease',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--color-blue)'}
        />
      </div>
    </div>
  )
}
