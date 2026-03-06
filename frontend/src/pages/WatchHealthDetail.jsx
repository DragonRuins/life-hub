/**
 * WatchHealthDetail - Single health metric drilldown (Catppuccin theme).
 *
 * Shows detailed history for a specific health metric with
 * stats summary, time-series chart, and data table.
 *
 * Route: /watch/health/:metricType
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, TrendingUp, TrendingDown, Activity, BarChart3 } from 'lucide-react'
import useIsMobile from '../hooks/useIsMobile'
import { watchHealth } from '../api/watchApi'
import HealthChart from '../components/watch/HealthChart'
import { formatDate } from '../utils/formatDate'

// Display names for metric types
const METRIC_LABELS = {
  heartRate: 'Heart Rate',
  heartRateVariabilitySDNN: 'HRV (SDNN)',
  restingHeartRate: 'Resting Heart Rate',
  oxygenSaturation: 'Blood Oxygen',
  respiratoryRate: 'Respiratory Rate',
  bodyTemperature: 'Body Temperature',
  stepCount: 'Step Count',
  distanceWalkingRunning: 'Walking + Running Distance',
  flightsClimbed: 'Flights Climbed',
  activeEnergyBurned: 'Active Energy',
  basalEnergyBurned: 'Resting Energy',
  appleExerciseTime: 'Exercise Time',
  appleStandTime: 'Stand Time',
  sleepAnalysis: 'Sleep Duration',
  appleSleepingWristTemperature: 'Sleeping Wrist Temp',
  vo2Max: 'VO2 Max',
  walkingSpeed: 'Walking Speed',
  walkingStepLength: 'Step Length',
  walkingDoubleSupportPercentage: 'Double Support',
  walkingAsymmetryPercentage: 'Walking Asymmetry',
  stairAscentSpeed: 'Stair Ascent Speed',
  stairDescentSpeed: 'Stair Descent Speed',
  environmentalAudioExposure: 'Environmental Noise',
  headphoneAudioExposure: 'Headphone Noise',
  timeInDaylight: 'Time in Daylight',
  heartRateRecoveryOneMinute: 'Heart Rate Recovery',
  walkingHeartRateAverage: 'Walking Heart Rate',
}

const METRIC_UNITS = {
  heartRate: 'bpm', heartRateVariabilitySDNN: 'ms', restingHeartRate: 'bpm',
  oxygenSaturation: '%', respiratoryRate: 'br/min', bodyTemperature: '\u00B0F',
  stepCount: 'steps', distanceWalkingRunning: 'mi', flightsClimbed: 'flights',
  activeEnergyBurned: 'kcal', basalEnergyBurned: 'kcal', appleExerciseTime: 'min',
  appleStandTime: 'hrs', sleepAnalysis: 'hrs', appleSleepingWristTemperature: '\u00B0F',
  vo2Max: 'ml/kg/min', walkingSpeed: 'mph', walkingStepLength: 'in',
  walkingDoubleSupportPercentage: '%', walkingAsymmetryPercentage: '%',
  stairAscentSpeed: 'ft/s', stairDescentSpeed: 'ft/s',
  environmentalAudioExposure: 'dB', headphoneAudioExposure: 'dB',
  timeInDaylight: 'min', heartRateRecoveryOneMinute: 'bpm',
  walkingHeartRateAverage: 'bpm',
}

const TIMEFRAMES = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
]

export default function WatchHealthDetail() {
  const { metricType } = useParams()
  const isMobile = useIsMobile()
  const [data, setData] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState('7d')

  const label = METRIC_LABELS[metricType] || metricType
  const unit = METRIC_UNITS[metricType] || ''

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)

        // Calculate date range from timeframe
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

        // Handle different response shapes
        const entries = Array.isArray(result) ? result : result.data || result.entries || []
        setData(entries)

        // Compute stats from data
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

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/watch/health"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            color: 'var(--color-subtext-0)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            marginBottom: '0.5rem',
          }}
        >
          <ChevronLeft size={16} />
          Health Dashboard
        </Link>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {label}
        </h1>
      </div>

      {/* Timeframe selector */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.5rem' }}>
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.key}
            className={`btn ${timeframe === tf.key ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTimeframe(tf.key)}
            style={{ fontSize: '0.75rem', padding: '0.3rem 0.75rem' }}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          borderLeft: '3px solid var(--color-red)',
        }}>
          <p style={{ color: 'var(--color-red)', fontSize: '0.85rem' }}>
            Failed to load data: {error}
          </p>
        </div>
      )}

      {data.length === 0 && !error ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <BarChart3 size={32} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)' }}>
            No {label.toLowerCase()} data for the selected timeframe.
          </p>
        </div>
      ) : (
        <>
          {/* Stats Row */}
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}>
              <StatCard
                label="Current"
                value={stats.current != null ? formatMetricValue(stats.current) : '\u2014'}
                unit={unit}
                icon={<Activity size={16} />}
                color="var(--color-blue)"
              />
              <StatCard
                label="Average"
                value={stats.avg != null ? formatMetricValue(stats.avg) : '\u2014'}
                unit={unit}
                icon={<BarChart3 size={16} />}
                color="var(--color-teal)"
              />
              <StatCard
                label="Min"
                value={stats.min != null ? formatMetricValue(stats.min) : '\u2014'}
                unit={unit}
                icon={<TrendingDown size={16} />}
                color="var(--color-green)"
              />
              <StatCard
                label="Max"
                value={stats.max != null ? formatMetricValue(stats.max) : '\u2014'}
                unit={unit}
                icon={<TrendingUp size={16} />}
                color="var(--color-red)"
              />
            </div>
          )}

          {/* Chart */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              marginBottom: '1rem',
              color: 'var(--color-subtext-0)',
            }}>
              {label} Over Time
            </h3>
            <HealthChart
              data={data}
              dataKey="value"
              color="var(--color-blue)"
              unit={unit}
              avgValue={stats?.avg}
              height={isMobile ? 220 : 300}
            />
          </div>

          {/* Data Table */}
          {data.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{
                padding: '1rem 1.25rem',
                borderBottom: '1px solid var(--color-surface-0)',
              }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                  Data Points ({data.length})
                </h3>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.85rem',
                }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--color-mantle)' }}>
                    <tr style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
                      <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                      <th style={{ padding: '0.625rem 1rem', textAlign: 'right', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 100).map((entry, i) => (
                      <tr key={entry.id || i} style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
                        <td style={{ padding: '0.625rem 1rem', color: 'var(--color-text)' }}>
                          {formatDate(entry.date || entry.recorded_at)}
                        </td>
                        <td style={{ padding: '0.625rem 1rem', textAlign: 'right', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatMetricValue(entry.value)} {unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatMetricValue(value) {
  if (value == null) return '\u2014'
  if (typeof value !== 'number') return String(value)
  // Show 1 decimal for small numbers, none for large
  if (value >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(1)
}

function StatCard({ label, value, unit, icon, color }) {
  return (
    <div className="card" style={{ padding: '0.75rem 1rem' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        marginBottom: '0.375rem',
        color,
      }}>
        {icon}
        <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          {value}
        </span>
        <span style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)' }}>
          {unit}
        </span>
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '2rem', width: '200px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '2rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: '70px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
        ))}
      </div>
      <div style={{ height: '300px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
    </div>
  )
}
