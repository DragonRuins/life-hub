/**
 * TireSetCard - Display a tire set (4 tires + 4 rims).
 *
 * Shows set name, tire details, rim details, mileage, and current status.
 */
import { Car } from 'lucide-react'

export default function TireSetCard({ tireSet, vehicleMileage, onEdit, onDelete, onSwap }) {
  const isCurrent = tireSet.is_current

  // Calculate miles on set:
  // - If equipped: accumulated miles driven since last swap
  // - If stored (in storage): just the accumulated value
  let milesOnSet = tireSet.accumulated_mileage || 0
  if (isCurrent && tireSet.mileage_at_last_swap != null && vehicleMileage != null) {
    milesOnSet = (vehicleMileage - tireSet.mileage_at_last_swap)
  }

  // Show vehicle mileage delta (for context)
  const vehicleMileageDelta = isCurrent && vehicleMileage != null
    ? (vehicleMileage - (tireSet.mileage_at_last_swap || 0))
    : null

  return (
    <div className="card" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
      padding: '0.875rem 1rem',
      background: 'var(--color-mantle)',
      borderRadius: '8px',
    }}>
      {/* Header with name, status, and actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '6px',
            background: 'rgba(137, 180, 250, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Car size={14} style={{ color: 'var(--color-blue)' }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {tireSet.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
              {tireSet.tire_brand || '-'} {tireSet.tire_model || ''}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        {isCurrent ? (
          <div style={{
            padding: '0.125rem 0.5rem',
            background: 'var(--color-blue)',
            color: 'white',
            fontSize: '0.7rem',
            fontWeight: 600,
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}>
            Equipped
          </div>
        ) : (
          <div style={{
            padding: '0.125rem 0.5rem',
            background: 'var(--color-surface-2)',
            color: 'var(--color-subtext-1)',
            fontSize: '0.7rem',
            fontWeight: 600,
            borderRadius: '4px',
            whiteSpace: 'nowrap',
          }}>
            In Storage
          </div>
        )}
      </div>

      {/* Details row - compact grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.75rem' }}>
        <div>
          <span style={{ color: 'var(--color-subtext-0)', marginRight: '0.25rem' }}>Rims:</span>
          <span>{tireSet.rim_brand || '-'} {tireSet.rim_model || ''}</span>
        </div>
        <div>
          <span style={{ color: 'var(--color-subtext-0)', marginRight: '0.25rem' }}>Miles on set:</span>
          <span style={{ fontWeight: 600 }}>{milesOnSet > 0 ? milesOnSet.toLocaleString() : '-'}</span>
          {isCurrent && vehicleMileageDelta != null && (
            <span style={{ color: 'var(--color-subtext-1)', marginLeft: '0.25rem' }}>
              (+{Math.abs(vehicleMileageDelta)})
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
        {!isCurrent && (
          <button className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={onSwap}>
            Equip
          </button>
        )}
        <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={onEdit}>
          Edit
        </button>
        <button className="btn btn-danger" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}
