/**
 * LCARSFooter.jsx - LCARS Bottom Status Bar
 *
 * The bottom bar connects to the sidebar via the bottom-left elbow.
 * Contains segmented colored blocks showing live status readouts:
 *   - Stardate (computed from real date)
 *   - Current time (24h, updates every second)
 *   - Notification count
 *   - Vehicle count
 *   - Notes count
 *   - Decorative end cap
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { dashboard, notifications, infrastructure } from '../../api/client'
import { useTheme } from './ThemeProvider'

/**
 * Calculate a Star Trek-style stardate from a UTC date.
 * Format: YYYY.DDD.HH where DDD is the UTC day of year and HH is the UTC hour.
 * Updates every hour so it visibly ticks throughout the day.
 */
function calculateStardate(date = new Date()) {
  const year = date.getUTCFullYear()
  const startOfYear = Date.UTC(year, 0, 1)
  const dayOfYear = Math.floor((date.getTime() - startOfYear) / 86400000) + 1
  const hour = date.getUTCHours()
  return `${year}.${String(dayOfYear).padStart(3, '0')}.${String(hour).padStart(2, '0')}`
}

/**
 * Format time in 24-hour UTC: HH:MM:SS
 */
function formatUTC(date = new Date()) {
  return date.toISOString().slice(11, 19)
}

export default function LCARSFooter() {
  const { isModernLCARS } = useTheme()
  const [utc, setUtc] = useState(formatUTC())
  const [stardate, setStardate] = useState(calculateStardate())
  const [unreadCount, setUnreadCount] = useState(0)
  const [vehicleCount, setVehicleCount] = useState(0)
  const [notesCount, setNotesCount] = useState(0)
  const [infraStatus, setInfraStatus] = useState({ hosts: 0, containers: 0 })
  const pollTimerRef = useRef(null)

  // Track previous UTC time for digit roll animation
  const prevUtcRef = useRef(utc)
  // Track which character indices changed on this tick
  const [changedIndices, setChangedIndices] = useState(new Set())

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      const newUtc = formatUTC(now)
      setUtc(prev => {
        // Compare old vs new character-by-character
        const changed = new Set()
        for (let i = 0; i < newUtc.length; i++) {
          if (newUtc[i] !== prev[i]) changed.add(i)
        }
        if (changed.size > 0) setChangedIndices(changed)
        prevUtcRef.current = prev
        return newUtc
      })
      setStardate(calculateStardate(now))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Clear the changed indices after the animation completes (200ms)
  useEffect(() => {
    if (changedIndices.size === 0) return
    const timer = setTimeout(() => setChangedIndices(new Set()), 250)
    return () => clearTimeout(timer)
  }, [changedIndices])

  // Fetch real data from API on mount and every 30 seconds
  const fetchData = useCallback(async () => {
    try {
      const [summaryData, unreadData, infraData] = await Promise.all([
        dashboard.getSummary().catch(() => null),
        notifications.unreadCount().catch(() => ({ count: 0 })),
        infrastructure.dashboard().catch(() => null),
      ])
      if (summaryData) {
        setVehicleCount(summaryData.vehicles?.count || 0)
        setNotesCount(summaryData.notes?.count || 0)
      }
      setUnreadCount(unreadData?.count || 0)
      if (infraData) {
        setInfraStatus({
          hosts: infraData.hosts?.total || 0,
          containers: infraData.containers?.by_status?.running || 0,
        })
      }
    } catch {
      // Silently fail for background polling
    }
  }, [])

  useEffect(() => {
    fetchData()
    pollTimerRef.current = setInterval(fetchData, 30000)
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [fetchData])

  return (
    <div className="lcars-row" style={{ height: '100%', gap: '3px', background: 'var(--lcars-bg, #000)' }}>
      {/* Stardate + UTC time segment with digit roll on time changes */}
      <div
        className="lcars-bar fill lcars-bg-african-violet"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 0.5rem',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            color: 'var(--lcars-text-on-color)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {`SD ${stardate} // `}
          {utc.split('').map((char, i) => (
            <span
              key={`${i}-${char}`}
              className={changedIndices.has(i) ? 'lcars-digit-roll' : undefined}
              style={{ display: 'inline-block' }}
            >
              {char}
            </span>
          ))}
          {' UTC'}
        </span>
      </div>

      {/* Notifications segment */}
      <StatusSegment
        label={unreadCount > 0 ? `${unreadCount} ALERT${unreadCount !== 1 ? 'S' : ''}` : 'ALL CLEAR'}
        color={unreadCount > 0 ? 'var(--lcars-butterscotch)' : 'var(--lcars-green)'}
        width="130px"
      />

      {/* Infrastructure segment */}
      <StatusSegment
        label={`${infraStatus.hosts} HOST${infraStatus.hosts !== 1 ? 'S' : ''} // ${infraStatus.containers} RUNNING`}
        color="var(--lcars-tanoi)"
        width="180px"
        mono
      />

      {/* Vehicle count segment */}
      <StatusSegment
        label={`${vehicleCount} VEHICLE${vehicleCount !== 1 ? 'S' : ''}`}
        color="var(--lcars-sunflower)"
        width="130px"
      />

      {/* Notes count segment */}
      <StatusSegment
        label={`${notesCount} NOTE${notesCount !== 1 ? 'S' : ''}`}
        color="var(--lcars-almond-creme)"
        width="110px"
      />

      {/* Decorative end cap — rounded in Classic, flat in Modern (meets BR elbow) */}
      <div
        className="lcars-bar lcars-bg-african-violet"
        style={{
          width: '80px',
          borderRadius: isModernLCARS ? '0' : '0 30px 30px 0',
        }}
      />
    </div>
  )
}


/**
 * Individual status segment in the footer bar.
 * A colored block with black text showing a label/readout.
 */
function StatusSegment({ label, color, width, flex, mono }) {
  return (
    <div
      className="lcars-bar"
      style={{
        width: width || 'auto',
        flex: flex || 'none',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 0.5rem',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          color: 'var(--lcars-text-on-color)',
          fontFamily: mono
            ? "'JetBrains Mono', monospace"
            : "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '0.75rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: mono ? '0' : '0.08em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
    </div>
  )
}
