/**
 * WatchSpatial - UWB spatial proximity view (Catppuccin theme).
 *
 * Simple page showing detected UWB devices with distance
 * and signal strength indicators.
 *
 * Route: /watch/spatial
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Radio } from 'lucide-react'
import { watchHealth } from '../api/watchApi'
import SpatialDeviceList from '../components/watch/SpatialDeviceList'

export default function WatchSpatial() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        const result = await watchHealth.query({ type: 'spatial' })
        const entries = Array.isArray(result) ? result : result.devices || result.data || []
        setDevices(entries)
      } catch (err) {
        console.error('Failed to load spatial data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/watch"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem',
            marginBottom: '0.5rem',
          }}
        >
          <ChevronLeft size={16} />
          Watch Data
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={22} style={{ color: 'var(--color-mauve)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Spatial Data
          </h1>
        </div>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          UWB device proximity tracking from Apple Watch
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '3px solid var(--color-red)' }}>
          <p style={{ color: 'var(--color-red)', fontSize: '0.85rem' }}>Failed to load spatial data: {error}</p>
        </div>
      )}

      <SpatialDeviceList devices={devices} loading={loading} />
    </div>
  )
}
