/**
 * InfraContainerCard.jsx - Container Status Card
 *
 * Displays a Docker container's status, image, and ports.
 * Used on both the infrastructure dashboard and host detail pages.
 */
import { Box, Play, Square, RotateCw, AlertTriangle } from 'lucide-react'

const STATUS_CONFIG = {
  running:    { color: 'var(--color-green)',  icon: Play,          label: 'Running' },
  stopped:    { color: 'var(--color-red)',    icon: Square,        label: 'Stopped' },
  exited:     { color: 'var(--color-red)',    icon: Square,        label: 'Exited' },
  restarting: { color: 'var(--color-yellow)', icon: RotateCw,      label: 'Restarting' },
  unknown:    { color: 'var(--color-overlay-0)', icon: AlertTriangle, label: 'Unknown' },
}

export default function InfraContainerCard({ container, onClick }) {
  const config = STATUS_CONFIG[container.status] || STATUS_CONFIG.unknown
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
        <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {container.name}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', marginTop: '2px' }}>
          {container.image || 'No image'}
          {container.compose_project && (
            <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
              ({container.compose_project})
            </span>
          )}
        </div>
      </div>

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
