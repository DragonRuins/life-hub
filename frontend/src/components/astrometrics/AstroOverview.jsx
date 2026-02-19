/**
 * AstroOverview.jsx - Astrometrics Overview Tab (Catppuccin Theme)
 *
 * Dashboard-style overview with 5 widget cards:
 *   1. APOD preview (today's Astronomy Picture of the Day)
 *   2. Next launch countdown (live ticking)
 *   3. ISS position (lat/lng + humans in space)
 *   4. NEO alert (object count + closest approach + hazardous count)
 *   5. Humans in space (total + crew grouped by craft)
 *
 * All API refreshes pause when the tab is hidden (Page Visibility API).
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { astrometrics as api } from '../../api/client'
import { Image, Rocket, Satellite, AlertTriangle, Users } from 'lucide-react'

export default function AstroOverview() {
  const [apod, setApod] = useState(null)
  const [nextLaunch, setNextLaunch] = useState(null)
  const [issPosition, setIssPosition] = useState(null)
  const [neoData, setNeoData] = useState(null)
  const [crew, setCrew] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [countdown, setCountdown] = useState(null)

  const intervalRef = useRef(null)
  const pollRef = useRef(null)

  // Load all data
  const loadData = useCallback(async () => {
    try {
      const [apodRes, launchRes, issRes, neoRes, crewRes] = await Promise.allSettled([
        api.apod.get(),
        api.launches.next(),
        api.iss.position(),
        api.neo.feed(),
        api.iss.crew(),
      ])

      if (apodRes.status === 'fulfilled') setApod(apodRes.value)
      if (launchRes.status === 'fulfilled') setNextLaunch(launchRes.value)
      if (issRes.status === 'fulfilled') setIssPosition(issRes.value)
      if (neoRes.status === 'fulfilled') setNeoData(neoRes.value)
      if (crewRes.status === 'fulfilled') setCrew(crewRes.value)

      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()

    // Poll ISS position every 15 seconds, others every 5 minutes
    pollRef.current = setInterval(() => {
      if (!document.hidden) {
        api.iss.position().then(setIssPosition).catch(() => {})
      }
    }, 15000)

    const refreshAll = setInterval(() => {
      if (!document.hidden) loadData()
    }, 300000)

    return () => {
      clearInterval(pollRef.current)
      clearInterval(refreshAll)
    }
  }, [loadData])

  // Countdown timer (ticks every second, always runs client-side)
  useEffect(() => {
    const launchData = nextLaunch?.data
    if (!launchData?.net) {
      setCountdown(null)
      return
    }

    const updateCountdown = () => {
      const now = new Date()
      const launchTime = new Date(launchData.net)
      const diff = launchTime - now

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, passed: true })
        return
      }

      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        passed: false,
      })
    }

    updateCountdown()
    intervalRef.current = setInterval(updateCountdown, 1000)
    return () => clearInterval(intervalRef.current)
  }, [nextLaunch])

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-subtext-0)' }}>
        Loading astrometrics data...
      </div>
    )
  }

  // Parse data for display
  const apodData = apod?.data || {}
  const launchData = nextLaunch?.data || {}
  const issData = issPosition?.data || {}
  const issPos = issData?.iss_position || {}
  const neoObjects = neoData?.data?.near_earth_objects || {}
  const crewData = crew || {}

  // Count NEOs and hazardous
  let neoCount = 0
  let hazardousCount = 0
  let closestLd = Infinity
  let closestName = ''
  Object.values(neoObjects).forEach(dayNeos => {
    dayNeos.forEach(neo => {
      neoCount++
      if (neo.is_potentially_hazardous_asteroid) hazardousCount++
      neo.close_approach_data?.forEach(approach => {
        const ld = parseFloat(approach.miss_distance?.lunar || '999')
        if (ld < closestLd) {
          closestLd = ld
          closestName = neo.name
        }
      })
    })
  })

  return (
    <div className="card-grid" style={{ '--min-card-width': '280px' }}>
      {/* APOD Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'rgba(203, 166, 247, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Image size={18} style={{ color: 'var(--color-mauve)' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Picture of the Day</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
              {apodData.date || 'Loading...'}
            </p>
          </div>
        </div>
        {apodData.url && apodData.media_type === 'image' && (
          <img
            src={apodData.url}
            alt={apodData.title}
            style={{
              width: '100%', height: '160px', objectFit: 'cover',
              borderRadius: '6px', marginBottom: '0.5rem',
            }}
          />
        )}
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>
          {apodData.title || 'No APOD available'}
        </p>
        {apodData.copyright && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: 'var(--color-subtext-0)' }}>
            {apodData.copyright}
          </p>
        )}
      </div>

      {/* Next Launch Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'rgba(166, 227, 161, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Rocket size={18} style={{ color: 'var(--color-green)' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Next Launch</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
              {launchData.launch_service_provider?.name || 'TBD'}
            </p>
          </div>
        </div>
        <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
          {launchData.name || 'No upcoming launch'}
        </p>
        {countdown && !countdown.passed && (
          <div style={{
            display: 'flex', gap: '0.5rem', justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace", fontSize: '1.25rem',
            fontWeight: 700, color: 'var(--color-green)',
          }}>
            <span>{String(countdown.days).padStart(2, '0')}d</span>
            <span>:</span>
            <span>{String(countdown.hours).padStart(2, '0')}h</span>
            <span>:</span>
            <span>{String(countdown.minutes).padStart(2, '0')}m</span>
            <span>:</span>
            <span>{String(countdown.seconds).padStart(2, '0')}s</span>
          </div>
        )}
        {countdown?.passed && (
          <p style={{ textAlign: 'center', color: 'var(--color-yellow)', fontWeight: 600 }}>
            Launch window reached
          </p>
        )}
      </div>

      {/* ISS Position Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'rgba(137, 180, 250, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Satellite size={18} style={{ color: 'var(--color-blue)' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>ISS Position</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
              International Space Station
            </p>
          </div>
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.9rem',
          display: 'flex', flexDirection: 'column', gap: '0.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-subtext-0)' }}>Lat:</span>
            <span>{parseFloat(issPos.latitude || 0).toFixed(4)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-subtext-0)' }}>Lng:</span>
            <span>{parseFloat(issPos.longitude || 0).toFixed(4)}</span>
          </div>
        </div>
      </div>

      {/* NEO Alert Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: hazardousCount > 0 ? 'rgba(243, 139, 168, 0.12)' : 'rgba(249, 226, 175, 0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={18} style={{
              color: hazardousCount > 0 ? 'var(--color-red)' : 'var(--color-yellow)'
            }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Near Earth Objects</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
              This week
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-subtext-0)' }}>Total objects:</span>
            <span style={{ fontWeight: 600 }}>{neoCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--color-subtext-0)' }}>Hazardous:</span>
            <span style={{ fontWeight: 600, color: hazardousCount > 0 ? 'var(--color-red)' : 'inherit' }}>
              {hazardousCount}
            </span>
          </div>
          {closestLd < Infinity && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-subtext-0)' }}>Closest:</span>
              <span style={{ fontWeight: 600 }}>{closestLd.toFixed(2)} LD</span>
            </div>
          )}
        </div>
      </div>

      {/* Humans in Space Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'rgba(148, 226, 213, 0.12)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Users size={18} style={{ color: 'var(--color-teal)' }} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Humans in Space</h3>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
              Currently in orbit
            </p>
          </div>
        </div>
        <div style={{
          fontSize: '2rem', fontWeight: 700, textAlign: 'center',
          color: 'var(--color-teal)', marginBottom: '0.5rem',
        }}>
          {crewData.total || 0}
        </div>
        {crewData.grouped && Object.entries(crewData.grouped).map(([craft, names]) => (
          <div key={craft} style={{ marginBottom: '0.375rem' }}>
            <div style={{
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-blue)',
              textTransform: 'uppercase', marginBottom: '0.125rem',
            }}>
              {craft}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
              {names.join(', ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
