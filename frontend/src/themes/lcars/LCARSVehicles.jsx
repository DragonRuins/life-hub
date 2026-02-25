/**
 * LCARSVehicles.jsx - LCARS-native Vehicles List Page
 *
 * Replaces the default Vehicles page when LCARS theme is active.
 * Each vehicle renders as a sensor-readout row inside an LCARSPanel
 * with data fields in monospace and LCARS accent colors.
 *
 * Route: /vehicles
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Car, ChevronRight, X, Wrench, Gauge, Fuel, Star } from 'lucide-react'
import { vehicles } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

export default function LCARSVehicles() {
  const [vehicleList, setVehicleList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  async function loadVehicles() {
    try {
      const data = await vehicles.list()
      setVehicleList(data)
    } catch (err) {
      console.error('Failed to load vehicles:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadVehicles() }, [])

  async function handleAdd(formData) {
    try {
      await vehicles.create(formData)
      await loadVehicles()
      setShowForm(false)
    } catch (err) {
      alert('Failed to add vehicle: ' + err.message)
    }
  }

  async function handleSetPrimary(e, vehicleId) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await vehicles.setPrimary(vehicleId)
      await loadVehicles()
    } catch (err) {
      console.error('Failed to set primary vehicle:', err)
    }
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '1.5rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--lcars-space-white)',
          }}>
            Fleet Registry
          </h1>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: 'var(--lcars-ice)',
            marginTop: '0.25rem',
          }}>
            {vehicleList.length} vehicle{vehicleList.length !== 1 ? 's' : ''} registered
          </div>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Register Vehicle'}
        </button>
      </div>

      {/* Add Vehicle Form */}
      {showForm && (
        <LCARSPanel
          title="New Vehicle Registration"
          color="var(--lcars-butterscotch)"
          style={{ marginBottom: '1.5rem' }}
        >
          <LCARSVehicleForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
        </LCARSPanel>
      )}

      {/* Vehicle List */}
      {loading ? (
        <LCARSLoadingSkeleton />
      ) : vehicleList.length === 0 ? (
        <LCARSPanel title="No Data" color="var(--lcars-gray)">
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Car size={32} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem',
              color: 'var(--lcars-gray)',
            }}>
              No vehicles in fleet registry
            </div>
          </div>
        </LCARSPanel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {vehicleList.map((v) => (
            <LCARSVehicleCard key={v.id} vehicle={v} onSetPrimary={handleSetPrimary} />
          ))}
        </div>
      )}
    </div>
  )
}


/**
 * Single vehicle card — LCARS data readout style.
 * Left accent bar colored by vehicle index position,
 * monospace data fields, chevron link indicator.
 */
