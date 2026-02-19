/**
 * AstroLaunches.jsx - Launches Tab (Catppuccin Theme)
 *
 * Features:
 *   - Next launch hero card with live countdown
 *   - Upcoming launches list with status badges
 *   - Past launches (collapsible)
 *   - Provider badges with color coding
 *   - Mission patch images, webcast/article links
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { astrometrics as api } from '../../api/client'
import { Rocket, ExternalLink, ChevronDown, ChevronUp, Clock, MapPin } from 'lucide-react'

// Status badge colors
const STATUS_COLORS = {
  1: { bg: 'rgba(166, 227, 161, 0.15)', text: 'var(--color-green)', label: 'Go' },       // Go for launch
  2: { bg: 'rgba(249, 226, 175, 0.15)', text: 'var(--color-yellow)', label: 'TBD' },      // TBD
  3: { bg: 'rgba(166, 227, 161, 0.15)', text: 'var(--color-green)', label: 'Success' },    // Success
  4: { bg: 'rgba(243, 139, 168, 0.15)', text: 'var(--color-red)', label: 'Failure' },      // Failure
  5: { bg: 'rgba(249, 226, 175, 0.15)', text: 'var(--color-yellow)', label: 'Hold' },      // Hold
  6: { bg: 'rgba(137, 180, 250, 0.15)', text: 'var(--color-blue)', label: 'In Flight' },   // In Flight
  7: { bg: 'rgba(166, 227, 161, 0.15)', text: 'var(--color-green)', label: 'Partial' },    // Partial Failure
}

function getStatusBadge(statusId) {
  const s = STATUS_COLORS[statusId] || STATUS_COLORS[2]
  return s
}

function formatCountdown(diff) {
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return { d, h, m, s }
}

export default function AstroLaunches() {
  const [upcoming, setUpcoming] = useState(null)
  const [past, setPast] = useState(null)
  const [nextLaunch, setNextLaunch] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showPast, setShowPast] = useState(false)
  const intervalRef = useRef(null)

  const loadData = useCallback(async () => {
    try {
      const [upRes, pastRes, nextRes] = await Promise.allSettled([
        api.launches.upcoming(15),
        api.launches.past(10),
        api.launches.next(),
      ])
      if (upRes.status === 'fulfilled') setUpcoming(upRes.value)
      if (pastRes.status === 'fulfilled') setPast(pastRes.value)
      if (nextRes.status === 'fulfilled') setNextLaunch(nextRes.value)
    } catch (e) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Countdown ticks every second
  useEffect(() => {
    const launch = nextLaunch?.data
    if (!launch?.net) { setCountdown(null); return }
    const update = () => {
      const diff = new Date(launch.net) - new Date()
      setCountdown(diff > 0 ? formatCountdown(diff) : { d: 0, h: 0, m: 0, s: 0, passed: true })
    }
    update()
    intervalRef.current = setInterval(update, 1000)
    return () => clearInterval(intervalRef.current)
  }, [nextLaunch])

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-subtext-0)' }}>Loading launch data...</div>

  const nextData = nextLaunch?.data || {}
  const upcomingList = upcoming?.data?.results || []
  const pastList = past?.data?.results || []

  return (
    <div>
      {/* Next Launch Hero */}
      {nextData.name && (
        <div className="card" style={{ marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          {/* Mission patch background */}
          {nextData.image && (
            <div style={{
              position: 'absolute', top: 0, right: 0, width: '200px', height: '100%',
              backgroundImage: `url(${nextData.image})`, backgroundSize: 'cover',
              backgroundPosition: 'center', opacity: 0.15, pointerEvents: 'none',
            }} />
          )}

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Rocket size={20} style={{ color: 'var(--color-green)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Next Launch
              </span>
              {nextData.status && (
                <span style={{
                  padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem',
                  fontWeight: 600, background: getStatusBadge(nextData.status.id).bg,
                  color: getStatusBadge(nextData.status.id).text,
                }}>
                  {getStatusBadge(nextData.status.id).label}
                </span>
              )}
            </div>

            <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.35rem', fontWeight: 700 }}>
              {nextData.name}
            </h2>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: 'var(--color-subtext-0)' }}>
              {nextData.launch_service_provider?.name}
              {nextData.pad?.name && ` \u2022 ${nextData.pad.name}`}
            </p>

            {/* Countdown */}
            {countdown && !countdown.passed && (
              <div style={{
                display: 'flex', gap: '0.75rem', justifyContent: 'center',
                padding: '1rem 0', marginBottom: '0.5rem',
              }}>
                {[
                  { val: countdown.d, label: 'Days' },
                  { val: countdown.h, label: 'Hours' },
                  { val: countdown.m, label: 'Min' },
                  { val: countdown.s, label: 'Sec' },
                ].map(({ val, label }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '2rem',
                      fontWeight: 700, color: 'var(--color-green)',
                      lineHeight: 1,
                    }}>
                      {String(val).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase', marginTop: '0.25rem' }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {countdown?.passed && (
              <p style={{ textAlign: 'center', color: 'var(--color-yellow)', fontWeight: 600, fontSize: '1rem' }}>
                Launch window reached
              </p>
            )}

            {/* Mission description */}
            {nextData.mission?.description && (
              <p style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: 'var(--color-subtext-1)', lineHeight: 1.5 }}>
                {nextData.mission.description.slice(0, 300)}
                {nextData.mission.description.length > 300 ? '...' : ''}
              </p>
            )}

            {/* Links */}
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              {nextData.vidURLs?.[0]?.url && (
                <a href={nextData.vidURLs[0].url} target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>
                  <ExternalLink size={14} /> Webcast
                </a>
              )}
              {nextData.infoURLs?.[0]?.url && (
                <a href={nextData.infoURLs[0].url} target="_blank" rel="noopener noreferrer"
                  className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>
                  <ExternalLink size={14} /> Info
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Launches */}
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        Upcoming Launches ({upcomingList.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {upcomingList.map(launch => (
          <LaunchCard key={launch.id} launch={launch} />
        ))}
      </div>

      {/* Past Launches */}
      <button
        className="btn btn-ghost"
        onClick={() => setShowPast(!showPast)}
        style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
      >
        {showPast ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        Past Launches ({pastList.length})
      </button>
      {showPast && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {pastList.map(launch => (
            <LaunchCard key={launch.id} launch={launch} isPast />
          ))}
        </div>
      )}
    </div>
  )
}


function LaunchCard({ launch, isPast = false }) {
  const status = getStatusBadge(launch.status?.id)

  return (
    <div className="card" style={{
      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
      opacity: isPast ? 0.8 : 1,
    }}>
      {/* Patch image */}
      {launch.image && (
        <img src={launch.image} alt="" style={{
          width: '56px', height: '56px', objectFit: 'cover',
          borderRadius: '8px', flexShrink: 0,
        }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{launch.name}</span>
          <span style={{
            padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem',
            fontWeight: 600, background: status.bg, color: status.text,
          }}>
            {status.label}
          </span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Rocket size={12} /> {launch.launch_service_provider?.name || 'TBD'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <Clock size={12} /> {launch.net ? new Date(launch.net).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}
          </span>
          {launch.pad?.name && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <MapPin size={12} /> {launch.pad.name}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
