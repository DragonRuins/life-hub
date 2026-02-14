/**
 * FuelForm - Add or edit a fuel log.
 *
 * Tracks fill-ups with: date, odometer, gallons, cost per gallon, total cost
 * MPG is auto-calculated on the backend.
 */
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Tooltip from './Tooltip'

const labelStyle = {
  display: 'flex',
  alignItems: 'center',
}

export default function FuelForm({ vehicleId, vehicleMileage, fuelLog, onSubmit, onCancel, vehicles }) {
  const isEditing = !!fuelLog

  // Show vehicle selector when called from Dashboard (vehicles passed, no vehicleId)
  const showVehicleSelector = vehicles && vehicles.length > 0 && !vehicleId

  const [form, setForm] = useState({
    vehicle_id: vehicleId || '',
    date: fuelLog?.date || new Date().toISOString().split('T')[0],
    mileage: fuelLog?.mileage || vehicleMileage || '',
    gallons: '',
    price_per_gallon: '',
    total_cost: '',
    location: '',
    fuel_type: '',
    payment_method: '',
    notes: '',
    missed_previous: false,
  })

  // Auto-fill mileage from vehicle when adding new log
  useEffect(() => {
    if (!isEditing && vehicleMileage && !form.mileage) {
      setForm(prev => ({ ...prev, mileage: vehicleMileage }))
    }
  }, [vehicleMileage, isEditing])

  function handleChange(e) {
    const { name, value, type } = e.target
    setForm({
      ...form,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    })
  }

  function handleSubmit(e) {
    e.preventDefault()

    const dataToSend = {
      vehicle_id: form.vehicle_id || vehicleId,
      date: form.date,
      mileage: form.mileage ? parseInt(form.mileage) : null,
      gallons_added: form.gallons ? parseFloat(form.gallons) : null,
      cost_per_gallon: form.price_per_gallon ? parseFloat(form.price_per_gallon) : null,
      total_cost: form.total_cost ? parseFloat(form.total_cost) : null,
      location: form.location || null,
      fuel_type: form.fuel_type || null,
      payment_method: form.payment_method || null,
      notes: form.notes || null,
      missed_previous: form.missed_previous,
    }

    console.log('FuelForm submitting:', { vehicleId, isEditing, dataToSend })
    onSubmit(dataToSend)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        {isEditing ? 'Edit Fuel Log' : 'Add Fuel Log'}
      </h3>

      {/* Vehicle selector (only shown when called from Dashboard) */}
      {showVehicleSelector && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Vehicle *</label>
          <select
            name="vehicle_id"
            value={form.vehicle_id}
            onChange={handleChange}
            required
          >
            <option value="">Select a vehicle...</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model} {v.trim && `(${v.trim})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date & Mileage */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>
            Date *
            <Tooltip text="Date of fill-up" />
          </label>
          <input name="date" type="date" value={form.date} onChange={handleChange} required />
        </div>
        <div>
          <label style={labelStyle}>
            Odometer (mi) *
            <Tooltip text="Vehicle mileage at fill-up" />
          </label>
          <input name="mileage" type="number" placeholder="45000" value={form.mileage} onChange={handleChange} required />
          {vehicleMileage && (
            <small style={{ color: 'var(--color-subtext-1)' }}>
              Current: {vehicleMileage.toLocaleString()} mi
            </small>
          )}
        </div>
      </div>

      {/* Gallons & Price per Gallon */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>
            Gallons Added *
            <Tooltip text="Amount of fuel pumped" />
          </label>
          <input name="gallons" type="number" step="0.01" placeholder="15.5" value={form.gallons} onChange={handleChange} required />
        </div>
        <div>
          <label style={labelStyle}>
            Price per Gallon ($) *
            <Tooltip text="Cost per single gallon" />
          </label>
          <input name="price_per_gallon" type="number" step="0.001" placeholder="3.459" value={form.price_per_gallon} onChange={handleChange} required />
        </div>
      </div>

      {/* Total Cost (auto-calculated) */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>
          Total Cost ($) - leave blank to auto-calculate
          <Tooltip text="Calculated as gallons × price per gallon" />
        </label>
        <input name="total_cost" type="number" step="0.01" placeholder="Calculated from gallons × price" value={form.total_cost} onChange={handleChange} />
      </div>

      {/* Optional Fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Location</label>
          <input name="location" placeholder="Shell station on Main St" value={form.location} onChange={handleChange} />
        </div>
        <div>
          <label>Fuel Type</label>
          <select name="fuel_type" value={form.fuel_type} onChange={handleChange}>
            <option value="">Select...</option>
            <option value="regular">Regular (87)</option>
            <option value="midgrade">Mid-Grade (89)</option>
            <option value="premium">Premium (91-93)</option>
            <option value="diesel">Diesel</option>
            <option value="e85">E85</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Payment Method</label>
          <select name="payment_method" value={form.payment_method} onChange={handleChange}>
            <option value="">Select...</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit Card</option>
            <option value="debit">Debit Card</option>
            <option value="mobile">Mobile Pay</option>
          </select>
        </div>
        <div>
          <label>Notes</label>
        </div>
      </div>

      {/* Missed fill-up toggle */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={form.missed_previous}
            onChange={(e) => setForm({ ...form, missed_previous: e.target.checked })}
            style={{ width: '16px', height: '16px' }}
          />
          <span>Missed a fill-up before this one</span>
          <Tooltip text="Check this if you forgot to log a previous fill-up. MPG won't be calculated for this entry since the miles driven would be inaccurate." />
        </label>
      </div>

      <div style={{ marginBottom: '1rem', gridColumn: '1 / -1' }}>
        <textarea name="notes" rows={2} placeholder="Brand rewards card used..." value={form.notes} onChange={handleChange} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {isEditing ? 'Save Changes' : 'Add Fuel Log'}
        </button>
      </div>
    </form>
  )
}
