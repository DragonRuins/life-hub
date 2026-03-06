/**
 * LCARSWatchHealthDetail - Single health metric drilldown (LCARS theme).
 *
 * Shows detailed biosensor readout for a specific metric with
 * LCARS-styled chart, stats display, and data table.
 *
 * Route: /watch/health/:metricType
 */
import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import useIsMobile from '../../hooks/useIsMobile'
import { watchHealth } from '../../api/watchApi'
import { formatShortDate, formatDate } from '../../utils/formatDate'
import LCARSPanel, { LCARSStat, LCARSDataRow } from './LCARSPanel'

// Display names for LCARS
const METRIC_LABELS = {
  heartRate: 'HEART RATE',
  heartRateVariabilitySDNN: 'HRV SDNN',
  restingHeartRate: 'RESTING HEART RATE',
  oxygenSaturation: 'BLOOD OXYGEN',
  respiratoryRate: 'RESPIRATORY RATE',
  bodyTemperature: 'BODY TEMPERATURE',
  stepCount: 'STEP COUNT',
  distanceWalkingRunning: 'DISTANCE',
  flightsClimbed: 'FLIGHTS CLIMBED',
  activeEnergyBurned: 'ACTIVE ENERGY',
  basalEnergyBurned: 'RESTING ENERGY',
  appleExerciseTime: 'EXERCISE TIME',
  appleStandTime: 'STAND TIME',
  sleepAnalysis: 'SLEEP DURATION',
  appleSleepingWristTemperature: 'SLEEPING WRIST TEMP',
  vo2Max: 'VO2 MAX',
  walkingSpeed: 'WALKING SPEED',
  walkingStepLength: 'STEP LENGTH',
  walkingDoubleSupportPercentage: 'DOUBLE SUPPORT',
  walkingAsymmetryPercentage: 'WALKING ASYMMETRY',
  stairAscentSpeed: 'STAIR ASCENT',
  stairDescentSpeed: 'STAIR DESCENT',
  environmentalAudioExposure: 'ENVIRONMENTAL NOISE',
  headphoneAudioExposure: 'HEADPHONE EXPOSURE',
  timeInDaylight: 'DAYLIGHT EXPOSURE',
  heartRateRecoveryOneMinute: 'HR RECOVERY',
  walkingHeartRateAverage: 'WALKING HR',
}

const METRIC_UNITS = {
  heartRate: 'BPM', heartRateVariabilitySDNN: 'MS', restingHeartRate: 'BPM',
  oxygenSaturation: '%', respiratoryRate: 'BR/MIN', bodyTemperature: '\u00B0F',
  stepCount: 'STEPS', distanceWalkingRunning: 'MI', flightsClimbed: 'FLIGHTS',
  activeEnergyBurned: 'KCAL', basalEnergyBurned: 'KCAL', appleExerciseTime: 'MIN',
  appleStandTime: 'HRS', sleepAnalysis: 'HRS', appleSleepingWristTemperature: '\u00B0F',
  vo2Max: 'ML/KG/MIN', walkingSpeed: 'MPH', walkingStepLength: 'IN',
  walkingDoubleSupportPercentage: '%', walkingAsymmetryPercentage: '%',
  stairAscentSpeed: 'FT/S', stairDescentSpeed: 'FT/S',
  environmentalAudioExposure: 'DB', headphoneAudioExposure: 'DB',
  timeInDaylight: 'MIN', heartRateRecoveryOneMinute: 'BPM',
  walkingHeartRateAverage: 'BPM',
}

const TIMEFRAMES = [
  { key: '24h', label: '24H' },
  { key: '7d', label: '7 DAYS' },
  { key: '30d', label: '30 DAYS' },
  { key: '90d', label: '90 DAYS' },
]

