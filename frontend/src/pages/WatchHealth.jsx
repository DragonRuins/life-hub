/**
 * WatchHealth - Full health dashboard (Catppuccin theme).
 *
 * Displays all Apple Watch health metrics organized into 6 sections:
 * Vital Signs, Activity, Sleep, Fitness, Environment, Cardiac.
 * Each metric is a clickable HealthMetricCard that navigates to detail.
 *
 * Route: /watch/health
 */
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Heart, Activity, Moon, Dumbbell, Thermometer, ChevronLeft,
  Footprints, Flame, Zap, Wind, Sun, Ear, Clock, Watch,
} from 'lucide-react'
import { watchHealth } from '../api/watchApi'
import HealthMetricCard from '../components/watch/HealthMetricCard'

// Health metric definitions organized by section
const HEALTH_SECTIONS = [
  {
    key: 'vital',
    label: 'Vital Signs',
    color: 'var(--color-red)',
    metrics: [
      { type: 'heartRate', label: 'Heart Rate', unit: 'bpm', icon: Heart },
      { type: 'heartRateVariabilitySDNN', label: 'HRV (SDNN)', unit: 'ms', icon: Activity },
      { type: 'restingHeartRate', label: 'Resting HR', unit: 'bpm', icon: Heart },
      { type: 'oxygenSaturation', label: 'SpO2', unit: '%', icon: Wind },
      { type: 'respiratoryRate', label: 'Respiratory', unit: 'br/min', icon: Wind },
      { type: 'bodyTemperature', label: 'Body Temp', unit: '\u00B0F', icon: Thermometer },
    ],
  },
  {
    key: 'activity',
    label: 'Activity',
    color: 'var(--color-green)',
    metrics: [
      { type: 'stepCount', label: 'Steps', unit: '', icon: Footprints },
      { type: 'distanceWalkingRunning', label: 'Distance', unit: 'mi', icon: Activity },
      { type: 'flightsClimbed', label: 'Flights', unit: '', icon: Activity },
      { type: 'activeEnergyBurned', label: 'Active Cal', unit: 'kcal', icon: Flame },
      { type: 'basalEnergyBurned', label: 'Resting Cal', unit: 'kcal', icon: Flame },
      { type: 'appleExerciseTime', label: 'Exercise', unit: 'min', icon: Clock },
      { type: 'appleStandTime', label: 'Stand Time', unit: 'hrs', icon: Zap },
    ],
  },
  {
    key: 'sleep',
    label: 'Sleep',
    color: 'var(--color-mauve)',
    metrics: [
      { type: 'sleepAnalysis', label: 'Sleep Duration', unit: 'hrs', icon: Moon },
      { type: 'appleSleepingWristTemperature', label: 'Wrist Temp', unit: '\u00B0F', icon: Thermometer },
    ],
  },
  {
    key: 'fitness',
    label: 'Fitness & Mobility',
    color: 'var(--color-teal)',
    metrics: [
      { type: 'vo2Max', label: 'VO2 Max', unit: 'ml/kg/min', icon: Dumbbell },
      { type: 'walkingSpeed', label: 'Walk Speed', unit: 'mph', icon: Footprints },
      { type: 'walkingStepLength', label: 'Step Length', unit: 'in', icon: Footprints },
      { type: 'walkingDoubleSupportPercentage', label: 'Dbl Support', unit: '%', icon: Activity },
      { type: 'walkingAsymmetryPercentage', label: 'Asymmetry', unit: '%', icon: Activity },
      { type: 'stairAscentSpeed', label: 'Stair Up', unit: 'ft/s', icon: Activity },
      { type: 'stairDescentSpeed', label: 'Stair Down', unit: 'ft/s', icon: Activity },
    ],
  },
  {
    key: 'environment',
    label: 'Environment',
    color: 'var(--color-yellow)',
    metrics: [
      { type: 'environmentalAudioExposure', label: 'Env. Noise', unit: 'dB', icon: Ear },
      { type: 'headphoneAudioExposure', label: 'Headphone', unit: 'dB', icon: Ear },
      { type: 'timeInDaylight', label: 'Daylight', unit: 'min', icon: Sun },
    ],
  },
  {
    key: 'cardiac',
    label: 'Cardiac',
    color: 'var(--color-sky)',
    metrics: [
      { type: 'heartRateRecoveryOneMinute', label: 'HR Recovery', unit: 'bpm', icon: Heart },
      { type: 'walkingHeartRateAverage', label: 'Walking HR', unit: 'bpm', icon: Heart },
    ],
  },
]

const TIMEFRAMES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: 'custom', label: 'Custom' },
]

export default function WatchHealth() {
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

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/watch"
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
          Watch Data
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Watch size={22} style={{ color: 'var(--color-red)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Health Dashboard
          </h1>
        </div>
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
            Failed to load health data: {error}
          </p>
        </div>
      )}

      {/* Health sections */}
      {HEALTH_SECTIONS.map(section => (
        <div key={section.key} style={{ marginBottom: '2rem' }}>
          <h2 style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: section.color,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.75rem',
            paddingBottom: '0.375rem',
            borderBottom: `2px solid color-mix(in srgb, ${section.color} 25%, transparent)`,
          }}>
            {section.label}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
          }}>
            {section.metrics.map(metric => {
              const reading = getMetricReading(healthData, metric.type)
              return (
                <HealthMetricCard
                  key={metric.type}
                  label={metric.label}
                  value={reading?.value}
                  unit={metric.unit}
                  trend={reading?.trend}
                  sparkData={reading?.spark_data || []}
                  color={section.color}
                  icon={<metric.icon size={16} />}
                  onClick={() => navigate(`/watch/health/${metric.type}`)}
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Extract a metric reading from health data */
function getMetricReading(healthData, metricType) {
  if (!healthData) return null
  if (Array.isArray(healthData)) {
    return healthData.find(m => m.type === metricType) || null
  }
  if (healthData[metricType]) return healthData[metricType]
  if (healthData.metrics) {
    if (Array.isArray(healthData.metrics)) {
      return healthData.metrics.find(m => m.type === metricType) || null
    }
    return healthData.metrics[metricType] || null
  }
  return null
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{
        height: '2rem', width: '250px',
        background: 'var(--color-surface-0)', borderRadius: '8px',
        marginBottom: '2rem',
      }} />
      {[...Array(3)].map((_, s) => (
        <div key={s} style={{ marginBottom: '2rem' }}>
          <div style={{
            height: '16px', width: '120px',
            background: 'var(--color-surface-0)', borderRadius: '4px',
            marginBottom: '0.75rem', opacity: 0.5,
          }} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
          }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{
                height: '90px',
                background: 'var(--color-surface-0)',
                borderRadius: '12px',
                opacity: 0.3,
              }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
