/**
 * ComponentForm - Add or edit a vehicle component.
 * Dynamically shows relevant fields based on component type.
 */
import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { vehicles } from '../api/client'
import { COMPONENT_TYPES, getComponentType } from '../constants/componentTypes'

export default function ComponentForm({ vehicleId, component, onSubmit, onCancel }) {
  const isEditing = !!component
  const typeConfig = getComponentType(component?.component_type || 'tire')

  const [form, setForm] = useState({
    component_type: component?.component_type || 'tire',
    position: component?.position || '',
    brand: component?.brand || '',
    model: component?.model || '',
    part_number: component?.part_number || '',
    install_date: component?.install_date || new Date().toISOString().split('T')[0],
    install_mileage: component?.install_mileage || '',
    remove_date: component?.remove_date || '',
    remove_mileage: component?.remove_mileage || '',
    is_active: component?.is_active !== undefined ? component?.is_active : true,
    purchase_date: component?.purchase_date || '',
    purchase_price: component?.purchase_price || '',
    warranty_info: component?.warranty_info || '',
    notes: component?.notes || '',
  })

  const [suggestedPositions, setSuggestedPositions] = useState([])

  // Update position suggestions when type changes
  useEffect(() => {
    const newConfig = getComponentType(form.component_type)
    setSuggestedPositions(newConfig.suggestedPositions)
  }, [form.component_type])

  function handleChange(e) {
    const { name, value, type } = e.target
    setForm({
      ...form,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const payload = {
      ...form,
      install_mileage: form.install_mileage ? parseInt(form.install_mileage) : null,
      remove_mileage: form.remove_mileage ? parseInt(form.remove_mileage) : null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
    }

    // Remove empty strings
    Object.keys(payload).forEach(key => {
      if (payload[key] === '') {
        if (key !== 'component_type' && key !== 'position') {
          payload[key] = null
        }
      }
    })

    try {
      if (isEditing) {
        await vehicles.components.update(component.id, payload)
      } else {
        await vehicles.components.create(vehicleId, payload)
      }
      onSubmit()
    } catch (err) {
      alert('Failed to save component: ' + err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        {isEditing ? 'Edit Component' : 'Add Component'}
      </h3>

      {/* Component Type & Position */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Component Type</label>
          <select name="component_type" value={form.component_type} onChange={handleChange}>
            {COMPONENT_TYPES.map(t => (
              <option key={t.value} value={t.value}>
                {t.icon} {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Position</label>
          {suggestedPositions.length > 0 ? (
            <select
              name="position"
              value={form.position}
              onChange={handleChange}
            >
              <option value="">Select position...</option>
              {suggestedPositions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="__custom">Custom...</option>
            </select>
          ) : (
            <input
              name="position"
              placeholder="e.g., Engine Bay"
              value={form.position}
              onChange={handleChange}
            />
          )}
        </div>
      </div>

      {/* Custom position input if needed */}
      {suggestedPositions.length > 0 && form.position === '__custom' && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Custom Position</label>
          <input
            name="position"
            placeholder="Enter custom position"
            value={form.position === '__custom' ? '' : form.position}
            onChange={(e) => setForm({ ...form, position: e.target.value })}
          />
        </div>
      )}

      {/* Product Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Brand</label>
          <input name="brand" placeholder="Michelin" value={form.brand} onChange={handleChange} />
        </div>
        <div>
          <label>Model</label>
          <input name="model" placeholder="Defender T/A" value={form.model} onChange={handleChange} />
        </div>
        <div>
          <label>Part Number</label>
          <input name="part_number" placeholder="Optional" value={form.part_number} onChange={handleChange} />
        </div>
      </div>

      {/* Installation Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Install Date</label>
          <input name="install_date" type="date" value={form.install_date} onChange={handleChange} />
        </div>
        <div>
          <label>Install Mileage</label>
          <input name="install_mileage" type="number" placeholder="45000" value={form.install_mileage} onChange={handleChange} />
        </div>
      </div>

      {/* Removal Info (shown when editing) */}
      {isEditing && (
        <details style={{ marginBottom: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
            Removal Info (for archiving)
          </summary>
          <div style={{ marginTop: '0.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label>Remove Date</label>
              <input name="remove_date" type="date" value={form.remove_date} onChange={handleChange} />
            </div>
            <div>
              <label>Remove Mileage</label>
              <input name="remove_mileage" type="number" placeholder="50000" value={form.remove_mileage} onChange={handleChange} />
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Currently installed on vehicle
            </label>
          </div>
        </details>
      )}

      {/* Purchase & Warranty */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Purchase Date</label>
          <input name="purchase_date" type="date" value={form.purchase_date} onChange={handleChange} />
        </div>
        <div>
          <label>Purchase Price ($)</label>
          <input name="purchase_price" type="number" step="0.01" placeholder="250.00" value={form.purchase_price} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Warranty Info</label>
        <textarea name="warranty_info" rows={2} placeholder="e.g., 60 month warranty, expires 2030-01-01" value={form.warranty_info} onChange={handleChange} />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label>Notes</label>
        <textarea name="notes" rows={2} placeholder="Any additional notes..." value={form.notes} onChange={handleChange} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {isEditing ? 'Save Changes' : 'Add Component'}
        </button>
      </div>
    </form>
  )
}
