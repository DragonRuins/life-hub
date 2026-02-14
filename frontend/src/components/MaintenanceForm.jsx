/**
 * MaintenanceForm - Add a service/maintenance record.
 *
 * Reusable component that can work with or without a pre-selected vehicle.
 * When vehicles array is provided, shows a vehicle selector dropdown.
 */
import { useState } from 'react'

export default function MaintenanceForm({ onSubmit, onCancel, vehicles, vehicleId: preselectedVehicleId }) {
  const [form, setForm] = useState({
    vehicle_id: preselectedVehicleId || '',
    service_type: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    mileage: '',
    cost: '',
    shop_name: '',
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      mileage: form.mileage ? parseInt(form.mileage) : null,
      cost: form.cost ? parseFloat(form.cost) : 0,
    })
  }

  const showVehicleSelector = vehicles && vehicles.length > 0 && !preselectedVehicleId

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        Add Service Record
      </h3>

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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Service Type *</label>
          <input name="service_type" placeholder="Oil Change" value={form.service_type} onChange={handleChange} required />
        </div>
        <div>
          <label>Date *</label>
          <input name="date" type="date" value={form.date} onChange={handleChange} required />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Mileage</label>
          <input name="mileage" type="number" placeholder="45000" value={form.mileage} onChange={handleChange} />
        </div>
        <div>
          <label>Cost ($)</label>
          <input name="cost" type="number" step="0.01" placeholder="65.99" value={form.cost} onChange={handleChange} />
        </div>
        <div>
          <label>Shop / Location</label>
          <input name="shop_name" placeholder="Valvoline" value={form.shop_name} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label>Description</label>
        <textarea name="description" rows={2} placeholder="Full synthetic 5W-30, replaced filter..." value={form.description} onChange={handleChange} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Add Record</button>
      </div>
    </form>
  )
}
