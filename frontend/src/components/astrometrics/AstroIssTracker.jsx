/**
 * AstroIssTracker.jsx - ISS Tracker Tab (Catppuccin Theme)
 *
 * Features:
 *   - Leaflet map with CartoDB Dark Matter tiles
 *   - ISS marker that updates every 10-15 seconds
 *   - Trail (Polyline) connecting last 20 positions in cyan
 *   - Crew manifest (side panel desktop, stacked below mobile)
 *   - Visible passes table
 *   - Polling pauses when tab is hidden
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { astrometrics as api } from '../../api/client'
import useIsMobile from '../../hooks/useIsMobile'
import { Satellite, Users, Eye } from 'lucide-react'

// Custom ISS marker icon
const issIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 24px; height: 24px; background: var(--color-blue, #89b4fa);
    border-radius: 50%; border: 2px solid #fff;
    box-shadow: 0 0 12px rgba(137, 180, 250, 0.6);
    display: flex; align-items: center; justify-content: center;
  "><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5">
    <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
  </svg></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

// Component to move map when ISS position changes
function MapUpdater({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom(), { animate: true, duration: 1 })
    }
  }, [position, map])
  return null
}

/**
 * Split an array of [lat, lng] points into segments at the antimeridian
 * (where longitude jumps across +/-180). Without this, Leaflet draws a
 * line across the entire map when the orbit wraps around.
 */
function splitAtAntimeridian(points) {
  const segments = []
  let current = []
  for (let i = 0; i < points.length; i++) {
    current.push(points[i])
    if (i > 0 && Math.abs(points[i][1] - points[i - 1][1]) > 180) {
      // Crossed the antimeridian — start a new segment
      segments.push(current.slice(0, -1))
      current = [points[i]]
    }
  }
  if (current.length > 1) segments.push(current)
  return segments
}

export default function AstroIssTracker() {
  const [position, setPosition] = useState(null)
  const [trail, setTrail] = useState([])
  const [groundTrack, setGroundTrack] = useState(null)
  const [crew, setCrew] = useState(null)
  const [passes, setPasses] = useState(null)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)
  const isMobile = useIsMobile()

  const loadPosition = useCallback(async () => {
    try {
      const result = await api.iss.position()
      const pos = result?.data?.iss_position
      if (pos) {
        const lat = parseFloat(pos.latitude)
        const lng = parseFloat(pos.longitude)
        setPosition([lat, lng])
        setTrail(prev => {
          const next = [...prev, [lat, lng]]
          return next.slice(-20) // Keep last 20 positions
        })
      }
    } catch (e) {
      // Silent fail for polling
    }
  }, [])

  const loadCrewAndPasses = useCallback(async () => {
    try {
      const [crewRes, passesRes, trackRes] = await Promise.allSettled([
        api.iss.crew(),
        api.iss.passes(),
        api.iss.groundtrack(),
      ])
      if (crewRes.status === 'fulfilled') setCrew(crewRes.value)
      if (passesRes.status === 'fulfilled') setPasses(passesRes.value)
      if (trackRes.status === 'fulfilled') {
        const points = trackRes.value?.data?.points
        if (points?.length > 1) setGroundTrack(splitAtAntimeridian(points))
      }
    } catch (e) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    loadPosition()
    loadCrewAndPasses()

    // Poll position every 10 seconds
    pollRef.current = setInterval(() => {
      if (!document.hidden) loadPosition()
    }, 10000)

    return () => clearInterval(pollRef.current)
  }, [loadPosition, loadCrewAndPasses])

  const crewData = crew || {}
  const passesData = passes?.data?.passes || []

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 320px',
      gap: '1rem',
    }}>
      {/* Map */}
      <div>
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: isMobile ? '300px' : '500px' }}>
          {position ? (
            <MapContainer
              center={position}
              zoom={3}
              style={{ height: '100%', width: '100%' }}
              zoomControl={!isMobile}
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapUpdater position={position} />
              <Marker position={position} icon={issIcon}>
                <Popup>
                  <div style={{ fontSize: '0.85rem' }}>
                    <strong>ISS</strong><br />
                    Lat: {position[0].toFixed(4)}<br />
                    Lng: {position[1].toFixed(4)}
                  </div>
                </Popup>
              </Marker>
              {/* Projected orbital path (full orbit) */}
              {groundTrack && groundTrack.map((segment, i) => (
                <Polyline
                  key={`orbit-${i}`}
                  positions={segment}
                  pathOptions={{ color: '#585b70', weight: 1.5, opacity: 0.5 }}
                />
              ))}
              {/* Recent position trail */}
              {trail.length > 1 && (
                <Polyline
                  positions={trail}
                  pathOptions={{ color: '#89b4fa', weight: 2, opacity: 0.6, dashArray: '5 5' }}
                />
              )}
            </MapContainer>
          ) : (
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-subtext-0)',
            }}>
              Loading map...
            </div>
          )}
        </div>

        {/* Position Info */}
        {position && (
          <div style={{
            display: 'flex', gap: '1rem', marginTop: '0.5rem',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem',
            color: 'var(--color-subtext-0)',
          }}>
            <span>Lat: {position[0].toFixed(4)}</span>
            <span>Lng: {position[1].toFixed(4)}</span>
            <span>Alt: ~408 km</span>
            <span>Speed: ~27,600 km/h</span>
          </div>
        )}

        {/* Passes Table */}
        {passesData.length > 0 && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Eye size={16} style={{ color: 'var(--color-teal)' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Visible Passes</h3>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--color-surface-1)', color: 'var(--color-subtext-0)' }}>Rise</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--color-surface-1)', color: 'var(--color-subtext-0)' }}>Peak</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--color-surface-1)', color: 'var(--color-subtext-0)' }}>Elev</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--color-surface-1)', color: 'var(--color-subtext-0)' }}>Dir</th>
                    <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid var(--color-surface-1)', color: 'var(--color-subtext-0)' }}>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {passesData.map((pass, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {pass.rise_time ? new Date(pass.rise_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        {pass.peak_time ? new Date(pass.peak_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{pass.peak_elevation ? pass.peak_elevation + '\u00B0' : '--'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{pass.rise_azimuth || '--'} {'\u2192'} {pass.set_azimuth || '--'}</td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>{pass.duration_seconds ? Math.round(pass.duration_seconds / 60) + ' min' : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {passes && passesData.length === 0 && passes.data?.message && (
          <div className="card" style={{ marginTop: '1rem', color: 'var(--color-subtext-0)' }}>
            {passes.data.message}
          </div>
        )}
      </div>

      {/* Crew Panel */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Users size={16} style={{ color: 'var(--color-teal)' }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Crew in Space</h3>
          <span style={{
            marginLeft: 'auto', fontWeight: 700, fontSize: '1.25rem',
            color: 'var(--color-teal)',
          }}>
            {crewData.total || 0}
          </span>
        </div>
        {crewData.grouped && Object.entries(crewData.grouped).map(([craft, names]) => (
          <div key={craft} style={{ marginBottom: '0.75rem' }}>
            <div style={{
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-blue)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              padding: '0.25rem 0', borderBottom: '1px solid var(--color-surface-0)',
              marginBottom: '0.375rem',
            }}>
              {craft}
            </div>
            {names.map(name => (
              <div key={name} style={{
                fontSize: '0.85rem', padding: '0.25rem 0',
                color: 'var(--color-text)',
              }}>
                {name}
              </div>
            ))}
          </div>
        ))}
        {loading && (
          <div style={{ color: 'var(--color-subtext-0)', fontSize: '0.8rem' }}>
            Loading crew data...
          </div>
        )}
      </div>
    </div>
  )
}
