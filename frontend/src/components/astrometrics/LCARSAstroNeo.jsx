/**
 * LCARSAstroNeo.jsx - Threat Assessment (LCARS NEO Tracker)
 *
 * Features:
 *   - Custom SVG tactical display: Earth at center, Moon orbit ring at 1 LD,
 *     concentric range rings, NEO dots positioned by distance, hazardous dots
 *     pulse red via CSS animation
 *   - Summary stats in LCARSPanel widgets
 *   - Data table with LCARS styling
 *   - Mobile: card view
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { astrometrics as api } from '../../api/client'
import LCARSPanel, { LCARSStat } from '../../themes/lcars/LCARSPanel'
import useIsMobile from '../../hooks/useIsMobile'

export default function LCARSAstroNeo() {
  const [neoData, setNeoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortField, setSortField] = useState('miss_distance_ld')
  const [sortDir, setSortDir] = useState('asc')
  const isMobile = useIsMobile()

  const loadData = useCallback(async () => {
    try { setNeoData(await api.neo.feed()); setError(null) }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const neos = useMemo(() => {
    if (!neoData?.data?.near_earth_objects) return []
    const list = []
    Object.entries(neoData.data.near_earth_objects).forEach(([date, dayNeos]) => {
      dayNeos.forEach(neo => {
        const approach = neo.close_approach_data?.[0] || {}
        const diameter = neo.estimated_diameter?.meters || {}
        const miss = approach.miss_distance || {}
        list.push({
          id: neo.id, name: neo.name,
          close_approach_date: approach.close_approach_date || date,
          diameter_min: diameter.estimated_diameter_min || 0,
          diameter_max: diameter.estimated_diameter_max || 0,
          velocity_kps: parseFloat(approach.relative_velocity?.kilometers_per_second || 0),
          miss_distance_ld: parseFloat(miss.lunar || 999),
          miss_distance_km: parseFloat(miss.kilometers || 0),
          is_hazardous: neo.is_potentially_hazardous_asteroid || false,
          nasa_jpl_url: neo.nasa_jpl_url,
        })
      })
    })
    return list
  }, [neoData])

  const sortedNeos = useMemo(() => {
    return [...neos].sort((a, b) => {
      const av = a[sortField], bv = b[sortField]
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
  }, [neos, sortField, sortDir])

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  const hazardousCount = neos.filter(n => n.is_hazardous).length
  const closestNeo = neos.length > 0 ? neos.reduce((a, b) => a.miss_distance_ld < b.miss_distance_ld ? a : b) : null

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', fontFamily: "'Antonio', sans-serif",
      color: 'var(--lcars-tanoi)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      Scanning for near earth objects...
    </div>
  )

  // Tactical display: max distance for scaling
  const maxLd = Math.max(10, ...neos.map(n => n.miss_distance_ld))
  const svgSize = isMobile ? 300 : 400
  const center = svgSize / 2
  const maxRadius = center - 30

  return (
    <div>
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '6px', marginBottom: '1rem' }}>
        <LCARSPanel title="Detected" color="var(--lcars-tanoi)">
          <LCARSStat label="Objects" value={neos.length} color="var(--lcars-tanoi)" />
        </LCARSPanel>
        <LCARSPanel title="Hazardous" color={hazardousCount > 0 ? 'var(--lcars-red-alert)' : 'var(--lcars-tanoi)'}>
          <LCARSStat label="PHA" value={hazardousCount} color={hazardousCount > 0 ? 'var(--lcars-red-alert)' : 'var(--lcars-tanoi)'} />
        </LCARSPanel>
        <LCARSPanel title="Closest" color="var(--lcars-sunflower)">
          <LCARSStat label="Lunar Dist" value={closestNeo ? closestNeo.miss_distance_ld.toFixed(2) : '---'} color="var(--lcars-sunflower)" />
        </LCARSPanel>
      </div>

      {/* SVG Tactical Display */}
      {neos.length > 0 && (
        <LCARSPanel title="Tactical Display" color="var(--lcars-tanoi)" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}
              style={{ background: '#000', borderRadius: '4px' }}>
              {/* Range rings */}
              {[1, 2, 5, 10, 20, 50].filter(r => r <= maxLd).map(r => {
                const radius = (r / maxLd) * maxRadius
                return (
                  <g key={r}>
                    <circle cx={center} cy={center} r={radius}
                      fill="none" stroke="rgba(102, 102, 136, 0.2)" strokeWidth="1" />
                    <text x={center + radius + 2} y={center - 4}
                      fill="var(--lcars-gray)" fontSize="9" fontFamily="'JetBrains Mono', monospace">
                      {r} LD
                    </text>
                  </g>
                )
              })}

              {/* Earth (center) */}
              <circle cx={center} cy={center} r={4} fill="var(--lcars-ice)" />
              <text x={center} y={center + 14} textAnchor="middle"
                fill="var(--lcars-ice)" fontSize="8" fontFamily="'Antonio', sans-serif">
                EARTH
              </text>

              {/* Moon orbit ring at 1 LD */}
              <circle cx={center} cy={center} r={(1 / maxLd) * maxRadius}
                fill="none" stroke="var(--lcars-gray)" strokeWidth="1" strokeDasharray="3 3" />

              {/* NEO dots */}
              {neos.map((neo, i) => {
                const distance = (neo.miss_distance_ld / maxLd) * maxRadius
                // Distribute dots around the circle using index for angle
                const angle = (i / neos.length) * Math.PI * 2 - Math.PI / 2
                const x = center + Math.cos(angle) * distance
                const y = center + Math.sin(angle) * distance
                const dotSize = Math.max(2, Math.min(6, (neo.diameter_max / 500) * 4))

                return (
                  <g key={neo.id}>
                    <circle cx={x} cy={y} r={dotSize}
                      fill={neo.is_hazardous ? 'var(--lcars-red-alert)' : 'var(--lcars-sunflower)'}
                      opacity={neo.is_hazardous ? 1 : 0.7}>
                      {neo.is_hazardous && (
                        <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
                      )}
                    </circle>
                    <title>{neo.name}: {neo.miss_distance_ld.toFixed(2)} LD</title>
                  </g>
                )
              })}

              {/* Crosshairs */}
              <line x1={10} y1={center} x2={svgSize - 10} y2={center} stroke="rgba(102, 102, 136, 0.15)" strokeWidth="1" />
              <line x1={center} y1={10} x2={center} y2={svgSize - 10} stroke="rgba(102, 102, 136, 0.15)" strokeWidth="1" />
            </svg>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--lcars-gray)' }}>
            <span><span style={{ color: 'var(--lcars-sunflower)' }}>{'\u25CF'}</span> Standard</span>
            <span><span style={{ color: 'var(--lcars-red-alert)' }}>{'\u25CF'}</span> Hazardous</span>
          </div>
        </LCARSPanel>
      )}

      {/* Data Table */}
      <LCARSPanel title="Object Registry" color="var(--lcars-tanoi)" noPadding>
        {isMobile ? (
          <div style={{ padding: '0.5rem' }}>
            {sortedNeos.map(neo => (
              <div key={neo.id} style={{
                padding: '0.5rem', marginBottom: '4px',
                borderLeft: neo.is_hazardous ? '3px solid var(--lcars-red-alert)' : '3px solid var(--lcars-gray)',
                background: 'rgba(102, 102, 136, 0.05)',
              }}>
                <div style={{ fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem', color: 'var(--lcars-space-white)', textTransform: 'uppercase' }}>
                  {neo.name}
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: 'var(--lcars-gray)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.125rem' }}>
                  <span>Dist: {neo.miss_distance_ld.toFixed(2)} LD</span>
                  <span>Vel: {neo.velocity_kps.toFixed(1)} km/s</span>
                  <span>Dia: {neo.diameter_min.toFixed(0)}-{neo.diameter_max.toFixed(0)}m</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    { field: 'name', label: 'Designation' },
                    { field: 'close_approach_date', label: 'Date' },
                    { field: 'diameter_min', label: 'Diameter' },
                    { field: 'velocity_kps', label: 'Velocity' },
                    { field: 'miss_distance_ld', label: 'Distance' },
                    { field: 'is_hazardous', label: 'PHA' },
                  ].map(col => (
                    <th key={col.field} onClick={() => toggleSort(col.field)}
                      style={{
                        textAlign: 'left', padding: '0.5rem 0.75rem',
                        fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
                        textTransform: 'uppercase', letterSpacing: '0.08em',
                        color: sortField === col.field ? 'var(--lcars-tanoi)' : 'var(--lcars-gray)',
                        borderBottom: '2px solid var(--lcars-tanoi)',
                        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                      }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedNeos.map(neo => (
                  <tr key={neo.id} style={{ borderBottom: '1px solid rgba(102, 102, 136, 0.15)' }}>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-space-white)' }}>
                      {neo.name}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-gray)' }}>
                      {neo.close_approach_date}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-gray)' }}>
                      {neo.diameter_min.toFixed(0)}-{neo.diameter_max.toFixed(0)} m
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-gray)' }}>
                      {neo.velocity_kps.toFixed(1)} km/s
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-space-white)', fontWeight: 600 }}>
                      {neo.miss_distance_ld.toFixed(2)} LD
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem' }}>
                      {neo.is_hazardous && (
                        <span style={{
                          padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem',
                          background: 'rgba(204, 0, 0, 0.3)', color: 'var(--lcars-red-alert)',
                          fontFamily: "'Antonio', sans-serif", textTransform: 'uppercase',
                          letterSpacing: '0.05em', fontWeight: 600,
                        }}>
                          Hazardous
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </LCARSPanel>
    </div>
  )
}
