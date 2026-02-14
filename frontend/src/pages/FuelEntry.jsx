/**
 * Mobile Fuel Entry Page
 *
 * Standalone page for logging fuel fill-ups from a phone.
 * No sidebar — designed to be bookmarked directly.
 * Fields persist as you type so you can switch apps mid-fill.
 *
 * Route: /fuel/add/:id (not linked in the UI)
 * Bookmark: http://<server>:3000/fuel/add/2
 */
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Fuel, Check, AlertCircle } from 'lucide-react'
import { vehicles, fuel } from '../api/client'

// LocalStorage key prefix for persisting form data between app switches
const STORAGE_KEY = 'fuel-entry-draft'

export default function FuelEntry() {
  const { id } = useParams()
  const vehicleId = parseInt(id)

  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)   // { success, entry } or { error }
  const [error, setError] = useState(null)

  // Initialize form from localStorage (persists across app switches)
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}-${id}`)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {
      odometer: '',
      price_per_gallon: '',
      gallons: '',
      notes: '',
      missed_previous: false,
    }
  })

  // Save form to localStorage on every change
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}-${id}`, JSON.stringify(form))
  }, [form, id])

  // Load vehicle info
  useEffect(() => {
    async function load() {
      try {
        const v = await vehicles.get(vehicleId)
        setVehicle(v)
      } catch (err) {
        setError('Vehicle not found')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [vehicleId])

  function updateField(name, value) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)

    try {
      // Use the fuel blueprint's POST endpoint (which accepts the
      // shortcut-style field names and doesn't require date)
      const resp = await fetch('/api/fuel/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'send-fuel-logs-here',
        },
        body: JSON.stringify({
          vehicle_id: vehicleId,
          odometer: parseFloat(form.odometer),
          price_per_gallon: parseFloat(form.price_per_gallon),
          gallons: parseFloat(form.gallons),
          notes: form.notes || null,
          missed_previous: form.missed_previous,
        }),
      })

      const data = await resp.json()

      if (!resp.ok) {
        setResult({ error: data.error || 'Failed to submit' })
      } else {
        setResult({ success: true, entry: data.entry })
        // Clear saved draft on success
        localStorage.removeItem(`${STORAGE_KEY}-${id}`)
        setForm({ odometer: '', price_per_gallon: '', gallons: '', notes: '', missed_previous: false })
      }
    } catch (err) {
      setResult({ error: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  function clearDraft() {
    setForm({ odometer: '', price_per_gallon: '', gallons: '', notes: '', missed_previous: false })
    localStorage.removeItem(`${STORAGE_KEY}-${id}`)
    setResult(null)
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-subtext-0)' }}>
          Loading...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <AlertCircle size={32} style={{ color: 'var(--color-red)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-red)' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(166, 227, 161, 0.1)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '0.75rem',
          }}>
            <Fuel size={24} style={{ color: 'var(--color-green)' }} />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Log Fill-Up</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {vehicle.year} {vehicle.make} {vehicle.model}
            {vehicle.current_mileage && (
              <span> &middot; {vehicle.current_mileage.toLocaleString()} mi</span>
            )}
          </p>
        </div>

        {/* Success message */}
        {result?.success && (
          <div style={{
            padding: '1rem',
            borderRadius: '12px',
            background: 'rgba(166, 227, 161, 0.1)',
            border: '1px solid rgba(166, 227, 161, 0.3)',
            marginBottom: '1.5rem',
            textAlign: 'center',
          }}>
            <Check size={24} style={{ color: 'var(--color-green)', marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--color-green)' }}>
              Logged!
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.9rem' }}>
              {result.entry.mpg != null && (
                <div>
                  <div style={{ color: 'var(--color-subtext-0)', fontSize: '0.75rem' }}>MPG</div>
                  <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{result.entry.mpg}</div>
                </div>
              )}
              <div>
                <div style={{ color: 'var(--color-subtext-0)', fontSize: '0.75rem' }}>Total</div>
                <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>${result.entry.total_cost?.toFixed(2)}</div>
              </div>
            </div>
            <button
              onClick={clearDraft}
              style={submitBtnStyle}
            >
              Log Another
            </button>
          </div>
        )}

        {/* Error message */}
        {result?.error && (
          <div style={{
            padding: '0.75rem 1rem',
            borderRadius: '12px',
            background: 'rgba(243, 139, 168, 0.1)',
            border: '1px solid rgba(243, 139, 168, 0.3)',
            marginBottom: '1rem',
            color: 'var(--color-red)',
            fontSize: '0.85rem',
          }}>
            {result.error}
          </div>
        )}

        {/* Form */}
        {!result?.success && (
          <form onSubmit={handleSubmit}>
            {/* Odometer */}
            <div style={fieldStyle}>
              <label style={labelMobileStyle}>Odometer (mi)</label>
              <input
                type="number"
                inputMode="decimal"
                placeholder={vehicle.current_mileage ? String(vehicle.current_mileage) : '45000'}
                value={form.odometer}
                onChange={(e) => updateField('odometer', e.target.value)}
                required
                style={inputMobileStyle}
              />
              {vehicle.current_mileage && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-1)', marginTop: '0.25rem' }}>
                  Last: {vehicle.current_mileage.toLocaleString()} mi
                </div>
              )}
            </div>

            {/* Price per gallon */}
            <div style={fieldStyle}>
              <label style={labelMobileStyle}>Price per Gallon ($)</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.001"
                placeholder="3.459"
                value={form.price_per_gallon}
                onChange={(e) => updateField('price_per_gallon', e.target.value)}
                required
                style={inputMobileStyle}
              />
            </div>

            {/* Gallons */}
            <div style={fieldStyle}>
              <label style={labelMobileStyle}>Gallons</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="18.5"
                value={form.gallons}
                onChange={(e) => updateField('gallons', e.target.value)}
                required
                style={inputMobileStyle}
              />
              {/* Live cost preview */}
              {form.gallons && form.price_per_gallon && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginTop: '0.25rem' }}>
                  Est. total: ${(parseFloat(form.gallons) * parseFloat(form.price_per_gallon)).toFixed(2)}
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={fieldStyle}>
              <label style={labelMobileStyle}>Notes (optional)</label>
              <input
                type="text"
                placeholder="Station, brand, etc."
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                style={inputMobileStyle}
              />
            </div>

            {/* Missed fill-up toggle */}
            <div style={{ ...fieldStyle, marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                cursor: 'pointer', padding: '0.75rem', borderRadius: '12px',
                background: form.missed_previous ? 'rgba(250, 179, 135, 0.1)' : 'transparent',
                border: form.missed_previous ? '1px solid rgba(250, 179, 135, 0.3)' : '1px solid var(--color-surface-1)',
              }}>
                <input
                  type="checkbox"
                  checked={form.missed_previous}
                  onChange={(e) => updateField('missed_previous', e.target.checked)}
                  style={{ width: '20px', height: '20px' }}
                />
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Missed a fill-up</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                    Skip MPG calculation for this entry
                  </div>
                </div>
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !form.odometer || !form.price_per_gallon || !form.gallons}
              style={{
                ...submitBtnStyle,
                opacity: (submitting || !form.odometer || !form.price_per_gallon || !form.gallons) ? 0.5 : 1,
              }}
            >
              {submitting ? 'Saving...' : 'Log Fill-Up'}
            </button>

            {/* Clear draft link */}
            {(form.odometer || form.price_per_gallon || form.gallons || form.notes) && (
              <button
                type="button"
                onClick={clearDraft}
                style={{
                  display: 'block',
                  margin: '0.75rem auto 0',
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-subtext-0)',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Clear form
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────

const pageStyle = {
  minHeight: '100vh',
  background: 'var(--color-crust)',
  color: 'var(--color-text)',
  paddingTop: 'env(safe-area-inset-top)',
  paddingBottom: 'env(safe-area-inset-bottom)',
}

const fieldStyle = {
  marginBottom: '1rem',
}

const labelMobileStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--color-subtext-0)',
  marginBottom: '0.375rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const inputMobileStyle = {
  width: '100%',
  padding: '0.875rem 1rem',
  fontSize: '1.1rem',
  borderRadius: '12px',
  background: 'var(--color-base)',
  color: 'var(--color-text)',
  border: '1px solid var(--color-surface-1)',
  boxSizing: 'border-box',
}

const submitBtnStyle = {
  width: '100%',
  padding: '1rem',
  fontSize: '1rem',
  fontWeight: 600,
  borderRadius: '12px',
  background: 'var(--color-green)',
  color: 'var(--color-crust)',
  border: 'none',
  cursor: 'pointer',
  marginTop: '0.5rem',
}
