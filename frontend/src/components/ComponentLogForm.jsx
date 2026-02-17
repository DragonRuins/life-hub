/**
 * ComponentLogForm - Add a service log for a specific component.
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import { vehicles } from '../api/client'
import { LOG_TYPES } from '../constants/componentTypes'

export default function ComponentLogForm({ componentId, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    log_type: 'rotation',
    description: '',
    date: new Date().toISOString().split('T')[0],
    mileage: '',
    cost: '',
    shop_name: '',
  })

  function handleChange(e) {
    const { name, value, type } = e.target
    setForm({
      ...form,
      [name]: type === 'number' ? (value === '' ? '' : parseFloat(value)) : value
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    try {
      await vehicles.components.addLog(componentId, {
        ...form,
        mileage: form.mileage ? parseInt(form.mileage) : null,
        cost: form.cost ? parseFloat(form.cost) : 0,
      })
      onSubmit()
    } catch (err) {
      alert('Failed to add log: ' + err.message)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        Add Service Log
      </h3>

      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Log Type</label>
          <select name="log_type" value={form.log_type} onChange={handleChange}>
            {LOG_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Date</label>
          <input name="date" type="date" value={form.date} onChange={handleChange} required />
        </div>
      </div>

      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Mileage</label>
          <input name="mileage" type="number" placeholder="46000" value={form.mileage} onChange={handleChange} />
        </div>
        <div>
          <label>Cost ($)</label>
          <input name="cost" type="number" step="0.01" placeholder="0.00" value={form.cost} onChange={handleChange} />
        </div>
        <div>
          <label>Shop</label>
          <input name="shop_name" placeholder="Optional" value={form.shop_name} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label>Description</label>
        <textarea name="description" rows={2} placeholder="What was done..." value={form.description} onChange={handleChange} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Add Log</button>
      </div>
    </form>
  )
}
