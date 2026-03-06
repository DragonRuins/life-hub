/**
 * NFCEventLog - Scrollable list of NFC tap events.
 *
 * Shows chronological NFC tag scan events with status dots,
 * action name, and timestamp. Supports loading skeleton.
 *
 * Props:
 *   events    - Array of event objects { id, action_name, tag_id, scanned_at, status, error }
 *   loading   - Whether data is still loading
 *   maxHeight - Max height before scrolling (default: '400px')
 */
import { formatDate } from '../../utils/formatDate'
import { Nfc } from 'lucide-react'

const STATUS_COLORS = {
  success: 'var(--color-green)',
  error: 'var(--color-red)',
  pending: 'var(--color-yellow)',
  unknown: 'var(--color-subtext-0)',
}

export default function NFCEventLog({ events = [], loading = false, maxHeight = '400px' }) {
  if (loading) {
    return <LoadingSkeleton />
  }

  if (events.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        color: 'var(--color-subtext-0)',
      }}>
        <Nfc size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.85rem' }}>No NFC events recorded yet.</p>
      </div>
    )
  }

  return (
    <div style={{
      maxHeight,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {events.map(event => (
        <div
          key={event.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.625rem 0.75rem',
            borderBottom: '1px solid var(--color-surface-0)',
          }}
        >
          {/* Status dot */}
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: STATUS_COLORS[event.status] || STATUS_COLORS.unknown,
            flexShrink: 0,
          }} />

          {/* Event info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 500,
              fontSize: '0.85rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {event.action_name || 'Unknown Action'}
            </div>
            {event.tag_id && (
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--color-subtext-0)',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {event.tag_id}
              </div>
            )}
            {event.error && (
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--color-red)',
                marginTop: '0.125rem',
              }}>
                {event.error}
              </div>
            )}
          </div>

          {/* Timestamp */}
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--color-subtext-0)',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}>
            {formatTimestamp(event.scanned_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Format a timestamp into a relative or short display */
function formatTimestamp(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return formatDate(ts)
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.625rem 0.75rem',
          borderBottom: '1px solid var(--color-surface-0)',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: 'var(--color-surface-1)', opacity: 0.4,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{
              height: '14px', width: `${60 + (i * 15) % 40}%`,
              background: 'var(--color-surface-0)', borderRadius: '4px', opacity: 0.3,
            }} />
          </div>
          <div style={{
            height: '12px', width: '50px',
            background: 'var(--color-surface-0)', borderRadius: '4px', opacity: 0.3,
          }} />
        </div>
      ))}
    </div>
  )
}
