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

// ISS silhouette icon — truss with solar panel arrays
const issIcon = L.divIcon({
  className: '',
  html: `<div style="filter: drop-shadow(0 0 6px rgba(153, 204, 255, 0.7));">
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Main truss (horizontal beam) -->
      <rect x="2" y="19" width="36" height="2" rx="1" fill="#99CCFF"/>
      <!-- Central module cluster -->
      <rect x="16" y="15" width="8" height="10" rx="1.5" fill="#FFCC99" opacity="0.9"/>
      <rect x="18" y="17" width="4" height="6" rx="1" fill="#99CCFF" opacity="0.6"/>
      <!-- Left solar panels (4 panels) -->
      <rect x="2" y="10" width="6" height="8" rx="0.5" fill="#99CCFF" opacity="0.8" stroke="#FFCC99" stroke-width="0.4"/>
      <rect x="2" y="22" width="6" height="8" rx="0.5" fill="#99CCFF" opacity="0.8" stroke="#FFCC99" stroke-width="0.4"/>
      <rect x="9" y="10" width="6" height="8" rx="0.5" fill="#99CCFF" opacity="0.7" stroke="#FFCC99" stroke-width="0.4"/>
      <rect x="9" y="22" width="6" height="8" rx="0.5" fill="#99CCFF" opacity="0.7" stroke="#FFCC99" stroke-width="0.4"/>
      <!-- Right solar panels (4 panels) -->
      <rect x="25" y="10" width="6" height="8" rx="0.5" fill="#99CCFF" opacity="0.7" stroke="#FFCC99" stroke-width="0.4"/>
      <rect x="25" y="22" width="6" height="8" rx="0.5" fill="#99CCFF" opacity="0.7" stroke="#FFCC99" stroke-width="0.4"/>
      <rect x="32" y="10" width="6" height="8" rx="0.5" fill="#99CCFF" opacity="0.8" stroke="#FFCC99" stroke-width="0.4"/>
      <rect x="32" y="22" width="6" height="8" rx="0.5" fill="#99CCFF" opacity="0.8" stroke="#FFCC99" stroke-width="0.4"/>
      <!-- Panel grid lines (detail) -->
      <line x1="5" y1="10" x2="5" y2="18" stroke="#FFCC99" stroke-width="0.3" opacity="0.5"/>
      <line x1="5" y1="22" x2="5" y2="30" stroke="#FFCC99" stroke-width="0.3" opacity="0.5"/>
      <line x1="35" y1="10" x2="35" y2="18" stroke="#FFCC99" stroke-width="0.3" opacity="0.5"/>
      <line x1="35" y1="22" x2="35" y2="30" stroke="#FFCC99" stroke-width="0.3" opacity="0.5"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
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
 *
 * When consecutive points jump across ±180° longitude, we interpolate
 * two boundary points (one at +180, one at -180) so each segment
 * extends cleanly to the map edge with no gaps.
 */
function splitAtAntimeridian(points) {
  if (points.length < 2) return points.length === 1 ? [points] : []

  const segments = []
  let current = [points[0]]

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const lngDiff = curr[1] - prev[1]

    if (Math.abs(lngDiff) > 180) {
      // Interpolate latitude at the antimeridian crossing
      // Normalize the longitude jump to find the true fraction
      const sign = prev[1] > 0 ? 1 : -1 // which side of ±180 is prev on
      const prevToEdge = sign * 180 - prev[1]
      const edgeToCurr = curr[1] - (-sign * 180)
      const totalSpan = Math.abs(prevToEdge) + Math.abs(edgeToCurr)
      const fraction = totalSpan === 0 ? 0.5 : Math.abs(prevToEdge) / totalSpan
      const edgeLat = prev[0] + fraction * (curr[0] - prev[0])

      // End current segment at the near edge
      current.push([edgeLat, sign * 180])
      segments.push(current)

      // Start next segment from the far edge
      current = [[edgeLat, -sign * 180], curr]
    } else {
      current.push(curr)
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
                zoomControl={!isMobile} worldCopyJump={true}>
                <TileLayer
                  attribution='&copy; CARTO'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <MapUpdater position={position} />
                {/* ISS marker rendered at 3 world offsets for wrap visibility */}
                {[-360, 0, 360].map(offset => (
                  <Marker
                    key={`iss-${offset}`}
                    position={[position[0], position[1] + offset]}
                    icon={issIcon}
                  >
                    <Popup>
                      <div style={{ fontSize: '0.8rem' }}>
                        <strong>ISS</strong><br />
                        {position[0].toFixed(4)}, {position[1].toFixed(4)}
                      </div>
                    </Popup>
                  </Marker>
                ))}
                {/* Projected orbital path — rendered at 3 world offsets for wrap visibility */}
                {groundTrack && groundTrack.flatMap((segment, si) =>
                  [-360, 0, 360].map(offset => (
                    <Polyline
                      key={`orbit-${si}-${offset}`}
                      positions={offset === 0 ? segment : segment.map(([lat, lng]) => [lat, lng + offset])}
                      pathOptions={{ color: '#66FF66', weight: 2.5, opacity: 0.85 }}
                    />
                  ))
                )}
                {/* Recent position trail — rendered at 3 world offsets */}
                {splitAtAntimeridian(trail).flatMap((segment, si) =>
                  [-360, 0, 360].map(offset => (
                    <Polyline
                      key={`trail-${si}-${offset}`}
                      positions={offset === 0 ? segment : segment.map(([lat, lng]) => [lat, lng + offset])}
                      pathOptions={{ color: '#99CCFF', weight: 2, opacity: 0.6, dashArray: '4 4' }}
                    />
                  ))
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
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
                    <tr key={i} style={{ borderBottom: '1px solid rgba(102, 102, 136, 0.15)', background: i % 2 !== 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent' }}>
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
            {names.map((name, i) => (
              <div key={name} style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                color: 'var(--lcars-space-white)', padding: '0.125rem 0.25rem',
                background: i % 2 !== 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
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
