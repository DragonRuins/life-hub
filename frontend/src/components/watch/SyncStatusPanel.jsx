/**
 * SyncStatusPanel - Pipeline status cards for watch sync.
 *
 * Displays a grid of status cards for each data pipeline
 * (health, NFC, barometer, etc.) with color-coded status
 * and relative time display.
 *
 * Props:
 *   pipelines   - Array of { name, status, last_sync, record_count, error }
 *   loading     - Whether data is loading
 */
import { RefreshCw, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

// Stale thresholds in minutes
const STALE_THRESHOLDS = {
  health: 30,
  default: 60,
}

const STATUS_CONFIG = {
  synced:  { color: 'var(--color-green)',  icon: CheckCircle,    label: 'Synced' },
  stale:   { color: 'var(--color-yellow)', icon: AlertTriangle,  label: 'Stale' },
  error:   { color: 'var(--color-red)',    icon: XCircle,        label: 'Error' },
  syncing: { color: 'var(--color-blue)',   icon: RefreshCw,      label: 'Syncing' },
  unknown: { color: 'var(--color-subtext-0)', icon: RefreshCw,   label: 'Unknown' },
}

export default function SyncStatusPanel({ pipelines = [], loading = false }) {
  if (loading) {
    return (
      <div className="card-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            height: '100px',
            background: 'var(--color-surface-0)',
            borderRadius: '12px',
            opacity: 0.3,
          }} />
        ))}
      </div>
    )
  }

  if (pipelines.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        color: 'var(--color-subtext-0)',
        fontSize: '0.85rem',
      }}>
        No sync pipelines configured.
      </div>
    )
  }

  return (
    <div className="card-grid">
      {pipelines.map(pipeline => {
        const effectiveStatus = getEffectiveStatus(pipeline)
        const config = STATUS_CONFIG[effectiveStatus] || STATUS_CONFIG.unknown
        const StatusIcon = config.icon

        return (
          <div key={pipeline.name} className="card" style={{ padding: '1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}>
              <span style={{
                fontWeight: 600,
                fontSize: '0.85rem',
                textTransform: 'capitalize',
              }}>
                {pipeline.name}
              </span>
              <StatusIcon
                size={16}
                style={{
                  color: config.color,
                  animation: effectiveStatus === 'syncing' ? 'spin 1s linear infinite' : 'none',
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              marginBottom: '0.5rem',
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: config.color,
              }} />
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 500,
                color: config.color,
              }}>
                {config.label}
              </span>
            </div>

            <div style={{
              fontSize: '0.75rem',
              color: 'var(--color-subtext-0)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.125rem',
            }}>
              {pipeline.last_sync && (
                <div>Last sync: {formatRelativeTime(pipeline.last_sync)}</div>
              )}
              {pipeline.record_count != null && (
                <div>Records: {pipeline.record_count.toLocaleString()}</div>
              )}
              {pipeline.error && (
                <div style={{ color: 'var(--color-red)', marginTop: '0.25rem' }}>
                  {pipeline.error}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Determine effective status based on last_sync time and thresholds */
function getEffectiveStatus(pipeline) {
  if (pipeline.status === 'error') return 'error'
  if (pipeline.status === 'syncing') return 'syncing'
  if (!pipeline.last_sync) return 'unknown'

  const minutesAgo = (Date.now() - new Date(pipeline.last_sync).getTime()) / 60000
  const threshold = pipeline.name === 'health'
    ? STALE_THRESHOLDS.health
    : STALE_THRESHOLDS.default

  if (minutesAgo > threshold) return 'stale'
  return 'synced'
}

/** Format a timestamp into relative time */
function formatRelativeTime(ts) {
  if (!ts) return 'Never'
  const diffMs = Date.now() - new Date(ts).getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return `${Math.floor(diffMin / 1440)}d ago`
}
