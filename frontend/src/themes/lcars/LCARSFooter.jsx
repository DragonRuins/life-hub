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
import { dashboard, notifications } from '../../api/client'

/**
 * Calculate a Star Trek-style stardate from a real date.
 * Format: YYYY.DDD where DDD is the day of year (zero-padded to 3 digits).
 */
function calculateStardate(date = new Date()) {
  const year = date.getFullYear()
  const start = new Date(year, 0, 0)
  const diff = date - start
  const oneDay = 1000 * 60 * 60 * 24
  const dayOfYear = Math.floor(diff / oneDay)
  return `${year}.${String(dayOfYear).padStart(3, '0')}`
}

/**
 * Format time in 24-hour UTC: HH:MM:SS
 */
function formatUTC(date = new Date()) {
  return date.toISOString().slice(11, 19)
}

export default function LCARSFooter() {
  const [utc, setUtc] = useState(formatUTC())
  const [stardate, setStardate] = useState(calculateStardate())
  const [unreadCount, setUnreadCount] = useState(0)
  const [vehicleCount, setVehicleCount] = useState(0)
  const [notesCount, setNotesCount] = useState(0)
  const pollTimerRef = useRef(null)

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setUtc(formatUTC(now))
      setStardate(calculateStardate(now))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch real data from API on mount and every 30 seconds
  const fetchData = useCallback(async () => {
    try {
      const [summaryData, unreadData] = await Promise.all([
        dashboard.getSummary().catch(() => null),
        notifications.unreadCount().catch(() => ({ count: 0 })),
      ])
      if (summaryData) {
        setVehicleCount(summaryData.vehicles?.count || 0)
        setNotesCount(summaryData.notes?.count || 0)
      }
      setUnreadCount(unreadData?.count || 0)
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
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        height: '100%',
        background: '#000000',
        gap: '3px',
      }}
    >
      {/* Stardate + UTC time segment */}
      <StatusSegment
        label={`SD ${stardate} // ${utc} UTC`}
        color="var(--lcars-african-violet)"
        flex={1}
        mono
      />

      {/* Notifications segment */}
      <StatusSegment
        label={unreadCount > 0 ? `${unreadCount} ALERT${unreadCount !== 1 ? 'S' : ''}` : 'ALL CLEAR'}
        color={unreadCount > 0 ? 'var(--lcars-butterscotch)' : 'var(--lcars-green)'}
        width="130px"
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

      {/* Decorative end cap (rounded right side) */}
      <div
        style={{
          width: '80px',
          background: 'var(--lcars-african-violet)',
          borderRadius: '0 30px 30px 0',
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
          color: '#000000',
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