export default function LCARSWatchHealthDetail() {
  const { metricType } = useParams()
  const isMobile = useIsMobile()
  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState('7d')

  const label = METRIC_LABELS[metricType] || metricType?.toUpperCase()
  const unit = METRIC_UNITS[metricType] || ''

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
          case '90d': start.setDate(start.getDate() - 90); break
        }

        const result = await watchHealth.query({
          type: metricType,
          start: start.toISOString(),
          end,
          limit: 500,
        })

        const entries = Array.isArray(result) ? result : result.data || result.entries || []
        setData(entries)

        if (entries.length > 0) {
          const values = entries.map(e => e.value).filter(v => v != null)
          if (values.length > 0) {
            setStats({
              min: Math.min(...values),
              max: Math.max(...values),
              avg: values.reduce((s, v) => s + v, 0) / values.length,
              current: values[values.length - 1],
              count: values.length,
            })
          }
        }
      } catch (err) {
        console.error('Failed to load health detail:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [metricType, timeframe])

  if (loading) {
    return (
      <LCARSPanel title={`BIOSENSOR ARRAY // ${label}`} color="var(--lcars-ice)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            QUERYING SENSOR DATA...
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

      {/* Error state */}
      {error && (
        <LCARSPanel title="SENSOR ERROR" color="var(--lcars-red-alert)">
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-red-alert)' }}>
            {error}
          </p>
        </LCARSPanel>
      )}

      {data.length === 0 && !error ? (
        <LCARSPanel title={`BIOSENSOR ARRAY // ${label}`} color="var(--lcars-ice)">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.85rem',
              color: 'var(--lcars-gray)',
              textTransform: 'uppercase',
            }}>
              NO DATA AVAILABLE FOR SELECTED TIMEFRAME
            </span>
          </div>
        </LCARSPanel>
      ) : (
        <>
          {/* Stats readout */}
          {stats && (
            <LCARSPanel title={`BIOSENSOR ARRAY // ${label}`} color="var(--lcars-ice)">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '0.25rem',
              }}>
                <LCARSStat label="CURRENT" value={formatVal(stats.current)} color="var(--lcars-ice)" />
                <LCARSStat label="AVERAGE" value={formatVal(stats.avg)} color="var(--lcars-sunflower)" />
                <LCARSStat label="MINIMUM" value={formatVal(stats.min)} color="var(--lcars-green)" />
                <LCARSStat label="MAXIMUM" value={formatVal(stats.max)} color="var(--lcars-red-alert)" />
              </div>
            </LCARSPanel>
          )}

          {/* Chart */}
          <LCARSPanel title={`VITAL SIGNS ANALYSIS // ${label}`} color="var(--lcars-ice)" noPadding>
            <div style={{ padding: '1rem 0.5rem 0.5rem 0' }}>
              <ResponsiveContainer width="100%" height={isMobile ? 220 : 300}>
                <LineChart data={data.map(d => ({ ...d, dateLabel: formatShortDate(d.date || d.recorded_at) }))}>
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="rgba(102, 102, 136, 0.25)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{
                      fill: 'var(--lcars-gray)',
                      fontSize: 11,
                      fontFamily: "'Antonio', sans-serif",
                    }}
                    stroke="rgba(102, 102, 136, 0.4)"
                    tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                    axisLine={{ stroke: 'var(--lcars-ice)', strokeWidth: 2 }}
                  />
                  <YAxis
                    tick={{
                      fill: 'var(--lcars-gray)',
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    stroke="rgba(102, 102, 136, 0.4)"
                    tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                    axisLine={{ stroke: 'var(--lcars-ice)', strokeWidth: 2 }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<LCARSTooltip unit={unit} color="var(--lcars-ice)" />} />
                  {stats?.avg && (
                    <ReferenceLine
                      y={stats.avg}
                      stroke="var(--lcars-sunflower)"
                      strokeDasharray="4 4"
                      strokeWidth={1}
                      label={{
                        value: `AVG ${formatVal(stats.avg)}`,
                        position: 'right',
                        fill: 'var(--lcars-sunflower)',
                        fontSize: 10,
                        fontFamily: "'Antonio', sans-serif",
                      }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--lcars-ice)"
                    strokeWidth={2.5}
                    dot={{
                      fill: '#000000',
                      stroke: 'var(--lcars-ice)',
                      strokeWidth: 2,
                      r: 4,
                    }}
                    activeDot={{
                      fill: 'var(--lcars-ice)',
                      stroke: 'var(--lcars-space-white)',
                      strokeWidth: 2,
                      r: 6,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </LCARSPanel>

          {/* Data readout table */}
          {data.length > 0 && (
            <LCARSPanel title={`SENSOR LOG // ${data.length} READINGS`} color="var(--lcars-tanoi)" noPadding>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {data.slice(0, 50).map((entry, i) => (
                  <LCARSDataRow
                    key={entry.id || i}
                    label={formatDate(entry.date || entry.recorded_at)}
                    value={`${formatVal(entry.value)} ${unit}`}
                    color="var(--lcars-tanoi)"
                  />
                ))}
              </div>
            </LCARSPanel>
          )}
        </>
      )}
    </div>
  )
}

function formatVal(v) {
  if (v == null) return '\u2014'
  if (typeof v !== 'number') return String(v)
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Number.isInteger(v)) return v.toString()
  return v.toFixed(1)
}

function LCARSTooltip({ active, payload, label, unit, color }) {
  if (!active || !payload?.length) return null
  const value = payload[0].value

  return (
    <div style={{
      background: '#000000',
      border: `2px solid ${color}`,
      borderLeft: `5px solid ${color}`,
      padding: '0.5rem 0.75rem',
      minWidth: '120px',
    }}>
      <div style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--lcars-gray)',
        marginBottom: '0.25rem',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '1.1rem',
        fontWeight: 700,
        color: 'var(--lcars-space-white)',
      }}>
        {typeof value === 'number' ? value.toFixed(1) : value}
      </div>
      <div style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color,
        marginTop: '0.125rem',
      }}>
        {unit}
      </div>
    </div>
  )
}
