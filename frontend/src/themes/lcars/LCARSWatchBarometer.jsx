/**
 * LCARSWatchBarometer - Atmospheric pressure analysis (LCARS theme).
 *
 * LCARS dual-axis chart for pressure/altitude with
 * Trek-themed stats display.
 *
 * Route: /watch/barometer
 */
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import useIsMobile from '../../hooks/useIsMobile'
import { watchBarometer } from '../../api/watchApi'
import { formatShortDate } from '../../utils/formatDate'
import LCARSPanel, { LCARSStat } from './LCARSPanel'

const TIMEFRAMES = [
  { key: '24h', label: '24H' },
  { key: '7d', label: '7 DAYS' },
  { key: '30d', label: '30 DAYS' },
]

export default function LCARSWatchBarometer() {
  const isMobile = useIsMobile()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState('24h')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const end = new Date().toISOString()
        const start = new Date()
        switch (timeframe) {
          case '24h': start.setDate(start.getDate() - 1); break
          case '7d': start.setDate(start.getDate() - 7); break
          case '30d': start.setDate(start.getDate() - 30); break
        }

        const result = await watchBarometer.query({ start: start.toISOString(), end })
        const entries = Array.isArray(result) ? result : result.data || result.readings || []
        setData(entries)
      } catch (err) {
        console.error('Failed to load barometer data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [timeframe])

  const stats = computeStats(data)

  if (loading) {
    return (
      <LCARSPanel title="ATMOSPHERIC ANALYSIS // LOADING" color="var(--lcars-ice)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
          }}>
            CALIBRATING ATMOSPHERIC SENSORS...
          </span>
        </div>
      </LCARSPanel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Timeframe selector */}
      <div style={{ display: 'flex', gap: '0.375rem' }}>
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.key}
            className="lcars-element button rounded"
            onClick={() => setTimeframe(tf.key)}
            style={{
              background: timeframe === tf.key ? 'var(--lcars-ice)' : 'var(--lcars-gray)',
              border: 'none',
              padding: '0.25rem 0.75rem',
              fontSize: '0.7rem',
              height: 'auto',
              width: 'auto',
            }}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {error && (
        <LCARSPanel title="SENSOR ERROR" color="var(--lcars-red-alert)">
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-red-alert)' }}>
            {error}
          </p>
        </LCARSPanel>
      )}

      {data.length === 0 && !error ? (
        <LCARSPanel title="ATMOSPHERIC ANALYSIS" color="var(--lcars-ice)">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem', color: 'var(--lcars-gray)', textTransform: 'uppercase' }}>
              NO ATMOSPHERIC DATA FOR SELECTED TIMEFRAME
            </span>
          </div>
        </LCARSPanel>
      ) : (
        <>
          {/* Stats */}
          {stats && (
            <LCARSPanel title="ATMOSPHERIC ANALYSIS // CURRENT" color="var(--lcars-ice)">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '0.25rem',
              }}>
                <LCARSStat label="CURRENT" value={stats.currentPressure} color="var(--lcars-ice)" />
                <LCARSStat label="MINIMUM" value={stats.minPressure} color="var(--lcars-green)" />
                <LCARSStat label="MAXIMUM" value={stats.maxPressure} color="var(--lcars-red-alert)" />
                <LCARSStat label="TREND" value={stats.trend} color="var(--lcars-sunflower)" />
              </div>
            </LCARSPanel>
          )}

          {/* Chart */}
          <LCARSPanel title="PRESSURE & ALTITUDE TIMELINE" color="var(--lcars-ice)" noPadding>
            <div style={{ padding: '1rem 0.5rem 0.5rem 0' }}>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <LineChart data={data.map(d => ({ ...d, dateLabel: formatShortDate(d.date) }))}>
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="rgba(102, 102, 136, 0.25)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: 'var(--lcars-gray)', fontSize: 11, fontFamily: "'Antonio', sans-serif" }}
                    stroke="rgba(102, 102, 136, 0.4)"
                    tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                    axisLine={{ stroke: 'var(--lcars-ice)', strokeWidth: 2 }}
                  />
                  <YAxis
                    yAxisId="pressure"
                    tick={{ fill: 'var(--lcars-gray)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                    stroke="rgba(102, 102, 136, 0.4)"
                    tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                    axisLine={{ stroke: 'var(--lcars-ice)', strokeWidth: 2 }}
                    domain={['auto', 'auto']}
                  />
                  <YAxis
                    yAxisId="altitude"
                    orientation="right"
                    tick={{ fill: 'var(--lcars-gray)', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}
                    stroke="rgba(102, 102, 136, 0.4)"
                    tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                    axisLine={{ stroke: 'var(--lcars-sunflower)', strokeWidth: 2 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<LCARSBaroTooltip />} />
                  <Legend
                    wrapperStyle={{
                      fontSize: '0.7rem',
                      fontFamily: "'Antonio', sans-serif",
                      textTransform: 'uppercase',
                    }}
                  />
                  <Line
                    yAxisId="pressure"
                    type="monotone"
                    dataKey="pressure"
                    name="Pressure (hPa)"
                    stroke="var(--lcars-ice)"
                    strokeWidth={2.5}
                    dot={{ fill: '#000', stroke: 'var(--lcars-ice)', strokeWidth: 2, r: 3 }}
                    activeDot={{ fill: 'var(--lcars-ice)', stroke: 'var(--lcars-space-white)', strokeWidth: 2, r: 5 }}
                  />
                  <Line
                    yAxisId="altitude"
                    type="monotone"
                    dataKey="altitude"
                    name="Altitude (m)"
                    stroke="var(--lcars-sunflower)"
                    strokeWidth={2}
                    dot={{ fill: '#000', stroke: 'var(--lcars-sunflower)', strokeWidth: 2, r: 3 }}
                    activeDot={{ fill: 'var(--lcars-sunflower)', stroke: 'var(--lcars-space-white)', strokeWidth: 2, r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </LCARSPanel>
        </>
      )}
    </div>
  )
}

function computeStats(data) {
  if (!data || data.length === 0) return null
  const pressures = data.map(d => d.pressure).filter(v => v != null)
  if (pressures.length === 0) return null

  const current = pressures[pressures.length - 1]
  const min = Math.min(...pressures)
  const max = Math.max(...pressures)
  const diff = current - pressures[0]
  let trend = 'STABLE'
  if (diff > 2) trend = 'RISING'
  else if (diff < -2) trend = 'FALLING'

  return {
    currentPressure: current.toFixed(1),
    minPressure: min.toFixed(1),
    maxPressure: max.toFixed(1),
    trend,
  }
}

function LCARSBaroTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div style={{
      background: '#000000',
      border: '2px solid var(--lcars-ice)',
      borderLeft: '5px solid var(--lcars-ice)',
      padding: '0.5rem 0.75rem',
      minWidth: '140px',
    }}>
      <div style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--lcars-gray)',
        marginBottom: '0.375rem',
      }}>
        {label}
      </div>
      {payload.map(p => (
        <div key={p.dataKey} style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          marginBottom: '0.125rem',
        }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            color: p.color,
          }}>
            {p.dataKey === 'pressure' ? 'PRESSURE' : 'ALTITUDE'}
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--lcars-space-white)',
          }}>
            {p.value?.toFixed(1)} {p.dataKey === 'pressure' ? 'hPa' : 'm'}
          </span>
        </div>
      ))}
    </div>
  )
}
