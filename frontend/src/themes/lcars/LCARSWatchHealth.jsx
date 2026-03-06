/**
 * LCARSWatchHealth - Full health dashboard (LCARS theme).
 *
 * Displays all health metrics in LCARS panel sections with
 * biosensor readout styling, Trek-themed section names.
 *
 * Route: /watch/health
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Heart, Activity, Moon, Dumbbell, Thermometer,
  Footprints, Flame, Zap, Wind, Sun, Ear, Clock,
} from 'lucide-react'
import { watchHealth } from '../../api/watchApi'
import LCARSPanel, { LCARSStat } from './LCARSPanel'

const HEALTH_SECTIONS = [
  {
    key: 'vital',
    label: 'LIFESIGNS',
    color: 'var(--lcars-ice)',
    metrics: [
      { type: 'heartRate', label: 'Heart Rate', unit: 'BPM', icon: Heart },
      { type: 'heartRateVariabilitySDNN', label: 'HRV SDNN', unit: 'MS', icon: Activity },
      { type: 'restingHeartRate', label: 'Resting HR', unit: 'BPM', icon: Heart },
      { type: 'oxygenSaturation', label: 'SPO2', unit: '%', icon: Wind },
      { type: 'respiratoryRate', label: 'Respiratory', unit: 'BR/MIN', icon: Wind },
      { type: 'bodyTemperature', label: 'Body Temp', unit: '\u00B0F', icon: Thermometer },
    ],
  },
  {
    key: 'activity',
    label: 'ACTIVITY LOG',
    color: 'var(--lcars-green)',
    metrics: [
      { type: 'stepCount', label: 'Steps', unit: '', icon: Footprints },
      { type: 'distanceWalkingRunning', label: 'Distance', unit: 'MI', icon: Activity },
      { type: 'flightsClimbed', label: 'Flights', unit: '', icon: Activity },
      { type: 'activeEnergyBurned', label: 'Active Cal', unit: 'KCAL', icon: Flame },
      { type: 'basalEnergyBurned', label: 'Resting Cal', unit: 'KCAL', icon: Flame },
      { type: 'appleExerciseTime', label: 'Exercise', unit: 'MIN', icon: Clock },
      { type: 'appleStandTime', label: 'Stand Time', unit: 'HRS', icon: Zap },
    ],
  },
  {
    key: 'sleep',
    label: 'SLEEP ANALYSIS',
    color: 'var(--lcars-african-violet)',
    metrics: [
      { type: 'sleepAnalysis', label: 'Sleep Duration', unit: 'HRS', icon: Moon },
      { type: 'appleSleepingWristTemperature', label: 'Wrist Temp', unit: '\u00B0F', icon: Thermometer },
    ],
  },
  {
    key: 'fitness',
    label: 'MOBILITY ASSESSMENT',
    color: 'var(--lcars-sunflower)',
    metrics: [
      { type: 'vo2Max', label: 'VO2 Max', unit: 'ML/KG/MIN', icon: Dumbbell },
      { type: 'walkingSpeed', label: 'Walk Speed', unit: 'MPH', icon: Footprints },
      { type: 'walkingStepLength', label: 'Step Length', unit: 'IN', icon: Footprints },
      { type: 'walkingDoubleSupportPercentage', label: 'Dbl Support', unit: '%', icon: Activity },
      { type: 'walkingAsymmetryPercentage', label: 'Asymmetry', unit: '%', icon: Activity },
      { type: 'stairAscentSpeed', label: 'Stair Up', unit: 'FT/S', icon: Activity },
      { type: 'stairDescentSpeed', label: 'Stair Down', unit: 'FT/S', icon: Activity },
    ],
  },
  {
    key: 'environment',
    label: 'ENVIRONMENTAL SENSORS',
    color: 'var(--lcars-sunflower)',
    metrics: [
      { type: 'environmentalAudioExposure', label: 'Env Noise', unit: 'DB', icon: Ear },
      { type: 'headphoneAudioExposure', label: 'Headphone', unit: 'DB', icon: Ear },
      { type: 'timeInDaylight', label: 'Daylight', unit: 'MIN', icon: Sun },
    ],
  },
  {
    key: 'cardiac',
    label: 'CARDIAC MONITORING',
    color: 'var(--lcars-ice)',
    metrics: [
      { type: 'heartRateRecoveryOneMinute', label: 'HR Recovery', unit: 'BPM', icon: Heart },
      { type: 'walkingHeartRateAverage', label: 'Walking HR', unit: 'BPM', icon: Heart },
    ],
  },
]

const TIMEFRAMES = [
  { key: 'today', label: 'TODAY' },
  { key: '7d', label: '7 DAYS' },
  { key: '30d', label: '30 DAYS' },
]

export default function LCARSWatchHealth() {
  const navigate = useNavigate()
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState('today')

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true)
        const params = {}
        if (timeframe === '7d') params.days = 7
        else if (timeframe === '30d') params.days = 30

        const data = await watchHealth.getLatest(params)
        setHealthData(data)
      } catch (err) {
        console.error('Failed to load health data:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [timeframe])

  if (loading) {
    return (
      <LCARSPanel title="BIOSENSOR ARRAY // INITIALIZING" color="var(--lcars-ice)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            SCANNING ALL BIOSENSOR FREQUENCIES...
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
        <LCARSPanel title="DIAGNOSTIC ALERT" color="var(--lcars-red-alert)">
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: 'var(--lcars-red-alert)',
          }}>
            BIOSENSOR FAILURE: {error}
          </p>
        </LCARSPanel>
      )}

      {/* Health sections */}
      {HEALTH_SECTIONS.map(section => (
        <LCARSPanel
          key={section.key}
          title={section.label}
          color={section.color}
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '0.25rem',
          }}>
            {section.metrics.map(metric => {
              const reading = getMetricReading(healthData, metric.type)
              return (
                <div
                  key={metric.type}
                  onClick={() => navigate(`/watch/health/${metric.type}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <LCARSStat
                    label={metric.label}
                    value={reading?.value != null ? formatValue(reading.value) : '\u2014'}
                    color={section.color}
                    icon={<metric.icon size={14} />}
                  />
                </div>
              )
            })}
          </div>
        </LCARSPanel>
      ))}
    </div>
  )
}

function getMetricReading(healthData, metricType) {
  if (!healthData) return null
  if (Array.isArray(healthData)) return healthData.find(m => m.type === metricType) || null
  if (healthData[metricType]) return healthData[metricType]
  if (healthData.metrics) {
    if (Array.isArray(healthData.metrics)) return healthData.metrics.find(m => m.type === metricType) || null
    return healthData.metrics[metricType] || null
  }
  return null
}

function formatValue(v) {
  if (typeof v !== 'number') return String(v)
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  if (Number.isInteger(v)) return v.toString()
  return v.toFixed(1)
}
