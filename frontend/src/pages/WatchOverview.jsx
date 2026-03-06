/**
 * WatchOverview - Watch Data Pipeline landing page (Catppuccin theme).
 *
 * Module landing page showing vital signs summary cards,
 * sub-module navigation links, and sync status bar.
 *
 * Routes handled by this module (for Session 5 wiring):
 *   /watch                       → WatchOverview
 *   /watch/health                → WatchHealth
 *   /watch/health/:metricType    → WatchHealthDetail
 *   /watch/nfc                   → WatchNFC
 *   /watch/barometer             → WatchBarometer
 *   /watch/spatial               → WatchSpatial
 *   /watch/sync                  → WatchSync
 *
 * Route: /watch
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Watch, Heart, Activity, Moon, Dumbbell,
  Nfc, BarChart3, Radio, RefreshCw, Thermometer,
} from 'lucide-react'
import { watchHealth, watchSync } from '../api/watchApi'
import HealthMetricCard from '../components/watch/HealthMetricCard'

// Health metric sections for the overview summary
const VITAL_METRICS = [
  { type: 'heartRate', label: 'Heart Rate', unit: 'bpm', icon: Heart, color: 'var(--color-red)' },
  { type: 'oxygenSaturation', label: 'SpO2', unit: '%', icon: Activity, color: 'var(--color-blue)' },
  { type: 'stepCount', label: 'Steps', unit: '', icon: Activity, color: 'var(--color-green)' },
  { type: 'activeEnergyBurned', label: 'Calories', unit: 'kcal', icon: Dumbbell, color: 'var(--color-peach)' },
  { type: 'sleepAnalysis', label: 'Sleep', unit: 'hrs', icon: Moon, color: 'var(--color-mauve)' },
  { type: 'bodyTemperature', label: 'Temp', unit: '\u00B0F', icon: Thermometer, color: 'var(--color-yellow)' },
]

const SUB_MODULES = [
  { path: '/watch/health', label: 'Health Dashboard', desc: 'Full vital signs, activity, sleep, and fitness metrics', icon: Heart, color: 'var(--color-red)' },
  { path: '/watch/nfc', label: 'NFC Actions', desc: 'Manage NFC tag actions, timers, and event history', icon: Nfc, color: 'var(--color-peach)' },
  { path: '/watch/barometer', label: 'Barometer', desc: 'Atmospheric pressure and altitude timeline', icon: BarChart3, color: 'var(--color-blue)' },
  { path: '/watch/spatial', label: 'Spatial Data', desc: 'UWB device proximity tracking', icon: Radio, color: 'var(--color-mauve)' },
  { path: '/watch/sync', label: 'Sync Status', desc: 'Data pipeline health and sync history', icon: RefreshCw, color: 'var(--color-green)' },
]

export default function WatchOverview() {
  const [healthData, setHealthData] = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [health, sync] = await Promise.all([
          watchHealth.getLatest(),
          watchSync.status(),
        ])
        setHealthData(health)
        setSyncStatus(sync)
      } catch (err) {
        console.error('Failed to load watch overview:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Watch size={24} style={{ color: 'var(--color-blue)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Watch Data
          </h1>
        </div>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
          Apple Watch sensor data pipeline and NFC automation
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          borderLeft: '3px solid var(--color-red)',
        }}>
          <p style={{ color: 'var(--color-red)', fontSize: '0.85rem' }}>
            Failed to load watch data: {error}
          </p>
        </div>
      )}

      {/* Vital Signs Summary */}
      <h2 style={{
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--color-subtext-0)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.75rem',
      }}>
        Vital Signs
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        {VITAL_METRICS.map(metric => {
          const reading = getMetricReading(healthData, metric.type)
          return (
            <HealthMetricCard
              key={metric.type}
              label={metric.label}
              value={reading?.value}
              unit={metric.unit}
              trend={reading?.trend}
              sparkData={reading?.spark_data || []}
              color={metric.color}
              icon={<metric.icon size={16} />}
              onClick={() => window.location.href = `/watch/health/${metric.type}`}
            />
          )
        })}
      </div>

      {/* Sub-Module Links */}
      <h2 style={{
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--color-subtext-0)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.75rem',
      }}>
        Modules
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        {SUB_MODULES.map(mod => (
          <Link
            key={mod.path}
            to={mod.path}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div
              className="card"
              style={{
                padding: '1rem',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = mod.color}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem',
                marginBottom: '0.5rem',
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `color-mix(in srgb, ${mod.color} 12%, transparent)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: mod.color,
                }}>
                  <mod.icon size={16} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{mod.label}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', margin: 0 }}>
                {mod.desc}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Sync Status Bar */}
      {syncStatus && syncStatus.pipelines && (
        <>
          <h2 style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--color-subtext-0)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.75rem',
          }}>
            Pipeline Status
          </h2>
          <div className="card" style={{ padding: '0.75rem 1rem' }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
            }}>
              {syncStatus.pipelines.map(p => (
                <div key={p.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  fontSize: '0.8rem',
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: p.status === 'error' ? 'var(--color-red)'
                      : p.status === 'syncing' ? 'var(--color-blue)'
                      : 'var(--color-green)',
                  }} />
                  <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/** Extract a metric reading from health data, handling various response shapes */
function getMetricReading(healthData, metricType) {
  if (!healthData) return null

  // Handle array format: find by type
  if (Array.isArray(healthData)) {
    return healthData.find(m => m.type === metricType) || null
  }

  // Handle object format: keyed by metric type
  if (healthData[metricType]) return healthData[metricType]

  // Handle nested metrics array
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
        height: '2rem', width: '200px',
        background: 'var(--color-surface-0)', borderRadius: '8px',
        marginBottom: '2rem',
      }} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem',
        marginBottom: '2rem',
      }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            height: '90px',
            background: 'var(--color-surface-0)',
            borderRadius: '12px',
            opacity: 0.3,
          }} />
        ))}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '0.75rem',
      }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{
            height: '80px',
            background: 'var(--color-surface-0)',
            borderRadius: '12px',
            opacity: 0.3,
          }} />
        ))}
      </div>
    </div>
  )
}
