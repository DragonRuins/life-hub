/**
 * VehicleSettings.jsx - Default Vehicle Selector (Catppuccin Theme)
 *
 * Lets the user pick which vehicle shows on the dashboard by default.
 * Stores the selection in localStorage as `dashboard_vehicle_id` and
 * dispatches a `vehicle-selection-changed` event so the dashboard
 * can react without a full reload.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Car, Star, Check } from 'lucide-react'
import { vehicles as vehiclesApi } from '../../api/client'

export default function VehicleSettings() {
  const [vehicleList, setVehicleList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(
    localStorage.getItem('dashboard_vehicle_id') || 'all'
  )

  useEffect(() => {
    vehiclesApi.list()
      .then(setVehicleList)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleSelect(id) {
    setSelectedId(id)
    localStorage.setItem('dashboard_vehicle_id', id)
    window.dispatchEvent(new Event('vehicle-selection-changed'))
  }

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Back link */}
      <Link
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--color-subtext-0)',
          textDecoration: 'none',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Car size={22} style={{ color: 'var(--color-blue)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Vehicle Settings</h1>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          Default Dashboard Vehicle
        </h2>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Choose which vehicle's data appears on the dashboard by default.
        </p>

        {loading ? (
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>Loading vehicles...</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {/* All Fleet option */}
            <VehicleOption
              label="All Fleet"
              description="Show combined data from all vehicles"
              selected={selectedId === 'all'}
              onClick={() => handleSelect('all')}
            />

            {/* Individual vehicles */}
            {vehicleList.map(v => (
              <VehicleOption
                key={v.id}
                label={`${v.year} ${v.make} ${v.model}`}
                description={v.is_primary ? 'Primary vehicle' : null}
                isPrimary={v.is_primary}
                selected={selectedId === String(v.id)}
                onClick={() => handleSelect(String(v.id))}
              />
            ))}

            {vehicleList.length === 0 && (
              <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
                No vehicles found. Add a vehicle first from the <Link to="/vehicles" style={{ color: 'var(--color-blue)' }}>Vehicles</Link> page.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


/**
 * Selectable vehicle option row.
 */
function VehicleOption({ label, description, isPrimary, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.875rem 1rem',
        background: selected ? 'rgba(137, 180, 250, 0.08)' : 'var(--color-surface-0)',
        border: selected ? '2px solid var(--color-blue)' : '2px solid transparent',
        borderRadius: '8px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'all 0.15s ease',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.background = 'var(--color-surface-1)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.background = 'var(--color-surface-0)'
      }}
    >
      {/* Selection indicator */}
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: selected ? 'none' : '2px solid var(--color-surface-2)',
        background: selected ? 'var(--color-blue)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {selected && <Check size={12} style={{ color: 'var(--color-crust)' }} />}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontWeight: selected ? 600 : 500,
          fontSize: '0.9rem',
          color: selected ? 'var(--color-blue)' : 'var(--color-text)',
        }}>
          {isPrimary && <Star size={13} fill="var(--color-yellow)" style={{ color: 'var(--color-yellow)' }} />}
          {label}
        </div>
        {description && (
          <div style={{ fontSize: '0.78rem', color: 'var(--color-subtext-0)', marginTop: '2px' }}>
            {description}
          </div>
        )}
      </div>
    </button>
  )
}
