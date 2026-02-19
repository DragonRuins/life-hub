/**
 * LCARSVehicleSettings.jsx - Default Vehicle Selector (LCARS Theme)
 *
 * LCARS-styled vehicle selector for the dashboard default.
 * Stores selection in localStorage and dispatches event for live updates.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'
import { vehicles as vehiclesApi } from '../../../api/client'
import LCARSPanel from '../LCARSPanel'

export default function LCARSVehicleSettings() {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Back link */}
      <Link
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--lcars-ice)',
          textDecoration: 'none',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      <LCARSPanel title="Vehicle Configuration" color="var(--lcars-ice)">
        <p style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '0.85rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '1rem',
        }}>
          Select Default Dashboard Vehicle
        </p>

        {loading ? (
          <p style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.8rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
          }}>
            Loading vehicle registry...
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* All Fleet option */}
            <LCARSVehicleOption
              label="All Fleet"
              description="Combined fleet data"
              selected={selectedId === 'all'}
              onClick={() => handleSelect('all')}
            />

            {/* Individual vehicles */}
            {vehicleList.map(v => (
              <LCARSVehicleOption
                key={v.id}
                label={`${v.year} ${v.make} ${v.model}`}
                description={v.is_primary ? 'Primary vessel' : null}
                isPrimary={v.is_primary}
                selected={selectedId === String(v.id)}
                onClick={() => handleSelect(String(v.id))}
              />
            ))}

            {vehicleList.length === 0 && (
              <p style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.8rem',
                color: 'var(--lcars-gray)',
                textTransform: 'uppercase',
              }}>
                No vessels registered. Add a vehicle from the{' '}
                <Link to="/vehicles" style={{ color: 'var(--lcars-ice)' }}>Vehicles</Link> page.
              </p>
            )}
          </div>
        )}
      </LCARSPanel>
    </div>
  )
}


/**
 * LCARS-styled selectable vehicle row.
 */
function LCARSVehicleOption({ label, description, isPrimary, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.625rem 1rem',
        background: selected ? 'rgba(153, 204, 255, 0.12)' : 'rgba(102, 102, 136, 0.08)',
        border: selected ? '2px solid var(--lcars-ice)' : '2px solid rgba(102, 102, 136, 0.2)',
        borderRadius: '4px',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        transition: 'all 0.15s ease',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.borderColor = 'rgba(153, 204, 255, 0.4)'
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.borderColor = 'rgba(102, 102, 136, 0.2)'
      }}
    >
      {/* Selection indicator */}
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        border: selected ? 'none' : '2px solid var(--lcars-gray)',
        background: selected ? 'var(--lcars-ice)' : 'transparent',
        flexShrink: 0,
      }} />

      <div style={{ flex: 1 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.9rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: selected ? 'var(--lcars-ice)' : 'var(--lcars-space-white)',
        }}>
          {isPrimary && <Star size={12} fill="var(--lcars-butterscotch)" style={{ color: 'var(--lcars-butterscotch)' }} />}
          {label}
        </div>
        {description && (
          <div style={{
            fontSize: '0.7rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginTop: '2px',
          }}>
            {description}
          </div>
        )}
      </div>
    </button>
  )
}