function LCARSVehicleCard({ vehicle: v, onSetPrimary }) {
  // Cycle accent colors per vehicle for visual variety
  const accentColors = [
    'var(--lcars-ice)',
    'var(--lcars-sunflower)',
    'var(--lcars-african-violet)',
    'var(--lcars-butterscotch)',
    'var(--lcars-almond-creme)',
  ]
  const accent = accentColors[v.id % accentColors.length]

  return (
    <Link
      to={`/vehicles/${v.id}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        style={{
          display: 'flex',
          background: '#000000',
          border: '1px solid rgba(102, 102, 136, 0.3)',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'border-color 0.15s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = accent
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'rgba(102, 102, 136, 0.3)'
        }}
      >
        {/* Left accent bar */}
        <div style={{
          width: '6px',
          background: accent,
          flexShrink: 0,
        }} />

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Title row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.625rem 1rem',
            background: accent,
            gap: '0.75rem',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              minWidth: 0,
            }}>
              <Car size={16} style={{ color: 'var(--lcars-text-on-color)', flexShrink: 0 }} />
              <span style={{
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--lcars-text-on-color)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {v.year} {v.make} {v.model}
              </span>
              {v.trim && (
                <span style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.75rem',
                  color: 'rgba(0, 0, 0, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  whiteSpace: 'nowrap',
                }}>
                  // {v.trim}
                </span>
              )}
            </div>
            <button
              onClick={(e) => onSetPrimary(e, v.id)}
              title={v.is_primary ? 'Primary vehicle' : 'Set as primary'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px',
                color: v.is_primary ? 'var(--lcars-butterscotch)' : 'rgba(0, 0, 0, 0.4)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { if (!v.is_primary) e.currentTarget.style.color = 'var(--lcars-butterscotch)' }}
              onMouseLeave={e => { if (!v.is_primary) e.currentTarget.style.color = v.is_primary ? 'var(--lcars-butterscotch)' : 'rgba(0, 0, 0, 0.4)' }}
            >
              <Star size={16} fill={v.is_primary ? 'var(--lcars-butterscotch)' : 'none'} />
            </button>
            <ChevronRight size={16} style={{ color: 'var(--lcars-text-on-color)', flexShrink: 0 }} />
          </div>

          {/* Data fields row */}
          <div style={{
            display: 'flex',
            gap: '1.5rem',
            padding: '0.5rem 1rem',
            flexWrap: 'wrap',
          }}>
            <DataField label="ID" value={String(v.id).padStart(3, '0')} />
            {v.current_mileage && (
              <DataField
                label="Odometer"
                value={`${v.current_mileage.toLocaleString()} mi`}
                icon={<Gauge size={11} />}
              />
            )}
            <DataField
              label="Service Logs"
              value={v.maintenance_count}
              icon={<Wrench size={11} />}
            />
            {v.fuel_log_count != null && (
              <DataField
                label="Fuel Logs"
                value={v.fuel_log_count}
                icon={<Fuel size={11} />}
              />
            )}
            {v.license_plate && (
              <DataField label="Plate" value={v.license_plate} />
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}


/**
 * Small label + value data field used inside vehicle cards.
 */
function DataField({ label, value, icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      {icon && (
        <span style={{ color: 'var(--lcars-gray)', display: 'flex' }}>{icon}</span>
      )}
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.68rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--lcars-gray)',
      }}>
        {label}:
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--lcars-space-white)',
      }}>
        {value}
      </span>
    </div>
  )
}


/**
 * LCARS-styled vehicle form inside a panel.
 * Same fields as the default VehicleForm but with LCARS aesthetics
 * applied via CSS overrides (labels, inputs already styled by lcars-components.css).
 */
function LCARSVehicleForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    year: '',
    make: '',
    model: '',
    trim: '',
    color: '',
    vin: '',
    license_plate: '',
    current_mileage: '',
    notes: '',
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      year: parseInt(form.year),
      current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Year *</label>
          <input name="year" type="number" placeholder="2021" value={form.year} onChange={handleChange} required />
        </div>
        <div>
          <label>Make *</label>
          <input name="make" placeholder="Ram" value={form.make} onChange={handleChange} required />
        </div>
        <div>
          <label>Model *</label>
          <input name="model" placeholder="1500" value={form.model} onChange={handleChange} required />
        </div>
      </div>

      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Trim</label>
          <input name="trim" placeholder="Night Edition" value={form.trim} onChange={handleChange} />
        </div>
        <div>
          <label>Color</label>
          <input name="color" placeholder="Black" value={form.color} onChange={handleChange} />
        </div>
        <div>
          <label>Current Mileage</label>
          <input name="current_mileage" type="number" placeholder="45000" value={form.current_mileage} onChange={handleChange} />
        </div>
      </div>

      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>VIN</label>
          <input name="vin" placeholder="1C6SRFFT..." maxLength={17} value={form.vin} onChange={handleChange} />
        </div>
        <div>
          <label>License Plate</label>
          <input name="license_plate" placeholder="ABC 1234" value={form.license_plate} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label>Notes</label>
        <textarea name="notes" rows={2} placeholder="Any additional notes..." value={form.notes} onChange={handleChange} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Register</button>
      </div>
    </form>
  )
}


function LCARSLoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          height: '88px',
          background: 'rgba(102, 102, 136, 0.06)',
          border: '1px solid rgba(102, 102, 136, 0.15)',
        }} />
      ))}
    </div>
  )
}
