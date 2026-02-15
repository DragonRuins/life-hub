/**
 * Channel Form
 *
 * Dynamic form that renders config fields based on the CONFIG_SCHEMA
 * fetched from the backend. Supports two steps:
 *   Step 1 (create only): Pick a channel type from a card grid
 *   Step 2: Fill in the dynamic config fields for that type
 *
 * Supported field types from CONFIG_SCHEMA:
 *   text, password, url, number, select, toggle, color, textarea
 *
 * Props:
 *   channel  - existing channel object to edit (null for create)
 *   schemas  - the schemas object from GET /channels/schemas
 *   onSubmit - callback(data) to pass form data to the parent
 *   onCancel - callback() to close the form
 *
 * IMPORTANT: This form does NOT call the API directly.
 * It passes data to the parent via onSubmit, following the
 * project's correct form pattern to prevent double-submission.
 */
import { useState } from 'react'
import { Radio, MessageSquare, Mail, Bell, Smartphone, ArrowLeft } from 'lucide-react'

// Icons and colors for each channel type (used in the type picker)
const TYPE_META = {
  pushover: { icon: Radio, color: 'var(--color-peach)', bg: 'rgba(250, 179, 135, 0.1)' },
  discord: { icon: MessageSquare, color: 'var(--color-mauve)', bg: 'rgba(203, 166, 247, 0.1)' },
  email: { icon: Mail, color: 'var(--color-blue)', bg: 'rgba(137, 180, 250, 0.1)' },
  in_app: { icon: Bell, color: 'var(--color-green)', bg: 'rgba(166, 227, 161, 0.1)' },
  sms: { icon: Smartphone, color: 'var(--color-overlay-0)', bg: 'rgba(108, 112, 134, 0.1)' },
}

