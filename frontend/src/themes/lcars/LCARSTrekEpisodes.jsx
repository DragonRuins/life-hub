/**
 * LCARSTrekEpisodes.jsx - Episode Guide (LCARS Theme)
 *
 * LCARS-styled three-level drill-down: Series > Seasons > Episodes
 * Route: /trek/episodes
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekRoute, formatStardate } from '../../utils/trekHelpers'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

export default function LCARSTrekEpisodes() {
  const [series, setSeries] = useState([])
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [episodes, setEpisodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingSub, setLoadingSub] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const result = await trek.episodes.series()
        const sorted = (result.series || []).sort((a, b) =>
          (a.productionStartYear || 9999) - (b.productionStartYear || 9999)
        )
        setSeries(sorted)
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function selectSeries(s) {
    setSelectedSeries(s); setSelectedSeason(null); setEpisodes([])
    setLoadingSub(true)
    try {
      const result = await trek.episodes.seasons(s.uid)
      setSeasons((result.seasons || []).sort((a, b) => (a.seasonNumber || 0) - (b.seasonNumber || 0)))
    } catch { setSeasons([]) }
    finally { setLoadingSub(false) }
  }

  async function selectSeason(s) {
    setSelectedSeason(s); setLoadingSub(true)
    try {
      const result = await trek.episodes.episodes(s.uid)
      setEpisodes((result.episodes || []).sort((a, b) => (a.episodeNumber || 0) - (b.episodeNumber || 0)))
    } catch { setEpisodes([]) }
    finally { setLoadingSub(false) }
  }

  function goBack() {
    if (selectedSeason) { setSelectedSeason(null); setEpisodes([]) }
    else if (selectedSeries) { setSelectedSeries(null); setSeasons([]) }
  }

  const panelTitle = selectedSeason
    ? `Season ${selectedSeason.seasonNumber} — Episode Manifest`
    : selectedSeries
      ? `${selectedSeries.abbreviation || selectedSeries.title} — Seasons`
      : 'Episode Database'

  if (loading) {
    return (
      <LCARSPanel title="Episode Database" color="var(--lcars-butterscotch)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '1rem',
            color: 'var(--lcars-butterscotch)', textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}>
            Accessing episode database...
          </span>
        </div>
      </LCARSPanel>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Back link */}
      <Link
        to="/trek"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          color: 'var(--lcars-ice)', textDecoration: 'none',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.8rem', textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <ArrowLeft size={14} />
        Database
      </Link>

      <LCARSPanel
        title={panelTitle}
        color="var(--lcars-butterscotch)"
        headerRight={(selectedSeries || selectedSeason) ? (
          <button
            onClick={goBack}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--lcars-text-on-color)', display: 'flex', alignItems: 'center', gap: '0.25rem',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
              textTransform: 'uppercase',
            }}
          >
            <ChevronLeft size={12} /> Back
          </button>
        ) : null}
      >
        {/* Series List */}
        {!selectedSeries && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {series.map(s => (
              <button
                key={s.uid}
                onClick={() => selectSeries(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 0.75rem', background: 'transparent',
                  border: 'none', cursor: 'pointer', color: 'inherit',
                  borderLeft: '3px solid var(--lcars-butterscotch)',
                  textAlign: 'left', width: '100%',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 153, 102, 0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
                  textTransform: 'uppercase', color: 'var(--lcars-space-white)',
                  letterSpacing: '0.03em', flex: 1,
                }}>
                  {s.title || s.abbreviation}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                  color: 'var(--lcars-gray)',
                }}>
                  {s.abbreviation && `${s.abbreviation} `}
                  {s.productionStartYear || ''}
                  {s.productionEndYear ? `–${s.productionEndYear}` : ''}
                </span>
                <ChevronRight size={14} style={{ color: 'var(--lcars-gray)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* Seasons Grid */}
        {selectedSeries && !selectedSeason && !loadingSub && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
            gap: '4px',
          }}>
            {seasons.map(s => (
              <button
                className="lcars-element button auto"
                key={s.uid}
                onClick={() => selectSeason(s)}
                style={{
                  padding: '0.75rem 0.5rem', background: 'var(--lcars-butterscotch)',
                  border: 'none', borderRadius: '8px', height: 'auto',
                  textAlign: 'center',
                }}
              >
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '1.25rem',
                  fontWeight: 700, color: 'var(--lcars-text-on-color)',
                }}>
                  {s.seasonNumber || '?'}
                </div>
                <div style={{
                  fontFamily: "'Antonio', sans-serif", fontSize: '0.6rem',
                  textTransform: 'uppercase', color: 'var(--lcars-text-on-color)', opacity: 0.7,
                }}>
                  {s.numberOfEpisodes ? `${s.numberOfEpisodes} eps` : 'Season'}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Episodes List */}
        {selectedSeason && !loadingSub && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {episodes.map(ep => (
              <Link
                key={ep.uid}
                to={ep.uid ? getTrekRoute('episode', ep.uid) : '#'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.75rem', textDecoration: 'none',
                  color: 'inherit', borderLeft: '3px solid var(--lcars-butterscotch)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 153, 102, 0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem',
                  fontWeight: 600, color: 'var(--lcars-butterscotch)',
                  width: '2rem', textAlign: 'center', flexShrink: 0,
                }}>
                  {ep.episodeNumber || '?'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
                    textTransform: 'uppercase', color: 'var(--lcars-space-white)',
                    letterSpacing: '0.03em',
                  }}>
                    {ep.title || ep.name || 'Unknown'}
                  </span>
                  {ep.stardateFrom && (
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
                      color: 'var(--lcars-gray)',
                    }}>
                      SD {formatStardate(ep.stardateFrom)}
                    </div>
                  )}
                </div>
                {ep.usAirDate && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                    color: 'var(--lcars-gray)', flexShrink: 0,
                  }}>
                    {ep.usAirDate}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {loadingSub && (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
              color: 'var(--lcars-butterscotch)', textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Loading...
            </span>
          </div>
        )}
      </LCARSPanel>
    </div>
  )
}
