/**
 * LCARSDataImport.jsx - Fuelly CSV Import Page (LCARS Theme)
 *
 * LCARS-styled import interface for maintenance logs and fuel logs
 * from Fuelly CSV exports. Uses LCARSPanel, Antonio font, pill buttons.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload, Loader2 } from 'lucide-react'
import { vehicles as vehiclesApi } from '../../../api/client'
import LCARSPanel from '../LCARSPanel'

const antonio = "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif"

export default function LCARSDataImport() {
  const [vehicleList, setVehicleList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    vehiclesApi.list()
      .then(setVehicleList)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Back link */}
      <Link
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--lcars-ice)',
          textDecoration: 'none',
          fontFamily: antonio,
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      <LCARSPanel title="Data Import" color="var(--lcars-tanoi)">
        <p style={{
          fontFamily: antonio,
          fontSize: '0.85rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '1rem',
        }}>
          Import CSV exports from Fuelly. Duplicates auto-detected.
        </p>

        {loading ? (
          <p style={{
            fontFamily: antonio,
            fontSize: '0.8rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
          }}>
            Loading vehicle registry...
          </p>
        ) : vehicleList.length === 0 ? (
          <p style={{
            fontFamily: antonio,
            fontSize: '0.8rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
          }}>
            No vessels registered. Add a vehicle from the{' '}
            <Link to="/vehicles" style={{ color: 'var(--lcars-ice)' }}>Vehicles</Link> page.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <LCARSImportSection
              title="Maintenance Logs"
              subtitle="Services.csv"
              color="var(--lcars-butterscotch)"
              endpoint="/api/import/maintenance"
              vehicles={vehicleList}
            />

            {/* Divider */}
            <div style={{
              height: '2px',
              background: 'var(--lcars-gray)',
              opacity: 0.3,
              borderRadius: '1px',
            }} />

            <LCARSImportSection
              title="Fuel Logs"
              subtitle="Fuelups.csv"
              color="var(--lcars-ice)"
              endpoint="/api/import/fuel"
              vehicles={vehicleList}
            />
          </div>
        )}
      </LCARSPanel>
    </div>
  )
}


/**
 * Single import section with LCARS styling.
 */
function LCARSImportSection({ title, subtitle, color, endpoint, vehicles }) {
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
    <div>
      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '0.5rem',
        marginBottom: '0.75rem',
      }}>
        <span style={{
          fontFamily: antonio,
          fontSize: '1rem',
          fontWeight: 700,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          {title}
        </span>
        <span style={{
          fontFamily: antonio,
          fontSize: '0.75rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {subtitle}
        </span>
      </div>

      {/* Vehicle selector */}
      <div style={{ marginBottom: '0.625rem' }}>
        <label style={{
          display: 'block',
          fontFamily: antonio,
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--lcars-gray)',
          marginBottom: '0.25rem',
        }}>
          Target Vehicle
        </label>
        <select
          value={vehicleId}
          onChange={e => setVehicleId(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            background: '#000',
            border: `1px solid ${color}`,
            borderRadius: '4px',
            color: 'var(--lcars-space-white)',
            fontFamily: antonio,
            fontSize: '0.85rem',
            letterSpacing: '0.03em',
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
        <label style={{
          display: 'block',
          fontFamily: antonio,
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--lcars-gray)',
          marginBottom: '0.25rem',
        }}>
          CSV File
        </label>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          style={{
            width: '100%',
            padding: '0.5rem',
            background: '#000',
            border: '1px solid var(--lcars-gray)',
            borderRadius: '4px',
            color: 'var(--lcars-space-white)',
            fontFamily: antonio,
            fontSize: '0.8rem',
          }}
        />
      </div>

      {/* Import button (LCARS pill) */}
      <button
        onClick={handleImport}
        disabled={importing}
        style={{
          height: '32px',
          padding: '0 1rem',
          borderRadius: '16px',
          background: importing ? 'var(--lcars-gray)' : color,
          border: 'none',
          color: 'var(--lcars-text-on-color)',
          cursor: importing ? 'default' : 'pointer',
          fontFamily: antonio,
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          transition: 'filter 0.15s ease',
        }}
        onMouseEnter={e => { if (!importing) e.currentTarget.style.filter = 'brightness(1.2)' }}
        onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
      >
        {importing ? (
          <><Loader2 size={12} className="lcars-spin" /> Importing...</>
        ) : (
          <><Upload size={12} /> Import</>
        )}
      </button>

      {/* Results */}
      {result && (
        <div style={{
          marginTop: '0.75rem',
          padding: '0.625rem 0.75rem',
          borderLeft: `3px solid ${result.error ? 'var(--lcars-tomato)' : 'var(--lcars-ice)'}`,
          background: result.error ? 'rgba(255, 68, 68, 0.06)' : 'rgba(153, 204, 255, 0.06)',
        }}>
          {result.error ? (
            <div style={{
              fontFamily: antonio,
              fontSize: '0.8rem',
              color: 'var(--lcars-tomato)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Error: {result.error}
            </div>
          ) : (
            <div style={{
              fontFamily: antonio,
              fontSize: '0.8rem',
              color: 'var(--lcars-space-white)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              lineHeight: 1.6,
            }}>
              <span style={{ color: 'var(--lcars-ice)' }}>{result.imported}</span> imported
              {result.duplicates > 0 && (
                <> &middot; <span style={{ color: 'var(--lcars-butterscotch)' }}>{result.duplicates}</span> duplicates</>
              )}
              {result.skipped > 0 && (
                <> &middot; <span style={{ color: 'var(--lcars-gray)' }}>{result.skipped}</span> skipped</>
              )}
              {result.errors?.length > 0 && (
                <div style={{ marginTop: '0.375rem', color: 'var(--lcars-butterscotch)', fontSize: '0.75rem' }}>
                  {result.errors.map((e, i) => <div key={i}>{e}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .lcars-spin {
          animation: lcars-spin-anim 1s linear infinite;
        }
        @keyframes lcars-spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
