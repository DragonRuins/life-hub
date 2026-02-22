/**
 * LCARSAstroLaunches.jsx - Mission Operations (LCARS Launches Tab)
 *
 * LCARS-styled launch tracker with:
 *   - Next launch hero with T-minus countdown in JetBrains Mono
 *   - Upcoming missions list
 *   - Past missions (collapsible)
 *   - LCARS status badges and provider pills
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { astrometrics as api } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from '../../themes/lcars/LCARSPanel'
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

const STATUS_COLORS = {
  1: { bg: 'rgba(102, 204, 0, 0.2)', color: 'var(--lcars-green, #66CC00)', label: 'Go' },
  2: { bg: 'rgba(255, 204, 102, 0.2)', color: 'var(--lcars-tanoi)', label: 'TBD' },
  3: { bg: 'rgba(102, 204, 0, 0.2)', color: 'var(--lcars-green, #66CC00)', label: 'Success' },
  4: { bg: 'rgba(204, 0, 0, 0.3)', color: 'var(--lcars-red-alert)', label: 'Failure' },
  5: { bg: 'rgba(255, 153, 102, 0.2)', color: 'var(--lcars-butterscotch)', label: 'Hold' },
  6: { bg: 'rgba(153, 204, 255, 0.2)', color: 'var(--lcars-ice)', label: 'In Flight' },
  7: { bg: 'rgba(255, 204, 102, 0.2)', color: 'var(--lcars-tanoi)', label: 'Partial' },
}

function getStatus(id) { return STATUS_COLORS[id] || STATUS_COLORS[2] }

export default function LCARSAstroLaunches() {
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
        api.launches.upcoming(15), api.launches.past(10), api.launches.next(),
      ])
      if (upRes.status === 'fulfilled') setUpcoming(upRes.value)
      if (pastRes.status === 'fulfilled') setPast(pastRes.value)
      if (nextRes.status === 'fulfilled') setNextLaunch(nextRes.value)
    } catch (e) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const launch = nextLaunch?.data
    if (!launch?.net) { setCountdown(null); return }
    const update = () => {
      const diff = new Date(launch.net) - new Date()
      if (diff <= 0) { setCountdown({ passed: true }); return }
      setCountdown({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        passed: false,
      })
    }
    update()
    intervalRef.current = setInterval(update, 1000)
    return () => clearInterval(intervalRef.current)
  }, [nextLaunch])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '3rem', fontFamily: "'Antonio', sans-serif",
      color: 'var(--lcars-sunflower)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
      Accessing mission database...
    </div>
  )

  const nextData = nextLaunch?.data || {}
  // Filter out completed launches (3=Success, 4=Failure, 7=Partial) that the
  // API may keep in the upcoming list for a while after mission completion
  const COMPLETED_STATUSES = new Set([3, 4, 7])
  const upcomingList = (upcoming?.data?.results || []).filter(
    l => !COMPLETED_STATUSES.has(l.status?.id)
  )
  const pastList = past?.data?.results || []

  return (
    <div>
      {/* Next Launch Hero */}
      {nextData.name && (
        <LCARSPanel title="Next Mission" color="var(--lcars-sunflower)" style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {nextData.image && (
              <img src={nextData.image} alt="" style={{
                width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', opacity: 0.9,
              }} />
            )}
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{
                fontFamily: "'Antonio', sans-serif", fontSize: '1.1rem',
                color: 'var(--lcars-sunflower)', textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '0.25rem',
              }}>
                {nextData.name}
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                color: 'var(--lcars-gray)', marginBottom: '0.5rem',
              }}>
                {nextData.launch_service_provider?.name}
                {nextData.pad?.name && ` \u2022 ${nextData.pad.name}`}
              </div>

              {/* Countdown */}
              {countdown && !countdown.passed && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '1.75rem',
                  fontWeight: 700, color: 'var(--lcars-gold)',
                  letterSpacing: '0.05em', margin: '0.5rem 0',
                }}>
                  T - {String(countdown.d).padStart(3, '0')} : {String(countdown.h).padStart(2, '0')} : {String(countdown.m).padStart(2, '0')} : {String(countdown.s).padStart(2, '0')}
                </div>
              )}
              {countdown?.passed && (
                <div style={{
                  fontFamily: "'Antonio', sans-serif", fontSize: '1rem',
                  color: 'var(--lcars-tanoi)', textTransform: 'uppercase',
                  margin: '0.5rem 0',
                }}>
                  Launch window reached
                </div>
              )}

              {nextData.mission?.description && (
                <div style={{
                  fontSize: '0.8rem', color: 'var(--lcars-space-white)',
                  lineHeight: 1.5, marginTop: '0.5rem',
                }}>
                  {nextData.mission.description.slice(0, 250)}
                  {nextData.mission.description.length > 250 ? '...' : ''}
                </div>
              )}

              {/* Links */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '0.5rem' }}>
                {nextData.vidURLs?.[0]?.url && (
                  <a href={nextData.vidURLs[0].url} target="_blank" rel="noopener noreferrer"
                    style={{
                      padding: '0.25rem 0.75rem', background: 'var(--lcars-ice)',
                      borderRadius: '999px', color: '#000', textDecoration: 'none',
                      fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
                      textTransform: 'uppercase', display: 'inline-flex',
                      alignItems: 'center', gap: '0.25rem',
                    }}>
                    <ExternalLink size={12} /> Webcast
                  </a>
                )}
              </div>
            </div>
          </div>
        </LCARSPanel>
      )}

      {/* Upcoming */}
      <LCARSPanel title={`Upcoming Missions (${upcomingList.length})`} color="var(--lcars-sunflower)" noPadding style={{ marginBottom: '8px' }}>
        {upcomingList.map((launch, i) => (
          <LCARSLaunchRow key={launch.id} launch={launch} index={i} />
        ))}
      </LCARSPanel>

      {/* Past */}
      <div style={{ marginTop: '4px' }}>
        <button onClick={() => setShowPast(!showPast)} style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          padding: '0.3rem 0.75rem', background: 'var(--lcars-gray)',
          border: 'none', borderRadius: '999px', color: '#000',
          cursor: 'pointer', fontFamily: "'Antonio', sans-serif",
          fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em',
          opacity: 0.8, marginBottom: '8px',
        }}>
          {showPast ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Past Missions ({pastList.length})
        </button>
        {showPast && (
          <LCARSPanel title="Mission Archive" color="var(--lcars-almond-creme)" noPadding>
            {pastList.map((launch, i) => (
              <LCARSLaunchRow key={launch.id} launch={launch} isPast index={i} />
            ))}
          </LCARSPanel>
        )}
      </div>
    </div>
  )
}

