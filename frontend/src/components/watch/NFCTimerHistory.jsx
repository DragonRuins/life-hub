/**
 * NFCTimerHistory - Timer history table with desktop/mobile views.
 *
 * Displays NFC-triggered timer entries with action name, start/end times,
 * duration, and status. Active timers show a pulsing dot.
 *
 * Props:
 *   timers    - Array of timer objects { id, action_name, started_at, ended_at, duration_seconds, status }
 *   loading   - Whether data is still loading
 */
import useIsMobile from '../../hooks/useIsMobile'
import { formatDate } from '../../utils/formatDate'

export default function NFCTimerHistory({ timers = [], loading = false }) {
  const isMobile = useIsMobile()

  if (loading) {
    return <LoadingSkeleton />
  }

  if (timers.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        color: 'var(--color-subtext-0)',
        fontSize: '0.85rem',
      }}>
        No timer history yet.
      </div>
    )
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {timers.map(timer => (
          <div key={timer.id} className="card" style={{ padding: '0.75rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.375rem',
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {timer.action_name || 'Timer'}
              </span>
              <StatusBadge status={timer.status} />
            </div>
            <div className="form-grid-2col" style={{
              gap: '0.25rem 1rem',
              fontSize: '0.8rem',
              color: 'var(--color-subtext-0)',
            }}>
              <div>Started: <span style={{ color: 'var(--color-text)' }}>
                {formatDate(timer.started_at)}
              </span></div>
              <div>Duration: <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>
                {formatDuration(timer.duration_seconds)}
              </span></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Desktop table view
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.85rem',
      }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
            <Th>Action</Th>
            <Th>Started</Th>
            <Th>Ended</Th>
            <Th align="right">Duration</Th>
            <Th align="center">Status</Th>
          </tr>
        </thead>
        <tbody>
          {timers.map(timer => (
            <tr key={timer.id} style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
              <Td>{timer.action_name || 'Timer'}</Td>
              <Td>{formatDate(timer.started_at)}</Td>
              <Td>{timer.ended_at ? formatDate(timer.ended_at) : '\u2014'}</Td>
              <Td align="right" style={{ fontWeight: 600 }}>
                {formatDuration(timer.duration_seconds)}
              </Td>
              <Td align="center">
                <StatusBadge status={timer.status} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }) {
  const isActive = status === 'active' || status === 'running'
  const color = isActive ? 'var(--color-green)' : 'var(--color-subtext-0)'

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      fontSize: '0.75rem',
      fontWeight: 500,
      color,
    }}>
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: color,
        animation: isActive ? 'pulse 2s ease-in-out infinite' : 'none',
      }} />
      {status || 'completed'}
    </span>
  )
}

/** Format seconds into a human-readable duration */
function formatDuration(seconds) {
  if (seconds == null) return '\u2014'
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function Th({ children, align = 'left' }) {
  return (
    <th style={{
      padding: '0.625rem 1rem',
      textAlign: align,
      fontWeight: 600,
      fontSize: '0.75rem',
      color: 'var(--color-subtext-0)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {children}
    </th>
  )
}

function Td({ children, align = 'left', style = {} }) {
  return (
    <td style={{
      padding: '0.625rem 1rem',
      textAlign: align,
      color: 'var(--color-text)',
      ...style,
    }}>
      {children}
    </td>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{
          height: '48px',
          background: 'var(--color-surface-0)',
          borderRadius: '8px',
          opacity: 0.3,
        }} />
      ))}
    </div>
  )
}
