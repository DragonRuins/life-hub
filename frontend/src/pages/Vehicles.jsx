/**
 * Vehicles Page
 *
 * Shows a list of your vehicles as cards.
 * Click a vehicle to see its detail page with maintenance logs.
 * Includes a form to add new vehicles.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Car, ChevronRight, X, Star } from 'lucide-react'
import { vehicles } from '../api/client'

export default function Vehicles() {
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Vehicles</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Track your vehicles and maintenance history
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'Add Vehicle'}
        </button>
      </div>

      {/* Add Vehicle Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <VehicleForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Vehicle List */}
      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
      ) : vehicleList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Car size={40} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)' }}>No vehicles yet. Add your first one!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {vehicleList.map((v) => (
            <Link
              key={v.id}
              to={`/vehicles/${v.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="card" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                cursor: 'pointer',
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '10px',
                  background: 'rgba(137, 180, 250, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Car size={22} style={{ color: 'var(--color-blue)' }} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                    {v.year} {v.make} {v.model}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'flex', gap: '1rem', marginTop: '0.125rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-overlay-0)' }}>ID: {v.id}</span>
                    {v.trim && <span>{v.trim}</span>}
                    {v.current_mileage && <span>{v.current_mileage.toLocaleString()} mi</span>}
                    <span>{v.maintenance_count} service record{v.maintenance_count !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <button
                  onClick={(e) => handleSetPrimary(e, v.id)}
                  title={v.is_primary ? 'Primary vehicle' : 'Set as primary'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: v.is_primary ? 'var(--color-yellow)' : 'var(--color-overlay-0)',
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (!v.is_primary) e.currentTarget.style.color = 'var(--color-yellow)' }}
                  onMouseLeave={e => { if (!v.is_primary) e.currentTarget.style.color = 'var(--color-overlay-0)' }}
                >
                  <Star size={18} fill={v.is_primary ? 'var(--color-yellow)' : 'none'} />
                </button>

                <ChevronRight size={18} style={{ color: 'var(--color-overlay-0)' }} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}


/**
 * Form component for adding a new vehicle.
 */
function VehicleForm({ onSubmit, onCancel }) {
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
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Add New Vehicle</h3>

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
        <button type="submit" className="btn btn-primary">Add Vehicle</button>
      </div>
    </form>
  )
}
