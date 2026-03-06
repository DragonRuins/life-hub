/**
 * WatchBarometer - Barometric pressure timeline (Catppuccin theme).
 *
 * Shows pressure/altitude dual-axis chart with stats cards
 * and timeframe selector.
 *
 * Route: /watch/barometer
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { watchBarometer } from '../api/watchApi'
import BarometerChart from '../components/watch/BarometerChart'

const TIMEFRAMES = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
]

export default function WatchBarometer() {
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

        const result = await watchBarometer.query({
          start: start.toISOString(),
          end,
        })

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

  // Compute stats from data
  const stats = computeStats(data)

  return (
    <div style={{ maxWidth: '1200px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={22} style={{ color: 'var(--color-blue)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Barometer
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
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '3px solid var(--color-red)' }}>
          <p style={{ color: 'var(--color-red)', fontSize: '0.85rem' }}>Failed to load data: {error}</p>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : data.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <BarChart3 size={32} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)' }}>No barometric data for the selected timeframe.</p>
        </div>
      ) : (
        <>
          {/* Stats cards */}
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}>
              <StatCard label="Current" value={stats.currentPressure} unit="hPa" icon={<Activity size={16} />} color="var(--color-blue)" />
              <StatCard label="Min" value={stats.minPressure} unit="hPa" icon={<TrendingDown size={16} />} color="var(--color-green)" />
              <StatCard label="Max" value={stats.maxPressure} unit="hPa" icon={<TrendingUp size={16} />} color="var(--color-red)" />
              <StatCard label="Trend" value={stats.trend} unit="" icon={<Activity size={16} />} color="var(--color-peach)" />
            </div>
          )}

          {/* Chart */}
          <div className="card">
            <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-subtext-0)' }}>
              Pressure & Altitude
            </h3>
            <BarometerChart data={data} height={300} />
          </div>
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

  // Simple trend based on first vs last
  const first = pressures[0]
  const diff = current - first
  let trend = 'Stable'
  if (diff > 2) trend = 'Rising'
  else if (diff < -2) trend = 'Falling'

  return {
    currentPressure: current.toFixed(1),
    minPressure: min.toFixed(1),
    maxPressure: max.toFixed(1),
    trend,
  }
}

function StatCard({ label, value, unit, icon, color }) {
  return (
    <div className="card" style={{ padding: '0.75rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.375rem', color }}>
        {icon}
        <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</span>
        {unit && <span style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)' }}>{unit}</span>}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: '70px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
        ))}
      </div>
      <div style={{ height: '350px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
    </>
  )
}
