/**
 * LCARSTireSetCard - LCARS-native tire set display.
 *
 * Replaces TireSetCard when LCARS theme is active.
 * Uses left accent bar, Antonio labels, monospace values,
 * and LCARS status badges.
 */
import { Car, Gauge } from 'lucide-react'

export default function LCARSTireSetCard({ tireSet, vehicleMileage, onEdit, onDelete, onSwap }) {
  const isCurrent = tireSet.is_current

  let milesOnSet = tireSet.accumulated_mileage || 0
  if (isCurrent && tireSet.mileage_at_last_swap != null && vehicleMileage != null) {
    milesOnSet = (vehicleMileage - tireSet.mileage_at_last_swap)
  }

  const vehicleMileageDelta = isCurrent && vehicleMileage != null
    ? (vehicleMileage - (tireSet.mileage_at_last_swap || 0))
    : null

  const accentColor = isCurrent ? 'var(--lcars-ice)' : 'var(--lcars-gray)'

  return (
    <div style={{
      display: 'flex',
      background: '#000000',
      border: '1px solid rgba(102, 102, 136, 0.3)',
      overflow: 'hidden',
    }}>
      {/* Left accent bar */}
      <div style={{
        width: '5px',
        background: accentColor,
        flexShrink: 0,
      }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 0.75rem',
          borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
            <Car size={14} style={{ color: accentColor, flexShrink: 0 }} />
            <span style={{
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
              {tireSet.name}
            </span>
          </div>

          {/* Status badge */}
          <span style={{
            padding: '0.1rem 0.5rem',
            background: isCurrent ? 'var(--lcars-ice)' : 'rgba(102, 102, 136, 0.3)',
            color: isCurrent ? '#000000' : 'var(--lcars-gray)',
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
          }}>
            {isCurrent ? 'Equipped' : 'Storage'}
          </span>
        </div>

        {/* Data fields */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0 1.5rem',
          padding: '0.5rem 0.75rem',
        }}>
          <DataField label="Tires" value={`${tireSet.tire_brand || '-'} ${tireSet.tire_model || ''}`} />
          <DataField label="Rims" value={`${tireSet.rim_brand || '-'} ${tireSet.rim_model || ''}`} />
          <DataField
            label="Miles on Set"
            value={milesOnSet > 0 ? milesOnSet.toLocaleString() : '-'}
            suffix={isCurrent && vehicleMileageDelta != null ? ` (+${Math.abs(vehicleMileageDelta).toLocaleString()})` : ''}
          />
          {tireSet.tire_size && <DataField label="Size" value={tireSet.tire_size} />}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          gap: '3px',
          justifyContent: 'flex-end',
          padding: '0.375rem 0.75rem',
          borderTop: '1px solid rgba(102, 102, 136, 0.15)',
        }}>
          {!isCurrent && (
            <LCARSActionBtn onClick={onSwap} color="var(--lcars-ice)">Equip</LCARSActionBtn>
          )}
          <LCARSActionBtn onClick={onEdit} color="var(--lcars-sunflower)">Edit</LCARSActionBtn>
          <LCARSActionBtn onClick={onDelete} color="var(--lcars-tomato)">Delete</LCARSActionBtn>
        </div>
      </div>
    </div>
  )
}


function DataField({ label, value, suffix }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '0.375rem',
      padding: '0.2rem 0',
    }}>
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.68rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--lcars-gray)',
        whiteSpace: 'nowrap',
      }}>
        {label}:
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--lcars-space-white)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value}
        {suffix && (
          <span style={{ color: 'var(--lcars-gray)', fontWeight: 400 }}>{suffix}</span>
        )}
      </span>
    </div>
  )
}


function LCARSActionBtn({ children, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.2rem 0.6rem',
        border: 'none',
        background: 'rgba(102, 102, 136, 0.2)',
        color: 'var(--lcars-gray)',
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.7rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = color
        e.currentTarget.style.color = '#000000'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(102, 102, 136, 0.2)'
        e.currentTarget.style.color = 'var(--lcars-gray)'
      }}
    >
      {children}
    </button>
  )
}
