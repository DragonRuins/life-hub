/**
 * NFCActionCard - Display card for an NFC action definition.
 *
 * Shows action name, type badge, tag ID, and edit/delete buttons.
 * Used in WatchNFC page's Actions tab.
 *
 * Props:
 *   action     - Action object { id, name, action_type, tag_id, url, payload, ... }
 *   onEdit     - Callback when edit button clicked
 *   onDelete   - Callback when delete button clicked
 */
import { Pencil, Trash2, Nfc, Timer, Globe, Zap } from 'lucide-react'

const ACTION_TYPE_CONFIG = {
  url:     { label: 'URL',     color: 'var(--color-blue)',   icon: Globe },
  timer:   { label: 'Timer',   color: 'var(--color-green)',  icon: Timer },
  trigger: { label: 'Trigger', color: 'var(--color-peach)',  icon: Zap },
  shortcut: { label: 'Shortcut', color: 'var(--color-mauve)', icon: Zap },
}

export default function NFCActionCard({ action, onEdit, onDelete }) {
  const typeConfig = ACTION_TYPE_CONFIG[action.action_type] || {
    label: action.action_type,
    color: 'var(--color-subtext-0)',
    icon: Nfc,
  }
  const TypeIcon = typeConfig.icon

  return (
    <div className="card" style={{ padding: '1rem' }}>
      {/* Header: name + type badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Nfc size={16} style={{ color: typeConfig.color }} />
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {action.name}
          </span>
        </div>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.125rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          background: `color-mix(in srgb, ${typeConfig.color} 15%, transparent)`,
          color: typeConfig.color,
        }}>
          <TypeIcon size={12} />
          {typeConfig.label}
        </span>
      </div>

      {/* Details */}
      <div style={{
        fontSize: '0.8rem',
        color: 'var(--color-subtext-0)',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        marginBottom: '0.75rem',
      }}>
        {action.tag_id && (
          <div>
            Tag ID: <span style={{ color: 'var(--color-text)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem' }}>
              {action.tag_id}
            </span>
          </div>
        )}
        {action.url && (
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            URL: <span style={{ color: 'var(--color-text)' }}>{action.url}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{
        display: 'flex',
        gap: '0.375rem',
        justifyContent: 'flex-end',
      }}>
        <button
          className="btn btn-ghost"
          onClick={() => onEdit(action)}
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
        >
          <Pencil size={14} />
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => onDelete(action.id)}
          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--color-red)' }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
