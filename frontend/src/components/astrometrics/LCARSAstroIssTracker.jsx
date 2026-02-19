/**
 * LCARSAstroIssTracker.jsx - Station Tracking (LCARS ISS Tracker)
 *
 * LCARS-styled ISS tracker with same features as Catppuccin version:
 * Leaflet map with dark tiles, ISS marker, trail, crew manifest, passes.
 * Uses green trail color and LCARS panels for data sections.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { astrometrics as api } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from '../../themes/lcars/LCARSPanel'
import useIsMobile from '../../hooks/useIsMobile'

// LCARS-styled ISS marker
const issIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 20px; height: 20px; background: #99CCFF;
    border-radius: 50%; border: 2px solid #FFCC99;
    box-shadow: 0 0 12px rgba(153, 204, 255, 0.6);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

function MapUpdater({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.setView(position, map.getZoom(), { animate: true, duration: 1 })
  }, [position, map])
  return null
}

/**
 * Split an array of [lat, lng] points into segments at the antimeridian.
 */
function splitAtAntimeridian(points) {
  const segments = []
  let current = []
  for (let i = 0; i < points.length; i++) {
    current.push(points[i])
    if (i > 0 && Math.abs(points[i][1] - points[i - 1][1]) > 180) {
      segments.push(current.slice(0, -1))
      current = [points[i]]
    }
  }
  if (current.length > 1) segments.push(current)
  return segments
}

export default function LCARSAstroIssTracker() {
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
        setTrail(prev => [...prev, [lat, lng]].slice(-20))
      }
    } catch (e) {}
  }, [])

  const loadCrewAndPasses = useCallback(async () => {
    try {
      const [crewRes, passesRes, trackRes] = await Promise.allSettled([
        api.iss.crew(), api.iss.passes(), api.iss.groundtrack(),
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
    pollRef.current = setInterval(() => { if (!document.hidden) loadPosition() }, 10000)
    return () => clearInterval(pollRef.current)
  }, [loadPosition, loadCrewAndPasses])

  const crewData = crew || {}
  const passesData = passes?.data?.passes || []

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 280px',
      gap: '8px',
    }}>
      {/* Map */}
      <div>
        <LCARSPanel title="Orbital Track" color="var(--lcars-ice)" noPadding style={{ overflow: 'hidden' }}>
          <div style={{ height: isMobile ? '280px' : '450px' }}>
            {position ? (
              <MapContainer center={position} zoom={3}
                style={{ height: '100%', width: '100%', background: '#000' }}
                zoomControl={!isMobile}>
                <TileLayer
                  attribution='&copy; CARTO'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapUpdater position={position} />
                <Marker position={position} icon={issIcon}>
                  <Popup>
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong>ISS</strong><br />
                      {position[0].toFixed(4)}, {position[1].toFixed(4)}
                    </div>
                  </Popup>
                </Marker>
                {/* Projected orbital path */}
                {groundTrack && groundTrack.map((segment, i) => (
                  <Polyline
                    key={`orbit-${i}`}
                    positions={segment}
                    pathOptions={{ color: '#336633', weight: 1.5, opacity: 0.5 }}
                  />
                ))}
                {/* Recent position trail */}
                {trail.length > 1 && (
                  <Polyline
                    positions={trail}
                    pathOptions={{ color: '#66FF66', weight: 2, opacity: 0.5, dashArray: '4 4' }}
                  />
                )}
              </MapContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'Antonio', sans-serif", color: 'var(--lcars-ice)', textTransform: 'uppercase' }}>
                Acquiring signal...
              </div>
            )}
          </div>
        </LCARSPanel>

        {/* Telemetry readout */}
        {position && (
          <LCARSPanel title="Telemetry" color="var(--lcars-ice)" style={{ marginTop: '8px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '4px' }}>
              <LCARSDataRow label="Latitude" value={position[0].toFixed(4) + '\u00B0'} color="var(--lcars-ice)" />
              <LCARSDataRow label="Longitude" value={position[1].toFixed(4) + '\u00B0'} color="var(--lcars-ice)" />
              <LCARSDataRow label="Altitude" value="408 km" color="var(--lcars-ice)" />
              <LCARSDataRow label="Velocity" value="27,600 km/h" color="var(--lcars-ice)" />
            </div>
          </LCARSPanel>
        )}

        {/* Passes */}
        {passesData.length > 0 && (
          <LCARSPanel title="Visible Passes" color="var(--lcars-tanoi)" noPadding style={{ marginTop: '8px' }}>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Rise', 'Peak', 'Elevation', 'Direction', 'Duration'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '0.4rem 0.6rem',
                        fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: 'var(--lcars-tanoi)', borderBottom: '2px solid var(--lcars-tanoi)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {passesData.map((pass, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(102, 102, 136, 0.15)' }}>
                      <td style={{ padding: '0.4rem 0.6rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--lcars-space-white)' }}>
                        {pass.rise_time ? new Date(pass.rise_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--lcars-gray)' }}>
                        {pass.peak_time ? new Date(pass.peak_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--lcars-gray)' }}>
                        {pass.peak_elevation ? pass.peak_elevation + '\u00B0' : '--'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--lcars-gray)' }}>
                        {pass.rise_azimuth || '--'} \u2192 {pass.set_azimuth || '--'}
                      </td>
                      <td style={{ padding: '0.4rem 0.6rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'var(--lcars-gray)' }}>
                        {pass.duration_seconds ? Math.round(pass.duration_seconds / 60) + ' min' : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </LCARSPanel>
        )}
      </div>

      {/* Crew Panel */}
      <LCARSPanel title="Crew Manifest" color="var(--lcars-lilac)">
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '1.75rem',
          fontWeight: 700, color: 'var(--lcars-space-white)', textAlign: 'center',
          marginBottom: '0.5rem',
        }}>
          {crewData.total || 0}
        </div>
        <div style={{
          fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
          color: 'var(--lcars-lilac)', textAlign: 'center',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: '0.75rem',
        }}>
          Personnel
        </div>
        {crewData.grouped && Object.entries(crewData.grouped).map(([craft, names]) => (
          <div key={craft} style={{ marginBottom: '0.75rem' }}>
            <div style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
              color: 'var(--lcars-ice)', textTransform: 'uppercase',
              letterSpacing: '0.1em', borderBottom: '1px solid rgba(102, 102, 136, 0.2)',
              paddingBottom: '0.125rem', marginBottom: '0.25rem',
            }}>
              {craft}
            </div>
            {names.map(name => (
              <div key={name} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                color: 'var(--lcars-space-white)', padding: '0.125rem 0',
              }}>
                {name}
              </div>
            ))}
          </div>
        ))}
      </LCARSPanel>
    </div>
  )
}
