/**
 * TireSetForm - Add or edit a tire set.
 *
 * Creates 8 components (4 tires + 4 rims) with shared set details.
 *
 * IMPORTANT: This form does NOT call the API directly. It passes the form data
 * to the parent via the onSubmit callback, and the parent (VehicleDetail) handles
 * the API call. This prevents double-submission bugs where both the form and
 * parent try to create the same resource.
 *
 * Pattern: Form → onSubmit(data) → Parent → API call → Reload data → Close modal
 */
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import Tooltip from './Tooltip'

const labelStyle = {
  display: 'flex',
  alignItems: 'center',
}

export default function TireSetForm({ vehicleId, vehicleMileage, tireSet, onSubmit, onCancel }) {
  const isEditing = !!tireSet

  const [form, setForm] = useState({
    name: tireSet?.name || '',
    tire_brand: tireSet?.tire_brand || '',
    tire_model: tireSet?.tire_model || '',
    rim_brand: tireSet?.rim_brand || '',
    rim_model: tireSet?.rim_model || '',
    install_date: tireSet?.install_date || new Date().toISOString().split('T')[0],
    install_mileage: tireSet?.install_mileage || vehicleMileage || '',
    accumulated_mileage: tireSet?.accumulated_mileage || '',
    purchase_date: tireSet?.purchase_date || '',
    purchase_price: tireSet?.purchase_price || '',
    notes: tireSet?.notes || '',
  })

  // Auto-fill install mileage from vehicle mileage when adding new set
  useEffect(() => {
    if (!isEditing && vehicleMileage && !form.install_mileage) {
      setForm(prev => ({ ...prev, install_mileage: vehicleMileage }))
    }
  }, [vehicleMileage, isEditing])

  function handleChange(e) {
    const { name, value, type } = e.target
    setForm({
      ...form,
      [name]: type === 'number' ? (value === '' ? '' : parseInt(value)) : value
    })
  }

  function handleSubmit(e) {
    e.preventDefault()

    // Don't send empty strings for optional fields
    const dataToSend = {}
    for (const [key, value] of Object.entries(form)) {
      if (value !== '' && value !== null && value !== undefined) {
        dataToSend[key] = value
      }
    }

    console.log('TireSetForm submitting:', { vehicleId, isEditing, dataToSend })
    onSubmit(dataToSend)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        {isEditing ? 'Edit Tire Set' : 'Add Tire Set'}
      </h3>

      {/* Set Name */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>
          Set Name *
          <Tooltip text="A nickname to help identify this set (e.g., 'Winter Set 2024')" />
        </label>
        <input name="name" placeholder="Winter Set 2024" value={form.name} onChange={handleChange} required />
      </div>

      {/* Tires */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-subtext-0)' }}>Tires (x4)</h4>
        <div className="form-grid-2col" style={{ marginBottom: '0.5rem' }}>
          <div>
            <label>Brand</label>
            <input name="tire_brand" placeholder="Bridgestone" value={form.tire_brand} onChange={handleChange} />
          </div>
          <div>
            <label>Model</label>
            <input name="tire_model" placeholder="Blizzak" value={form.tire_model} onChange={handleChange} />
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-1)', fontStyle: 'italic' }}>
          Front Left • Front Right • Rear Left • Rear Right
        </div>
      </div>

      {/* Rims */}
      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--color-subtext-0)' }}>Rims (x4)</h4>
        <div className="form-grid-2col" style={{ marginBottom: '0.5rem' }}>
          <div>
            <label>Brand</label>
            <input name="rim_brand" placeholder="Fuel" value={form.rim_brand} onChange={handleChange} />
          </div>
          <div>
            <label>Model</label>
            <input name="rim_model" placeholder="Trophy" value={form.rim_model} onChange={handleChange} />
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-1)', fontStyle: 'italic' }}>
          Front Left • Front Right • Rear Left • Rear Right
        </div>
      </div>

      {/* Install Info */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>
            Install Date
            <Tooltip text="When you put these tires on vehicle" />
          </label>
          <input name="install_date" type="date" value={form.install_date} onChange={handleChange} />
        </div>
        <div>
          <label style={labelStyle}>
            Install Mileage
            <Tooltip text="Vehicle odometer reading when installed - auto-fills from vehicle profile" />
          </label>
          <input name="install_mileage" type="number" placeholder={vehicleMileage || '45000'} value={form.install_mileage} onChange={handleChange} />
        </div>
      </div>

      {/* Miles on Set */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>
          Miles on Set
          <Tooltip text="Total miles driven on this tire set. Use this to enter an estimate for tires you've already been using. Leave blank for new tires (starts at 0)." />
        </label>
        <input name="accumulated_mileage" type="number" placeholder="0" value={form.accumulated_mileage} onChange={handleChange} />
      </div>

      {/* Vehicle mileage reference */}
      {vehicleMileage && (
        <div style={{
          padding: '0.5rem 0.75rem',
          background: 'var(--color-mantle)',
          borderRadius: '6px',
          marginBottom: '1rem',
          fontSize: '0.85rem',
          color: 'var(--color-subtext-0)',
        }}>
          Current vehicle mileage: <strong>{vehicleMileage.toLocaleString()}</strong> miles
        </div>
      )}

      {/* Purchase Info */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label style={labelStyle}>
            Purchase Date
            <Tooltip text="When you bought this tire set (for warranty tracking)" />
          </label>
          <input name="purchase_date" type="date" value={form.purchase_date} onChange={handleChange} />
        </div>
        <div>
          <label style={labelStyle}>
            Purchase Price ($)
            <Tooltip text="Total cost for complete set (tires + rims)" />
          </label>
          <input name="purchase_price" type="number" step="0.01" placeholder="1400.00" value={form.purchase_price} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label>Notes</label>
        <textarea name="notes" rows={2} placeholder="Walmart receipt #..." value={form.notes} onChange={handleChange} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {isEditing ? 'Save Changes' : 'Add Tire Set'}
        </button>
      </div>
    </form>
  )
}
