/**
 * SpatialDeviceList - UWB device proximity list.
 *
 * Displays nearby UWB-detected devices with distance-based
 * color coding and signal strength indicator bar.
 *
 * Props:
 *   devices   - Array of { id, name, distance_m, signal_strength, last_seen, device_type }
 *   loading   - Whether data is loading
 */
import { Radio } from 'lucide-react'

/** Distance color thresholds */
function getDistanceColor(meters) {
  if (meters == null) return 'var(--color-subtext-0)'
  if (meters <= 1) return 'var(--color-green)'
  if (meters <= 5) return 'var(--color-blue)'
  if (meters <= 15) return 'var(--color-yellow)'
  return 'var(--color-red)'
}

export default function SpatialDeviceList({ devices = [], loading = false }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{
            height: '60px',
            background: 'var(--color-surface-0)',
            borderRadius: '8px',
            opacity: 0.3,
          }} />
        ))}
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '2rem',
        color: 'var(--color-subtext-0)',
      }}>
        <Radio size={28} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.85rem' }}>No UWB devices detected.</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)' }}>
          Devices will appear when your Apple Watch detects nearby UWB-enabled accessories.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {devices.map(device => {
        const distColor = getDistanceColor(device.distance_m)
        const signalPercent = device.signal_strength != null
          ? Math.max(0, Math.min(100, device.signal_strength))
          : 0

        return (
          <div key={device.id} className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.5rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Radio size={16} style={{ color: distColor }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {device.name || 'Unknown Device'}
                  </div>
                  {device.device_type && (
                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-subtext-0)',
                      textTransform: 'capitalize',
                    }}>
                      {device.device_type}
                    </div>
                  )}
                </div>
              </div>

              {/* Distance display */}
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  color: distColor,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {device.distance_m != null ? `${device.distance_m.toFixed(1)}m` : '\u2014'}
                </div>
                {device.last_seen && (
                  <div style={{
                    fontSize: '0.65rem',
                    color: 'var(--color-overlay-0)',
                  }}>
                    {formatRelative(device.last_seen)}
                  </div>
                )}
              </div>
            </div>

            {/* Signal strength bar */}
            <div style={{
              width: '100%',
              height: '4px',
              background: 'var(--color-surface-0)',
              borderRadius: '2px',
            }}>
              <div style={{
                width: `${signalPercent}%`,
                height: '100%',
                background: distColor,
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatRelative(ts) {
  if (!ts) return ''
  const diffMs = Date.now() - new Date(ts).getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 10) return 'Now'
  if (diffSec < 60) return `${diffSec}s ago`
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  return `${Math.floor(diffSec / 3600)}h ago`
}