export default function ChannelForm({ channel, schemas, onSubmit, onCancel }) {
  // When editing, skip the type picker (step 1) and go straight to fields
  const [selectedType, setSelectedType] = useState(channel?.channel_type || null)

  // Form state: name, is_enabled, and config fields
  const [name, setName] = useState(channel?.name || '')
  const [isEnabled, setIsEnabled] = useState(channel?.is_enabled ?? true)
  const [config, setConfig] = useState(channel?.config || {})

  // Check if the selected type is SMS (coming soon)
  const isSms = selectedType === 'sms'

  // Get the schema for the selected type
  const selectedSchema = selectedType ? schemas[selectedType] : null

  /** Handle changes to config fields */
  function handleConfigChange(key, value) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  /** Submit the form - passes data to parent (does NOT call API) */
  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      name,
      channel_type: selectedType,
      config,
      is_enabled: isEnabled,
    })
  }

  // ── Step 1: Type picker (only shown when creating) ──────────
  if (!selectedType) {
    return (
      <div>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-subtext-0)', marginBottom: '1rem' }}>
          Choose a channel type:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {Object.entries(schemas).map(([typeKey, schema]) => {
            const meta = TYPE_META[typeKey] || TYPE_META.in_app
            const Icon = meta.icon
            const isComingSoon = typeKey === 'sms'

            return (
              <button
                key={typeKey}
                onClick={() => setSelectedType(typeKey)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                  padding: '1.25rem 0.75rem', borderRadius: '12px', cursor: 'pointer',
                  background: 'var(--color-mantle)', border: '1px solid var(--color-surface-0)',
                  color: meta.color, transition: 'all 0.15s ease', position: 'relative',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-surface-0)' }}
              >
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px', background: meta.bg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{schema.display_name}</span>
                {isComingSoon && (
                  <span style={{
                    position: 'absolute', top: '0.5rem', right: '0.5rem',
                    fontSize: '0.6rem', padding: '0.1rem 0.375rem', borderRadius: '4px',
                    background: 'rgba(108, 112, 134, 0.2)', color: 'var(--color-overlay-0)',
                  }}>
                    Soon
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    )
  }

  // ── Step 2: Dynamic config form ─────────────────────────────
  return (
    <form onSubmit={handleSubmit}>
      {/* Back button to type picker (only for new channels) */}
      {!channel && (
        <button
          type="button"
          onClick={() => setSelectedType(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-subtext-0)', fontSize: '0.8rem', marginBottom: '1rem',
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={14} />
          Back to type selection
        </button>
      )}

      {/* SMS "Coming Soon" banner */}
      {isSms && (
        <div style={{
          padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem',
          background: 'rgba(108, 112, 134, 0.1)', border: '1px solid var(--color-surface-0)',
          color: 'var(--color-overlay-0)', fontSize: '0.85rem',
        }}>
          SMS notifications are coming soon. You can save this channel, but it will not send messages yet.
        </div>
      )}

      {/* Channel name (always shown) */}
      <div style={{ marginBottom: '1rem' }}>
        <label>Name *</label>
        <input
          type="text"
          placeholder={`My ${selectedSchema?.display_name || ''} Channel`}
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>

      {/* Dynamic fields from CONFIG_SCHEMA */}
      {selectedSchema?.schema?.map(field => (
        <div key={field.key} style={{ marginBottom: '1rem' }}>
          {/* Label with required asterisk */}
          {field.type !== 'toggle' && (
            <label>
              {field.label} {field.required && '*'}
            </label>
          )}

          {/* Render the appropriate input type */}
          {renderField(field, config[field.key] ?? field.default ?? '', handleConfigChange)}

          {/* Help text below field */}
          {field.help && (
            <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>
              {field.help}
            </p>
          )}
        </div>
      ))}

      {/* Enabled toggle */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={e => setIsEnabled(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <span style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.875rem' }}>
            Enable this channel
          </span>
        </label>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={isSms}>
          {channel ? 'Save Changes' : 'Create Channel'}
        </button>
      </div>
    </form>
  )
}


/**
 * Render a single form field based on its schema definition.
 *
 * @param {object} field - Field definition from CONFIG_SCHEMA
 * @param {*} value - Current field value
 * @param {function} onChange - Callback (key, value) => void
 */
function renderField(field, value, onChange) {
  const isComingSoon = field.coming_soon

  switch (field.type) {
    case 'text':
    case 'password':
    case 'url':
      return (
        <input
          type={field.type}
          value={value || ''}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.default || ''}
          required={field.required}
          disabled={isComingSoon}
          style={isComingSoon ? { opacity: 0.5 } : undefined}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          value={value ?? ''}
          onChange={e => onChange(field.key, e.target.value ? Number(e.target.value) : '')}
          placeholder={field.default != null ? String(field.default) : ''}
          required={field.required}
          disabled={isComingSoon}
          style={isComingSoon ? { opacity: 0.5 } : undefined}
        />
      )

    case 'select':
      return (
        <select
          value={value || field.default || ''}
          onChange={e => onChange(field.key, e.target.value)}
          required={field.required}
          disabled={isComingSoon}
          style={isComingSoon ? { opacity: 0.5 } : undefined}
        >
          <option value="">-- Select --</option>
          {field.options?.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )

    case 'toggle':
      return (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={e => onChange(field.key, e.target.checked)}
            style={{ width: 'auto' }}
            disabled={isComingSoon}
          />
          <span style={{
            textTransform: 'none', letterSpacing: 'normal', fontSize: '0.875rem',
            opacity: isComingSoon ? 0.5 : 1,
          }}>
            {field.label}
          </span>
        </label>
      )

    case 'color':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <input
            type="color"
            value={value || '#89b4fa'}
            onChange={e => onChange(field.key, e.target.value)}
            style={{ width: '48px', height: '36px', padding: '2px', cursor: 'pointer', borderRadius: '6px' }}
            disabled={isComingSoon}
          />
          <input
            type="text"
            value={value || ''}
            onChange={e => onChange(field.key, e.target.value)}
            placeholder="#89b4fa"
            style={{ flex: 1 }}
            disabled={isComingSoon}
          />
        </div>
      )

    case 'textarea':
      return (
        <textarea
          rows={3}
          value={value || ''}
          onChange={e => onChange(field.key, e.target.value)}
          placeholder={field.default || ''}
          required={field.required}
          disabled={isComingSoon}
          style={isComingSoon ? { opacity: 0.5 } : undefined}
        />
      )

    default:
      // Fallback: render as text input
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(field.key, e.target.value)}
          required={field.required}
        />
      )
  }
}
