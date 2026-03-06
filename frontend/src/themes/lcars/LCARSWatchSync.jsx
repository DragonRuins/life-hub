/**
 * LCARSWatchSync - Data relay status (LCARS theme).
 *
 * LCARS display of sync pipeline health with LCARSMiniPanel
 * per data source and auto-refresh every 60 seconds.
 *
 * Route: /watch/sync
 */
import { useState, useEffect, useRef } from 'react'
import { RefreshCw } from 'lucide-react'
import { watchSync } from '../../api/watchApi'
import LCARSPanel, { LCARSMiniPanel, LCARSDataRow } from './LCARSPanel'

// Stale thresholds in minutes
const STALE_THRESHOLDS = { health: 30, default: 60 }

export default function LCARSWatchSync() {
  const [syncData, setSyncData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastRefreshed, setLastRefreshed] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef(null)

  async function loadData(showLoading = true) {
    try {
      if (showLoading) setLoading(true)
      const data = await watchSync.status()
      setSyncData(data)
      setLastRefreshed(new Date())
    } catch (err) {
      console.error('Failed to load sync status:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      loadData(false)
    }, 60000)
    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  async function handleManualRefresh() {
    setRefreshing(true)
    await loadData(false)
    setRefreshing(false)
  }

  const pipelines = syncData?.pipelines || syncData?.sources || []

  if (loading) {
    return (
      <LCARSPanel title="DATA RELAY STATUS // INITIALIZING" color="var(--lcars-green)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            color: 'var(--lcars-gray)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            CHECKING RELAY CONNECTIONS...
          </span>
        </div>
      </LCARSPanel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {error && (
        <LCARSPanel title="RELAY ERROR" color="var(--lcars-red-alert)">
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-red-alert)' }}>
            {error}
          </p>
        </LCARSPanel>
      )}

      <LCARSPanel
        title="DATA RELAY STATUS"
        color="var(--lcars-green)"
        headerRight={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {lastRefreshed && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.6rem',
                color: 'var(--lcars-gray)',
              }}>
                {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <button
              className="lcars-element button rounded"
              onClick={handleManualRefresh}
              disabled={refreshing}
              style={{
                background: 'var(--lcars-sunflower)',
                border: 'none',
                padding: '0.2rem 0.5rem',
                fontSize: '0.6rem',
                height: 'auto',
                width: 'auto',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <RefreshCw size={10} style={{
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
              }} />
              REFRESH
            </button>
          </div>
        }
      >
        {pipelines.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{ fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem', color: 'var(--lcars-gray)', textTransform: 'uppercase' }}>
              NO RELAY PIPELINES CONFIGURED
            </span>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.5rem',
          }}>
            {pipelines.map(pipeline => {
              const status = getEffectiveStatus(pipeline)
              const statusColor = status === 'error' ? 'var(--lcars-red-alert)'
                : status === 'stale' ? 'var(--lcars-sunflower)'
                : status === 'syncing' ? 'var(--lcars-ice)'
                : 'var(--lcars-green)'

              const statusLabel = status === 'error' ? 'OFFLINE'
                : status === 'stale' ? 'STALE'
                : status === 'syncing' ? 'SYNCING'
                : status === 'unknown' ? 'NO DATA'
                : 'NOMINAL'

              return (
                <LCARSMiniPanel
                  key={pipeline.name}
                  title={pipeline.name?.toUpperCase() || 'PIPELINE'}
                  color={statusColor}
                >
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--lcars-space-white)',
                    marginBottom: '0.375rem',
                  }}>
                    {statusLabel}
                  </div>
                  {pipeline.last_sync && (
                    <div style={{
                      fontFamily: "'Antonio', sans-serif",
                      fontSize: '0.65rem',
                      color: 'var(--lcars-gray)',
                      textTransform: 'uppercase',
                    }}>
                      LAST SYNC: {formatRelativeTime(pipeline.last_sync)}
                    </div>
                  )}
                  {pipeline.record_count != null && (
                    <div style={{
                      fontFamily: "'Antonio', sans-serif",
                      fontSize: '0.65rem',
                      color: 'var(--lcars-gray)',
                      textTransform: 'uppercase',
                    }}>
                      RECORDS: {pipeline.record_count.toLocaleString()}
                    </div>
                  )}
                  {pipeline.error && (
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.6rem',
                      color: 'var(--lcars-red-alert)',
                      marginTop: '0.25rem',
                    }}>
                      {pipeline.error}
                    </div>
                  )}
                </LCARSMiniPanel>
              )
            })}
          </div>
        )}
      </LCARSPanel>

      {/* Threshold info */}
      <LCARSPanel title="RELAY CONFIGURATION" color="var(--lcars-gray)">
        <LCARSDataRow label="HEALTH DATA" value="STALE AFTER 30 MIN" color="var(--lcars-green)" />
        <LCARSDataRow label="OTHER PIPELINES" value="STALE AFTER 60 MIN" color="var(--lcars-green)" />
        <LCARSDataRow label="AUTO-REFRESH" value="60 SECOND INTERVAL" color="var(--lcars-sunflower)" />
      </LCARSPanel>
    </div>
  )
}

function getEffectiveStatus(pipeline) {
  if (pipeline.status === 'error') return 'error'
  if (pipeline.status === 'syncing') return 'syncing'
  if (!pipeline.last_sync) return 'unknown'

  const minutesAgo = (Date.now() - new Date(pipeline.last_sync).getTime()) / 60000
  const threshold = pipeline.name === 'health'
    ? STALE_THRESHOLDS.health
    : STALE_THRESHOLDS.default

  if (minutesAgo > threshold) return 'stale'
  return 'synced'
}

function formatRelativeTime(ts) {
  if (!ts) return 'NEVER'
  const diffMs = Date.now() - new Date(ts).getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return 'NOW'
  if (diffMin < 60) return `${diffMin}M AGO`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}H AGO`
  return `${Math.floor(diffMin / 1440)}D AGO`
}
