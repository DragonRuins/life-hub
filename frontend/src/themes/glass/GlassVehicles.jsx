/**
 * GlassVehicles.jsx - Glass Theme Vehicle List
 *
 * Vehicle list using GlassPanel cards with add vehicle form.
 * Glass-styled vehicle cards with key stats.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Car, ChevronRight, X, Star } from 'lucide-react'
import { vehicles } from '../../api/client'
import GlassPanel from './GlassPanel'
import GlassModal from './GlassModal'
import GlassIcon from './GlassIcon'

export default function GlassVehicles() {
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
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.92)' }}>
            Vehicles
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Track your vehicles and maintenance history
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} />
          Add Vehicle
        </button>
      </div>

      {/* Vehicle Cards */}
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.40)', padding: '2rem', textAlign: 'center' }}>Loading...</div>
      ) : vehicleList.length === 0 ? (
        <GlassPanel>
          <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255,255,255,0.45)' }}>
            <Car size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
            <p>No vehicles yet. Add your first vehicle to get started.</p>
          </div>
        </GlassPanel>
      ) : (
        <div className="glass-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {vehicleList.map(v => (
            <Link
              key={v.id}
              to={`/vehicles/${v.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <GlassPanel animate={false} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <GlassIcon icon={Car} color="#0A84FF" size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 600 }}>
                        {v.year} {v.make} {v.model}
                      </span>
                      {v.is_primary && (
                        <Star size={14} fill="#FFD60A" style={{ color: '#FFD60A' }} />
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginTop: '2px' }}>
                      {v.current_mileage?.toLocaleString() || '—'} mi
                      {v.nickname ? ` · ${v.nickname}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {!v.is_primary && (
                      <button
                        onClick={(e) => handleSetPrimary(e, v.id)}
                        title="Set as primary"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          padding: '4px 8px',
                          color: 'rgba(255,255,255,0.40)',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(255,214,10,0.1)'
                          e.currentTarget.style.color = '#FFD60A'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                          e.currentTarget.style.color = 'rgba(255,255,255,0.40)'
                        }}
                      >
                        <Star size={12} />
                      </button>
                    )}
                    <ChevronRight size={18} style={{ color: 'rgba(255,255,255,0.20)' }} />
                  </div>
                </div>
              </GlassPanel>
            </Link>
          ))}
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showForm && (
        <GlassModal title="Add Vehicle" onClose={() => setShowForm(false)}>
          <AddVehicleForm onSubmit={handleAdd} onCancel={() => setShowForm(false)} />
        </GlassModal>
      )}
    </div>
  )
}

/** Simple add vehicle form */
function AddVehicleForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    year: '', make: '', model: '', nickname: '', vin: '', current_mileage: '',
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.year || !form.make || !form.model) {
      alert('Year, make, and model are required')
      return
    }
    onSubmit({
      ...form,
      year: parseInt(form.year),
      current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Year *</label>
          <input type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} required />
        </div>
        <div>
          <label>Make *</label>
          <input value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} required />
        </div>
        <div>
          <label>Model *</label>
          <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} required />
        </div>
        <div>
          <label>Nickname</label>
          <input value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} />
        </div>
        <div>
          <label>VIN</label>
          <input value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value })} />
        </div>
        <div>
          <label>Current Mileage</label>
          <input type="number" value={form.current_mileage} onChange={e => setForm({ ...form, current_mileage: e.target.value })} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Add Vehicle</button>
      </div>
    </form>
  )
}
