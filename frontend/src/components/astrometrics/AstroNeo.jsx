/**
 * AstroNeo.jsx - Near Earth Objects Tab (Catppuccin Theme)
 *
 * Features:
 *   - Summary stats (total, hazardous, closest approach)
 *   - Recharts ScatterChart: X = miss distance (LD), Y = diameter (m),
 *     color by hazard status
 *   - Sortable data table with column headers
 *   - Mobile: card view via useIsMobile()
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { astrometrics as api } from '../../api/client'
import useIsMobile from '../../hooks/useIsMobile'
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, ArrowUpDown } from 'lucide-react'

export default function AstroNeo() {
  const [neoData, setNeoData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortField, setSortField] = useState('miss_distance_ld')
  const [sortDir, setSortDir] = useState('asc')
  const isMobile = useIsMobile()

  const loadData = useCallback(async () => {
    try {
      const result = await api.neo.feed()
      setNeoData(result)
      setError(null)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Parse NEO data into flat list
  const neos = useMemo(() => {
    if (!neoData?.data?.near_earth_objects) return []
    const list = []
    Object.entries(neoData.data.near_earth_objects).forEach(([date, dayNeos]) => {
      dayNeos.forEach(neo => {
        const approach = neo.close_approach_data?.[0] || {}
        const diameter = neo.estimated_diameter?.meters || {}
        const missDistance = approach.miss_distance || {}
        list.push({
          id: neo.id,
          name: neo.name,
          close_approach_date: approach.close_approach_date || date,
          diameter_min: diameter.estimated_diameter_min || 0,
          diameter_max: diameter.estimated_diameter_max || 0,
          velocity_kps: parseFloat(approach.relative_velocity?.kilometers_per_second || 0),
          miss_distance_ld: parseFloat(missDistance.lunar || 999),
          miss_distance_km: parseFloat(missDistance.kilometers || 0),
          is_hazardous: neo.is_potentially_hazardous_asteroid || false,
          nasa_jpl_url: neo.nasa_jpl_url,
        })
      })
    })
    return list
  }, [neoData])

  // Sort the list
  const sortedNeos = useMemo(() => {
    return [...neos].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [neos, sortField, sortDir])

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  // Chart data
  const chartData = useMemo(() => {
    return neos.map(neo => ({
      x: neo.miss_distance_ld,
      y: (neo.diameter_min + neo.diameter_max) / 2,
      name: neo.name,
      hazardous: neo.is_hazardous,
    }))
  }, [neos])

  const hazardousCount = neos.filter(n => n.is_hazardous).length
  const closestNeo = neos.length > 0 ? neos.reduce((a, b) => a.miss_distance_ld < b.miss_distance_ld ? a : b) : null

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-subtext-0)' }}>Loading NEO data...</div>
  if (error) return (
    <div style={{ padding: '1rem', background: 'rgba(243,139,168,0.1)', borderRadius: '8px', color: 'var(--color-red)' }}>
      {error} <button className="btn btn-ghost" onClick={loadData}>Retry</button>
    </div>
  )

  return (
    <div>
      {/* Summary Stats */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-blue)' }}>{neos.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>Total NEOs</div>
        </div>
        <div className="card" style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: hazardousCount > 0 ? 'var(--color-red)' : 'var(--color-green)' }}>
            {hazardousCount}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>Hazardous</div>
        </div>
        <div className="card" style={{ flex: '1 1 150px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-peach)' }}>
            {closestNeo ? closestNeo.miss_distance_ld.toFixed(2) : '--'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>Closest (LD)</div>
        </div>
      </div>

      {/* Scatter Chart */}
      {neos.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600 }}>
            Miss Distance vs. Diameter
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 10, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-1)" />
              <XAxis
                dataKey="x" type="number" name="Miss Distance"
                label={{ value: 'Miss Distance (Lunar Distances)', position: 'bottom', offset: 10, fill: 'var(--color-subtext-0)', fontSize: 12 }}
                tick={{ fill: 'var(--color-subtext-0)', fontSize: 11 }}
              />
              <YAxis
                dataKey="y" type="number" name="Diameter"
                label={{ value: 'Diameter (m)', angle: -90, position: 'insideLeft', fill: 'var(--color-subtext-0)', fontSize: 12 }}
                tick={{ fill: 'var(--color-subtext-0)', fontSize: 11 }}
              />
              <Tooltip
                content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div style={{
                      background: 'var(--color-base)', border: '1px solid var(--color-surface-1)',
                      borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.8rem',
                    }}>
                      <div style={{ fontWeight: 600 }}>{d.name}</div>
                      <div>Distance: {d.x.toFixed(2)} LD</div>
                      <div>Diameter: {d.y.toFixed(0)} m</div>
                      {d.hazardous && <div style={{ color: 'var(--color-red)', fontWeight: 600 }}>HAZARDOUS</div>}
                    </div>
                  )
                }}
              />
              <Scatter
                data={chartData.filter(d => !d.hazardous)}
                fill="var(--color-blue)" fillOpacity={0.7}
              />
              <Scatter
                data={chartData.filter(d => d.hazardous)}
                fill="var(--color-red)" fillOpacity={0.9}
              />
            </ScatterChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem', fontSize: '0.75rem' }}>
            <span><span style={{ color: 'var(--color-blue)' }}>{'\u25CF'}</span> Non-hazardous</span>
            <span><span style={{ color: 'var(--color-red)' }}>{'\u25CF'}</span> Potentially hazardous</span>
          </div>
        </div>
      )}

      {/* Data Table / Cards */}
      {isMobile ? (
        /* Mobile card view */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {sortedNeos.map(neo => (
            <div key={neo.id} className="card" style={{
              borderLeft: neo.is_hazardous ? '3px solid var(--color-red)' : '3px solid var(--color-surface-1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{neo.name}</span>
                {neo.is_hazardous && <AlertTriangle size={14} style={{ color: 'var(--color-red)' }} />}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span>Date: {neo.close_approach_date}</span>
                <span>Dist: {neo.miss_distance_ld.toFixed(2)} LD</span>
                <span>Vel: {neo.velocity_kps.toFixed(1)} km/s</span>
                <span>Dia: {neo.diameter_min.toFixed(0)}-{neo.diameter_max.toFixed(0)} m</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop table */
        <div className="card" style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {[
                  { field: 'name', label: 'Name' },
                  { field: 'close_approach_date', label: 'Date' },
                  { field: 'diameter_min', label: 'Diameter (m)' },
                  { field: 'velocity_kps', label: 'Velocity (km/s)' },
                  { field: 'miss_distance_ld', label: 'Distance (LD)' },
                  { field: 'is_hazardous', label: 'Hazardous' },
                ].map(col => (
                  <th key={col.field}
                    onClick={() => toggleSort(col.field)}
                    style={{
                      textAlign: 'left', padding: '0.625rem 0.75rem',
                      borderBottom: '2px solid var(--color-surface-1)',
                      cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                      color: sortField === col.field ? 'var(--color-blue)' : 'var(--color-subtext-0)',
                    }}
                  >
                    {col.label}
                    {sortField === col.field && (
                      <ArrowUpDown size={12} style={{ marginLeft: '0.25rem', verticalAlign: 'middle' }} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedNeos.map(neo => (
                <tr key={neo.id} style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
                  <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>
                    {neo.nasa_jpl_url ? (
                      <a href={neo.nasa_jpl_url} target="_blank" rel="noopener noreferrer"
                        style={{ color: 'var(--color-blue)', textDecoration: 'none' }}>
                        {neo.name}
                      </a>
                    ) : neo.name}
                  </td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{neo.close_approach_date}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{neo.diameter_min.toFixed(0)} - {neo.diameter_max.toFixed(0)}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{neo.velocity_kps.toFixed(1)}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>{neo.miss_distance_ld.toFixed(2)}</td>
                  <td style={{ padding: '0.5rem 0.75rem' }}>
                    {neo.is_hazardous && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem',
                        background: 'rgba(243, 139, 168, 0.15)', color: 'var(--color-red)', fontWeight: 600,
                      }}>
                        <AlertTriangle size={12} /> Yes
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
