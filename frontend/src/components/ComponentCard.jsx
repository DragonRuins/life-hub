/**
 * ComponentCard - Displays a single vehicle component.
 * Shows active status, key details, and quick actions.
 */
import { Archive, Pencil, MoreVertical } from 'lucide-react'
import { getComponentType } from '../constants/componentTypes'

export default function ComponentCard({ component, onEdit, onArchive, onClick }) {
  const isActive = component.is_active
  const typeConfig = getComponentType(component.component_type)

  // Calculate mileage on component (if we have vehicle's current mileage)
  // For now, we'll just show what we have
  const hasInstallMileage = component.install_mileage !== null && component.install_mileage !== undefined

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '1rem',
        cursor: onClick ? 'pointer' : 'default',
        opacity: isActive ? 1 : 0.6,
        borderLeft: isActive ? '3px solid var(--color-green)' : '3px solid var(--color-overlay-0)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>{typeConfig.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              {component.brand || 'Unknown'} {component.model || ''}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
              {typeConfig.label}
              {component.position && ` • ${component.position}`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {isActive && onArchive && (
            <button
              className="btn btn-ghost"
              onClick={(e) => { e.stopPropagation(); onArchive(component); }}
              style={{ padding: '0.4rem' }}
              title="Archive/Remove"
            >
              <Archive size={14} />
            </button>
          )}
          {onEdit && (
            <button
              className="btn btn-ghost"
              onClick={(e) => { e.stopPropagation(); onEdit(component); }}
              style={{ padding: '0.4rem' }}
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Details */}
      <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
        {component.install_date && (
          <span>Installed: {component.install_date}</span>
        )}
        {hasInstallMileage && (
          <span>@ {component.install_mileage.toLocaleString()} mi</span>
        )}
        {component.part_number && (
          <span>PN: {component.part_number}</span>
        )}
        {component.purchase_price && (
          <span style={{ color: 'var(--color-green)' }}>
            ${component.purchase_price.toFixed(2)}
          </span>
        )}
        {!isActive && component.remove_date && (
          <span style={{ color: 'var(--color-red)' }}>
            Removed: {component.remove_date}
          </span>
        )}
      </div>

      {/* Logs indicator */}
      {component.log_count > 0 && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
          {component.log_count} service record{component.log_count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