function LCARSLaunchRow({ launch, isPast = false, index = 0 }) {
  const status = getStatus(launch.status?.id)

  return (
    <div style={{
      display: 'flex', gap: '0.75rem', alignItems: 'center',
      padding: '0.5rem 0.75rem',
      borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
      opacity: isPast ? 0.75 : 1,
      background: index % 2 !== 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
    }}>
      {launch.image && (
        <img src={launch.image} alt="" style={{
          width: '36px', height: '36px', objectFit: 'cover',
          borderRadius: '4px', opacity: 0.85, flexShrink: 0,
        }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
          color: 'var(--lcars-space-white)', textTransform: 'uppercase',
          letterSpacing: '0.03em', whiteSpace: 'nowrap', overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {launch.name}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
          color: 'var(--lcars-gray)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
        }}>
          <span>{launch.launch_service_provider?.name || 'TBD'}</span>
          <span>{launch.net ? new Date(launch.net).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'TBD'}</span>
        </div>
      </div>
      <span style={{
        padding: '0.125rem 0.5rem', borderRadius: '999px', fontSize: '0.65rem',
        fontWeight: 600, background: status.bg, color: status.color,
        fontFamily: "'Antonio', sans-serif", textTransform: 'uppercase',
        letterSpacing: '0.05em', flexShrink: 0, whiteSpace: 'nowrap',
      }}>
        {status.label}
      </span>
    </div>
  )
}
