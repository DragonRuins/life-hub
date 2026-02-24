/**
 * DataImport.jsx - Fuelly CSV Import Page (Catppuccin Theme)
 *
 * Import maintenance logs (services.csv) and fuel logs (fuelups.csv)
 * from Fuelly CSV exports. User selects target vehicle, uploads file,
 * and sees import results (imported, skipped, duplicates, errors).
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Database, Upload, Wrench, Fuel, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { vehicles as vehiclesApi } from '../../api/client'

export default function DataImport() {
  const [vehicleList, setVehicleList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    vehiclesApi.list()
      .then(setVehicleList)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Back link */}
      <Link
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--color-subtext-0)',
          textDecoration: 'none',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Database size={22} style={{ color: 'var(--color-green)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Data Import</h1>
      </div>

      <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
        Import CSV exports from Fuelly. Select a target vehicle, then upload the file.
        Duplicate records are automatically detected and skipped.
      </p>

      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>Loading vehicles...</p>
      ) : vehicleList.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
            No vehicles found. <Link to="/vehicles" style={{ color: 'var(--color-blue)' }}>Add a vehicle</Link> first.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <ImportCard
            title="Maintenance Logs"
            description="Import from Fuelly services.csv. Maps service types to friendly names. Skips notes."
            icon={Wrench}
            color="var(--color-peach)"
            endpoint="/api/import/maintenance"
            vehicles={vehicleList}
          />
          <ImportCard
            title="Fuel Logs"
            description="Import from Fuelly fuelups.csv. Handles missed and partial fill-ups."
            icon={Fuel}
            color="var(--color-green)"
            endpoint="/api/import/fuel"
            vehicles={vehicleList}
          />
        </div>
      )}
    </div>
  )
}


/**
 * Single import card with vehicle selector, file input, and result display.
 */
function ImportCard({ title, description, icon: Icon, color, endpoint, vehicles }) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || '')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const fileRef = useRef(null)

  async function handleImport() {
    const file = fileRef.current?.files?.[0]
    if (!file || !vehicleId) return

    setImporting(true)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('vehicle_id', vehicleId)

    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setResult({ error: data.error || 'Import failed' })
      } else {
        setResult(data)
      }
    } catch (err) {
      setResult({ error: err.message || 'Network error' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Icon size={18} style={{ color }} />
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>{title}</h2>
      </div>
      <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.82rem', marginBottom: '1rem' }}>
        {description}
      </p>

      {/* Vehicle selector */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--color-subtext-1)' }}>
          Target Vehicle
        </label>
        <select
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-1)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        >
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.year} {v.make} {v.model}
            </option>
          ))}
        </select>
      </div>

      {/* File input */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, marginBottom: '0.375rem', color: 'var(--color-subtext-1)' }}>
          CSV File
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{
            width: '100%',
            padding: '0.5rem',
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-1)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '0.82rem',
          }}
        />
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={importing}
        className="btn btn-primary"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          opacity: importing ? 0.7 : 1,
        }}
      >
        {importing ? (
          <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Importing...</>
        ) : (
          <><Upload size={14} /> Import</>
        )}
      </button>

      {/* Results */}
      {result && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: result.error
            ? 'rgba(243, 139, 168, 0.08)'
            : 'rgba(166, 227, 161, 0.08)',
          border: `1px solid ${result.error ? 'rgba(243, 139, 168, 0.2)' : 'rgba(166, 227, 161, 0.2)'}`,
        }}>
          {result.error ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-red)', fontSize: '0.85rem' }}>
              <AlertCircle size={14} />
              {result.error}
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-green)', marginBottom: '0.375rem' }}>
                <CheckCircle2 size={14} />
                Import complete
              </div>
              <div style={{ color: 'var(--color-text)', lineHeight: 1.6 }}>
                <strong>{result.imported}</strong> imported
                {result.duplicates > 0 && <>, <strong>{result.duplicates}</strong> duplicates skipped</>}
                {result.skipped > 0 && <>, <strong>{result.skipped}</strong> notes skipped</>}
              </div>
              {result.errors?.length > 0 && (
                <div style={{ marginTop: '0.375rem', color: 'var(--color-yellow)', fontSize: '0.8rem' }}>
                  {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
