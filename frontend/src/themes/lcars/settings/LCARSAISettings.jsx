/**
 * LCARSAISettings.jsx - AI Assistant Settings Sub-Page (LCARS Theme)
 *
 * Same functionality as the Catppuccin version but with LCARS styling:
 * Antonio font, pill buttons, panel layout, LCARS color variables.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, RotateCcw } from 'lucide-react'
import { ai } from '../../../api/client'
import LCARSPanel from '../LCARSPanel'

/** Available Claude models */
const MODEL_OPTIONS = [
  { value: 'claude-haiku-4-20250414', label: 'Claude Haiku (fastest)' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet (balanced)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus (most capable)' },
]

const antonio = "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif"

export default function LCARSAISettings() {
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState(null)
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
    setSaved(false)
    try {
      const updated = await ai.settings.update(updates)
      setSettings(prev => ({ ...prev, ...updated }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Failed to save AI settings:', err)
    }
  }

  if (!settings) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <Link
          to="/settings"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            color: 'var(--lcars-ice)',
            textDecoration: 'none',
            fontFamily: antonio,
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <ArrowLeft size={16} />
          Settings
        </Link>
        <p style={{
          color: 'var(--lcars-gray)',
          fontFamily: antonio,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Loading...
        </p>
      </div>
    )
  }

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
          fontFamily: antonio,
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      {/* ── API Status ───────────────────────────────────────── */}
      <LCARSPanel title="API Status" color="var(--lcars-sunflower)">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem',
          borderLeft: `3px solid ${status?.configured ? 'var(--lcars-green)' : 'var(--lcars-tomato)'}`,
        }}>
          {status?.configured ? (
            <>
              <CheckCircle size={20} style={{ color: 'var(--lcars-green)', flexShrink: 0 }} />
              <div>
                <div style={{
                  fontFamily: antonio,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--lcars-space-white)',
                }}>
                  API Key Configured
                </div>
                <div style={{
                  fontFamily: antonio,
                  fontSize: '0.72rem',
                  color: 'var(--lcars-gray)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: '2px',
                }}>
                  Anthropic API key is set — AI assistant operational
                </div>
              </div>
            </>
          ) : (
            <>
              <XCircle size={20} style={{ color: 'var(--lcars-tomato)', flexShrink: 0 }} />
              <div>
                <div style={{
                  fontFamily: antonio,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--lcars-space-white)',
                }}>
                  API Key Missing
                </div>
                <div style={{
                  fontFamily: antonio,
                  fontSize: '0.72rem',
                  color: 'var(--lcars-gray)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginTop: '2px',
                }}>
                  Set ANTHROPIC_API_KEY in environment to enable
                </div>
              </div>
            </>
          )}
        </div>
      </LCARSPanel>

      {/* ── Model Selection ──────────────────────────────────── */}
      <LCARSPanel title="Model Selection" color="var(--lcars-african-violet)">
        <p style={{
          fontFamily: antonio,
          fontSize: '0.78rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.75rem',
        }}>
          Select Claude model variant for AI processing
        </p>
        <select
          value={settings.model || 'claude-sonnet-4-20250514'}
          onChange={e => handleSave({ model: e.target.value })}
          style={{
            width: '100%',
            maxWidth: '350px',
            padding: '0.5rem 0.75rem',
            background: '#000000',
            border: '1px solid var(--lcars-gray)',
            borderRadius: '4px',
            color: 'var(--lcars-space-white)',
            fontFamily: antonio,
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {MODEL_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </LCARSPanel>

      {/* ── System Prompt ────────────────────────────────────── */}
      <LCARSPanel title="System Prompt" color="var(--lcars-butterscotch)">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}>
          <p style={{
            fontFamily: antonio,
            fontSize: '0.78rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Custom AI behavioral directives — leave blank for default
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {saved && (
              <span style={{
                fontFamily: antonio,
                fontSize: '0.72rem',
                color: 'var(--lcars-green)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Saved
              </span>
            )}
            {settings.system_prompt && (
              <button
                onClick={() => handleSave({ system_prompt: '' })}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  height: '24px',
                  padding: '0 0.5rem',
                  borderRadius: '12px',
                  background: 'var(--lcars-tanoi)',
                  border: 'none',
                  color: 'var(--lcars-text-on-color)',
                  cursor: 'pointer',
                  fontFamily: antonio,
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                <RotateCcw size={10} />
                Reset
              </button>
            )}
          </div>
        </div>
        <textarea
          value={settings.system_prompt || ''}
          onChange={e => setSettings(prev => ({ ...prev, system_prompt: e.target.value }))}
          placeholder={settings.default_prompt || 'Default system prompt...'}
          rows={8}
          style={{
            width: '100%',
            resize: 'vertical',
            background: '#000000',
            border: '1px solid var(--lcars-gray)',
            borderRadius: '4px',
            padding: '0.75rem',
            color: 'var(--lcars-space-white)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.78rem',
            lineHeight: 1.5,
            outline: 'none',
            transition: 'border-color 0.15s ease',
            boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--lcars-sunflower)'}
          onBlur={e => {
            e.target.style.borderColor = 'var(--lcars-gray)'
            handleSave({ system_prompt: e.target.value })
          }}
        />
      </LCARSPanel>
    </div>
  )
}
