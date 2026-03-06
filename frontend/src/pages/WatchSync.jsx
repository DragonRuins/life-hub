/**
 * WatchSync - Sync status dashboard (Catppuccin theme).
 *
 * Displays the health of the watch data pipeline with
 * per-source status cards, manual refresh, and 60s auto-refresh.
 *
 * Route: /watch/sync
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { watchSync } from '../api/watchApi'
import SyncStatusPanel from '../components/watch/SyncStatusPanel'

export default function WatchSync() {
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

  // Initial load
  useEffect(() => {
    loadData()
  }, [])

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

  return (
    <div style={{ maxWidth: '1000px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to="/watch"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem',
            marginBottom: '0.5rem',
          }}
        >
          <ChevronLeft size={16} />
          Watch Data
        </Link>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={22} style={{ color: 'var(--color-green)' }} />
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
              Sync Status
            </h1>
          </div>

          {/* Refresh button + timestamp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {lastRefreshed && (
              <span style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)' }}>
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <button
              className="btn btn-ghost"
              onClick={handleManualRefresh}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                fontSize: '0.8rem',
              }}
            >
              <RefreshCw
                size={14}
                style={{
                  animation: refreshing ? 'spin 1s linear infinite' : 'none',
                }}
              />
              Refresh
            </button>
          </div>
        </div>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Watch data pipeline health &bull; Auto-refreshes every 60s
        </p>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '3px solid var(--color-red)' }}>
          <p style={{ color: 'var(--color-red)', fontSize: '0.85rem' }}>Failed to load sync status: {error}</p>
        </div>
      )}

      <SyncStatusPanel pipelines={pipelines} loading={loading} />

      {/* Summary */}
      {!loading && syncData && (
        <div className="card" style={{ marginTop: '1.5rem', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-subtext-0)', marginBottom: '0.5rem' }}>
            Sync Thresholds
          </h3>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div>
              <span style={{ color: 'var(--color-green)' }}>&bull;</span> Health data: stale after <strong>30 min</strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-green)' }}>&bull;</span> Other pipelines: stale after <strong>1 hour</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
