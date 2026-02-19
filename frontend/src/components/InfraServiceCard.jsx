/**
 * InfraServiceCard.jsx - Service Status Card
 *
 * Displays a monitored service with status, response time, and URL.
 */
import { Globe, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

const STATUS_CONFIG = {
  up:       { color: 'var(--color-green)',  icon: CheckCircle, label: 'Up' },
  down:     { color: 'var(--color-red)',    icon: XCircle,     label: 'Down' },
  degraded: { color: 'var(--color-yellow)', icon: AlertTriangle, label: 'Degraded' },
  unknown:  { color: 'var(--color-overlay-0)', icon: Activity,    label: 'Unknown' },
}

export default function InfraServiceCard({ service, onClick }) {
  const config = STATUS_CONFIG[service.status] || STATUS_CONFIG.unknown
  const StatusIcon = config.icon

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        padding: '0.875rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      {/* Status indicator */}
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '8px',
        background: `${config.color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <StatusIcon size={16} style={{ color: config.color }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{service.name}</div>
        <div style={{
          fontSize: '0.75rem',
          color: 'var(--color-subtext-0)',
          marginTop: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {service.url || 'No URL configured'}
        </div>
      </div>

      {/* Response time */}
      {service.last_response_time_ms != null && (
        <div style={{
          fontSize: '0.8rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--color-subtext-0)',
          flexShrink: 0,
        }}>
          {service.last_response_time_ms}ms
        </div>
      )}

      {/* Status badge */}
      <div style={{
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: config.color,
        background: `${config.color}12`,
        padding: '0.25rem 0.5rem',
        borderRadius: '4px',
        flexShrink: 0,
      }}>
        {config.label}
      </div>
    </div>
  )
}
