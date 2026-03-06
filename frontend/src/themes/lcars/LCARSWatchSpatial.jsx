/**
 * LCARSWatchSpatial - UWB spatial proximity (LCARS theme).
 *
 * LCARS display of nearby UWB devices with distance readouts
 * using LCARSDataRow and LCARSGauge components.
 *
 * Route: /watch/spatial
 */
import { useState, useEffect } from 'react'
import { Radio } from 'lucide-react'
import LCARSPanel, { LCARSDataRow, LCARSGauge } from './LCARSPanel'

export default function LCARSWatchSpatial() {
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        const { watchHealth } = await import('../../api/watchApi')
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

  if (loading) {
    return (
      <LCARSPanel title="SPATIAL PROXIMITY ARRAY // SCANNING" color="var(--lcars-lilac)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            SCANNING UWB FREQUENCIES...
          </span>
        </div>
      </LCARSPanel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <LCARSPanel title="ARRAY ERROR" color="var(--lcars-red-alert)">
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-red-alert)' }}>
            {error}
          </p>
        </LCARSPanel>
      )}

      <LCARSPanel
        title="SPATIAL PROXIMITY ARRAY"
        color="var(--lcars-lilac)"
        headerRight={
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.65rem',
            color: 'var(--lcars-space-white)',
          }}>
            {devices.length} DEVICE{devices.length !== 1 ? 'S' : ''} DETECTED
          </span>
        }
      >
        {devices.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <Radio size={28} style={{ color: 'var(--lcars-gray)', marginBottom: '0.5rem', opacity: 0.5 }} />
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.85rem',
              color: 'var(--lcars-gray)',
              textTransform: 'uppercase',
            }}>
              NO UWB DEVICES IN RANGE
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {devices.map(device => {
              const distColor = getDistanceColor(device.distance_m)
              const signalPercent = device.signal_strength != null
                ? Math.max(0, Math.min(100, device.signal_strength))
                : 0

              return (
                <div key={device.id}>
                  <LCARSDataRow
                    label={device.name || 'UNKNOWN DEVICE'}
                    value={device.distance_m != null ? `${device.distance_m.toFixed(1)}M` : '\u2014'}
                    color={distColor}
                    icon={<Radio size={14} />}
                  />
                  <div style={{ paddingLeft: '1.5rem' }}>
                    <LCARSGauge
                      label="SIGNAL STRENGTH"
                      value={`${signalPercent}%`}
                      percent={signalPercent}
                      color={distColor}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </LCARSPanel>
    </div>
  )
}

function getDistanceColor(meters) {
  if (meters == null) return 'var(--lcars-gray)'
  if (meters <= 1) return 'var(--lcars-green)'
  if (meters <= 5) return 'var(--lcars-ice)'
  if (meters <= 15) return 'var(--lcars-sunflower)'
  return 'var(--lcars-red-alert)'
}
