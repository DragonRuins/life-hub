/**
 * LCARSComponentCard - LCARS-native vehicle component display.
 *
 * Replaces ComponentCard when LCARS theme is active.
 * Uses left accent bar (green=active, gray=archived), Antonio labels,
 * monospace values, and LCARS action buttons.
 */
import { Archive, Pencil } from 'lucide-react'
import { getComponentType } from '../../constants/componentTypes'

export default function LCARSComponentCard({ component, onEdit, onArchive, onClick }) {
  const isActive = component.is_active
  const typeConfig = getComponentType(component.component_type)
  const hasInstallMileage = component.install_mileage !== null && component.install_mileage !== undefined
  const accentColor = isActive ? 'var(--lcars-green)' : 'var(--lcars-gray)'

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        background: '#000000',
        border: '1px solid rgba(102, 102, 136, 0.3)',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        opacity: isActive ? 1 : 0.6,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = accentColor }}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(102, 102, 136, 0.3)'}
    >
      {/* Left accent bar */}
      <div style={{
        width: '5px',
        background: accentColor,
        flexShrink: 0,
      }} />

      <div style={{ flex: 1, padding: '0.625rem 0.75rem' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{typeConfig.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '0.88rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--lcars-space-white)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {component.brand || 'Unknown'} {component.model || ''}
              </div>
              <div style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--lcars-gray)',
              }}>
                {typeConfig.label}
                {component.position && ` // ${component.position}`}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
            {isActive && onArchive && (
              <ActionBtn
                onClick={(e) => { e.stopPropagation(); onArchive(component) }}
                title="Archive"
              >
                <Archive size={13} />
              </ActionBtn>
            )}
            {onEdit && (
              <ActionBtn
                onClick={(e) => { e.stopPropagation(); onEdit(component) }}
                title="Edit"
              >
                <Pencil size={13} />
              </ActionBtn>
            )}
          </div>
        </div>

        {/* Data fields */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.25rem 1.25rem',
          marginTop: '0.5rem',
        }}>
          {component.install_date && (
            <DataField label="Installed" value={component.install_date} />
          )}
          {hasInstallMileage && (
            <DataField label="@ Mileage" value={`${component.install_mileage.toLocaleString()} mi`} />
          )}
          {component.part_number && (
            <DataField label="PN" value={component.part_number} />
          )}
          {component.purchase_price && (
            <DataField label="Cost" value={`$${component.purchase_price.toFixed(2)}`} color="var(--lcars-green)" />
          )}
          {!isActive && component.remove_date && (
            <DataField label="Removed" value={component.remove_date} color="var(--lcars-tomato)" />
          )}
        </div>

        {/* Log count */}
        {component.log_count > 0 && (
          <div style={{
            marginTop: '0.375rem',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.7rem',
            color: 'var(--lcars-gray)',
          }}>
            {component.log_count} service record{component.log_count !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}


function DataField({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--lcars-gray)',
        whiteSpace: 'nowrap',
      }}>
        {label}:
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.75rem',
        fontWeight: 600,
        color: color || 'var(--lcars-space-white)',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}


function ActionBtn({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        background: 'rgba(102, 102, 136, 0.15)',
        border: 'none',
        color: 'var(--lcars-gray)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--lcars-sunflower)'
        e.currentTarget.style.color = '#000000'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(102, 102, 136, 0.15)'
        e.currentTarget.style.color = 'var(--lcars-gray)'
      }}
    >
      {children}
    </button>
  )
}
