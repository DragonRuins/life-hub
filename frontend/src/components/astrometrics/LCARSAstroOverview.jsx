/**
 * LCARSAstroOverview.jsx - Astrometrics Sensor Overview (LCARS Theme)
 *
 * Five tactical readout panels styled as LCARS sensor displays:
 *   1. Stellar Cartography (APOD preview)
 *   2. Launch Operations (countdown)
 *   3. Station Tracking (ISS coordinates)
 *   4. Threat Assessment (NEO summary)
 *   5. Crew Manifest (humans in space)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { astrometrics as api } from '../../api/client'
import LCARSPanel, { LCARSDataRow, LCARSStat } from '../../themes/lcars/LCARSPanel'

/**
 * Format a countdown string: "014D 05H 11M 08S"
 * Returns the formatted string for character-level diffing.
 */
function formatCountdown(cd) {
  if (!cd || cd.passed) return null
  return `T-${String(cd.d).padStart(2,'0')}D ${String(cd.h).padStart(2,'0')}H ${String(cd.m).padStart(2,'0')}M ${String(cd.s).padStart(2,'0')}S`
}

export default function LCARSAstroOverview() {
  const [apod, setApod] = useState(null)
  const [nextLaunch, setNextLaunch] = useState(null)
  const [issPosition, setIssPosition] = useState(null)
  const [neoData, setNeoData] = useState(null)
  const [crew, setCrew] = useState(null)
  const [loading, setLoading] = useState(true)
  const [countdown, setCountdown] = useState(null)

  // Track previous countdown string for digit roll animation
  const prevCountdownStr = useRef('')
  const [countdownChanged, setCountdownChanged] = useState(new Set())

  const intervalRef = useRef(null)
  const pollRef = useRef(null)

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
    } catch (e) {
      // Errors handled per-widget
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    pollRef.current = setInterval(() => {
      if (!document.hidden) api.iss.position().then(setIssPosition).catch(() => {})
    }, 15000)
    const refreshAll = setInterval(() => {
      if (!document.hidden) loadData()
    }, 300000)
    return () => { clearInterval(pollRef.current); clearInterval(refreshAll) }
  }, [loadData])

  // Countdown timer
  useEffect(() => {
    const launchData = nextLaunch?.data
    if (!launchData?.net) { setCountdown(null); return }
    const update = () => {
      const diff = new Date(launchData.net) - new Date()
      if (diff <= 0) { setCountdown({ d: 0, h: 0, m: 0, s: 0, passed: true }); return }
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

  // Compute which countdown characters changed for digit roll
  useEffect(() => {
    const str = formatCountdown(countdown) || ''
    const changed = new Set()
    for (let i = 0; i < str.length; i++) {
      if (str[i] !== prevCountdownStr.current[i]) changed.add(i)
    }
    prevCountdownStr.current = str
    if (changed.size > 0) {
      setCountdownChanged(changed)
      const timer = setTimeout(() => setCountdownChanged(new Set()), 250)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  if (loading) {
    return (
      <div style={{
        textAlign: 'center', padding: '3rem',
        fontFamily: "'Antonio', sans-serif", fontSize: '1rem',
        color: 'var(--lcars-ice)', textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        Scanning all frequencies...
      </div>
    )
  }

  const apodData = apod?.data || {}
  const launchData = nextLaunch?.data || {}
  const issData = issPosition?.data || {}
  const issPos = issData?.iss_position || {}
  const neoObjects = neoData?.data?.near_earth_objects || {}
  const crewData = crew || {}

  // Parse NEO stats
  let neoCount = 0, hazardousCount = 0, closestLd = Infinity
  Object.values(neoObjects).forEach(dayNeos => {
    dayNeos.forEach(neo => {
      neoCount++
      if (neo.is_potentially_hazardous_asteroid) hazardousCount++
      neo.close_approach_data?.forEach(a => {
        const ld = parseFloat(a.miss_distance?.lunar || '999')
        if (ld < closestLd) closestLd = ld
      })
    })
  })

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '8px',
    }}>
      {/* APOD Panel */}
      <LCARSPanel title="Stellar Cartography" color="var(--lcars-african-violet)">
        {apodData.url && apodData.media_type === 'image' && (
          <img
            src={apodData.url}
            alt={apodData.title}
            style={{
              width: '100%', height: '140px', objectFit: 'cover',
              marginBottom: '0.5rem', opacity: 0.9,
            }}
          />
        )}
        <div style={{
          fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
          color: 'var(--lcars-space-white)', textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {apodData.title || 'No data'}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
          color: 'var(--lcars-gray)', marginTop: '0.25rem',
        }}>
          {apodData.date || '---'}
        </div>
      </LCARSPanel>

      {/* Launch Countdown Panel */}
      <LCARSPanel title="Launch Operations" color="var(--lcars-sunflower)">
        <div style={{
          fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
          color: 'var(--lcars-sunflower)', textTransform: 'uppercase',
          letterSpacing: '0.05em', marginBottom: '0.5rem',
        }}>
          {launchData.name || 'No scheduled launch'}
        </div>
        {launchData.launch_service_provider && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
            color: 'var(--lcars-gray)', marginBottom: '0.75rem',
          }}>
            {launchData.launch_service_provider.name}
          </div>
        )}
        {countdown && !countdown.passed && (() => {
          const str = formatCountdown(countdown)
          return (
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 'clamp(0.85rem, 3.5vw, 1.15rem)',
              fontWeight: 700, color: 'var(--lcars-gold)',
              textAlign: 'center', letterSpacing: '0.03em',
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              {str.split('').map((char, i) => (
                <span
                  key={`${i}-${char}`}
                  className={countdownChanged.has(i) && /\d/.test(char) ? 'lcars-digit-roll' : undefined}
                  style={{ display: 'inline-block' }}
                >
                  {char}
                </span>
              ))}
            </div>
          )
        })()}
        {countdown?.passed && (
          <div style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '1rem',
            color: 'var(--lcars-tanoi)', textAlign: 'center',
            textTransform: 'uppercase',
          }}>
            Launch window reached
          </div>
        )}
      </LCARSPanel>

      {/* ISS Tracking Panel */}
      <LCARSPanel title="Station Tracking" color="var(--lcars-ice)">
        <LCARSDataRow label="Latitude" value={parseFloat(issPos.latitude || 0).toFixed(4) + '\u00B0'} color="var(--lcars-ice)" />
        <LCARSDataRow label="Longitude" value={parseFloat(issPos.longitude || 0).toFixed(4) + '\u00B0'} color="var(--lcars-ice)" />
        <LCARSDataRow label="Altitude" value="~408 km" color="var(--lcars-ice)" />
        <LCARSDataRow label="Velocity" value="~27,600 km/h" color="var(--lcars-ice)" />
      </LCARSPanel>

      {/* NEO Threat Assessment Panel */}
      <LCARSPanel
        title="Threat Assessment"
        color={hazardousCount > 0 ? 'var(--lcars-red-alert)' : 'var(--lcars-tanoi)'}
      >
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.5rem', textAlign: 'center',
        }}>
          <LCARSStat label="Objects" value={neoCount} color="var(--lcars-tanoi)" />
          <LCARSStat
            label="Hazardous"
            value={hazardousCount}
            color={hazardousCount > 0 ? 'var(--lcars-red-alert)' : 'var(--lcars-tanoi)'}
          />
          <LCARSStat
            label="Closest (LD)"
            value={closestLd < Infinity ? closestLd.toFixed(2) : '---'}
            color="var(--lcars-tanoi)"
          />
        </div>
      </LCARSPanel>

      {/* Crew Manifest Panel */}
      <LCARSPanel title="Crew Manifest" color="var(--lcars-lilac)">
        <div style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '2rem',
          fontWeight: 700, color: 'var(--lcars-space-white)',
          textAlign: 'center', marginBottom: '0.5rem',
        }}>
          {crewData.total || 0}
        </div>
        <div style={{
          fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
          color: 'var(--lcars-lilac)', textAlign: 'center',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          marginBottom: '0.75rem',
        }}>
          Personnel in orbit
        </div>
        {crewData.grouped && Object.entries(crewData.grouped).map(([craft, names]) => (
          <div key={craft} style={{ marginBottom: '0.5rem' }}>
            <div style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
              color: 'var(--lcars-ice)', textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: '0.125rem',
            }}>
              {craft}
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
              color: 'var(--lcars-gray)',
            }}>
              {names.join(' \u2022 ')}
            </div>
          </div>
        ))}
      </LCARSPanel>
    </div>
  )
}
