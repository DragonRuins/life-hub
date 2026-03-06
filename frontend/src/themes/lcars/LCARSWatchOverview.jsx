/**
 * LCARSWatchOverview - Watch Data Pipeline landing page (LCARS theme).
 *
 * LCARS interpretation of the Watch module overview with
 * vital signs readouts, sub-module navigation panels,
 * and pipeline status display.
 *
 * Route: /watch
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Heart, Activity, Moon, Dumbbell, Thermometer,
  Nfc, BarChart3, Radio, RefreshCw,
} from 'lucide-react'
import { watchHealth, watchSync } from '../../api/watchApi'
import LCARSPanel, { LCARSDataRow, LCARSStat, LCARSMiniPanel } from './LCARSPanel'

const VITAL_METRICS = [
  { type: 'heartRate', label: 'Heart Rate', unit: 'BPM', icon: Heart },
  { type: 'oxygenSaturation', label: 'Blood Oxygen', unit: '%', icon: Activity },
  { type: 'stepCount', label: 'Step Count', unit: '', icon: Activity },
  { type: 'activeEnergyBurned', label: 'Active Energy', unit: 'KCAL', icon: Dumbbell },
  { type: 'sleepAnalysis', label: 'Sleep', unit: 'HRS', icon: Moon },
  { type: 'bodyTemperature', label: 'Body Temp', unit: '\u00B0F', icon: Thermometer },
]

const SUB_MODULES = [
  { path: '/watch/health', label: 'LIFESIGNS', color: 'var(--lcars-ice)', icon: Heart },
  { path: '/watch/nfc', label: 'COMMAND ACTIONS', color: 'var(--lcars-tanoi)', icon: Nfc },
  { path: '/watch/barometer', label: 'ATMOSPHERIC', color: 'var(--lcars-ice)', icon: BarChart3 },
  { path: '/watch/spatial', label: 'SPATIAL ARRAY', color: 'var(--lcars-lilac)', icon: Radio },
  { path: '/watch/sync', label: 'DATA RELAY', color: 'var(--lcars-green)', icon: RefreshCw },
]

export default function LCARSWatchOverview() {
  const navigate = useNavigate()
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

  if (loading) {
    return (
      <LCARSPanel title="WRIST SENSOR ARRAY" color="var(--lcars-ice)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            INITIALIZING SENSOR ARRAY...
          </span>
        </div>
      </LCARSPanel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Error state */}
      {error && (
        <LCARSPanel title="DIAGNOSTIC ALERT" color="var(--lcars-red-alert)">
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: 'var(--lcars-red-alert)',
          }}>
            SENSOR LINK FAILURE: {error}
          </p>
        </LCARSPanel>
      )}

      {/* Vital Signs Readout */}
      <LCARSPanel title="VITAL SIGNS // CURRENT READINGS" color="var(--lcars-ice)">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.5rem',
        }}>
          {VITAL_METRICS.map(metric => {
            const reading = getMetricReading(healthData, metric.type)
            return (
              <LCARSStat
                key={metric.type}
                label={metric.label}
                value={reading?.value != null ? formatValue(reading.value) : '\u2014'}
                color="var(--lcars-ice)"
                icon={<metric.icon size={16} />}
              />
            )
          })}
        </div>
      </LCARSPanel>

      {/* Sub-Module Navigation */}
      <LCARSPanel title="SENSOR MODULES" color="var(--lcars-sunflower)">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.5rem',
        }}>
          {SUB_MODULES.map(mod => (
            <LCARSMiniPanel
              key={mod.path}
              title={mod.label}
              color={mod.color}
              style={{ cursor: 'pointer' }}
            >
              <div
                onClick={() => navigate(mod.path)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem',
                }}
              >
                <mod.icon size={16} style={{ color: mod.color }} />
                <span style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--lcars-space-white)',
                }}>
                  ACCESS MODULE
                </span>
              </div>
            </LCARSMiniPanel>
          ))}
        </div>
      </LCARSPanel>

      {/* Pipeline Status */}
      {syncStatus?.pipelines && (
        <LCARSPanel title="DATA RELAY STATUS" color="var(--lcars-green)">
          {syncStatus.pipelines.map(p => (
            <LCARSDataRow
              key={p.name}
              label={p.name}
              value={p.status === 'error' ? 'OFFLINE' : p.status === 'syncing' ? 'SYNCING' : 'NOMINAL'}
              color={p.status === 'error' ? 'var(--lcars-red-alert)' : p.status === 'syncing' ? 'var(--lcars-ice)' : 'var(--lcars-green)'}
            />
          ))}
        </LCARSPanel>
      )}
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
