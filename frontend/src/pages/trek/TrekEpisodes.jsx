/**
 * TrekEpisodes.jsx - Episode Guide (Catppuccin Theme)
 *
 * Three-level drill-down: Series > Seasons > Episodes
 * Route: /trek/episodes
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Tv, ChevronLeft } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekRoute, formatStardate } from '../../utils/trekHelpers'

export default function TrekEpisodes() {
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
        // Sort by production start year
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
    setSelectedSeries(s)
    setSelectedSeason(null)
    setEpisodes([])
    setLoadingSub(true)
    try {
      const result = await trek.episodes.seasons(s.uid)
      const sorted = (result.seasons || []).sort((a, b) =>
        (a.seasonNumber || 0) - (b.seasonNumber || 0)
      )
      setSeasons(sorted)
    } catch { setSeasons([]) }
    finally { setLoadingSub(false) }
  }

  async function selectSeason(s) {
    setSelectedSeason(s)
    setLoadingSub(true)
    try {
      const result = await trek.episodes.episodes(s.uid)
      const sorted = (result.episodes || []).sort((a, b) =>
        (a.episodeNumber || 0) - (b.episodeNumber || 0)
      )
      setEpisodes(sorted)
    } catch { setEpisodes([]) }
    finally { setLoadingSub(false) }
  }

  function goBack() {
    if (selectedSeason) {
      setSelectedSeason(null)
      setEpisodes([])
    } else if (selectedSeries) {
      setSelectedSeries(null)
      setSeasons([])
    }
  }

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Link to="/trek" style={{ color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem' }}>
          Database
        </Link>
        <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
        {selectedSeries ? (
          <>
            <button onClick={() => { setSelectedSeries(null); setSelectedSeason(null); setSeasons([]); setEpisodes([]) }}
              style={{ background: 'none', border: 'none', color: 'var(--color-subtext-0)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
              Episodes
            </button>
            <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
            {selectedSeason ? (
              <>
                <button onClick={() => { setSelectedSeason(null); setEpisodes([]) }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-subtext-0)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
                  {selectedSeries.title || selectedSeries.abbreviation}
                </button>
                <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
                <span style={{ fontSize: '0.85rem' }}>Season {selectedSeason.seasonNumber}</span>
              </>
            ) : (
              <span style={{ fontSize: '0.85rem' }}>{selectedSeries.title || selectedSeries.abbreviation}</span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '0.85rem' }}>Episode Guide</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {(selectedSeries || selectedSeason) && (
          <button onClick={goBack} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }}>
            <ChevronLeft size={16} />
          </button>
        )}
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          {selectedSeason
            ? `Season ${selectedSeason.seasonNumber}`
            : selectedSeries
              ? (selectedSeries.title || 'Series')
              : 'Episode Guide'}
        </h1>
      </div>

      {/* Series Grid */}
      {!selectedSeries && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {series.map(s => (
            <button
              key={s.uid}
              onClick={() => selectSeries(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '1rem', background: 'var(--color-mantle)',
                borderRadius: '10px', border: '1px solid var(--color-surface-0)',
                cursor: 'pointer', textAlign: 'left', color: 'inherit',
                transition: 'border-color 0.15s',
                width: '100%',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-blue)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-surface-0)'}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '8px',
                background: 'rgba(250, 179, 135, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Tv size={20} style={{ color: 'var(--color-peach)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {s.title || s.abbreviation}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                  {s.abbreviation && <span>{s.abbreviation} </span>}
                  {s.productionStartYear && s.productionEndYear && (
                    <span>({s.productionStartYear}–{s.productionEndYear})</span>
                  )}
                  {s.productionStartYear && !s.productionEndYear && (
                    <span>({s.productionStartYear}–present)</span>
                  )}
                </div>
                {(s.seasonsCount || s.episodesCount) && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)' }}>
                    {s.seasonsCount && `${s.seasonsCount} seasons`}
                    {s.seasonsCount && s.episodesCount && ' / '}
                    {s.episodesCount && `${s.episodesCount} episodes`}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Seasons Grid */}
      {selectedSeries && !selectedSeason && !loadingSub && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.5rem' }}>
          {seasons.map(s => (
            <button
              key={s.uid}
              onClick={() => selectSeason(s)}
              style={{
                padding: '1rem', background: 'var(--color-mantle)',
                borderRadius: '10px', border: '1px solid var(--color-surface-0)',
                cursor: 'pointer', textAlign: 'center', color: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-blue)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-surface-0)'}
            >
              <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                {s.seasonNumber || '?'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase' }}>
                Season
              </div>
              {s.numberOfEpisodes && (
                <div style={{ fontSize: '0.7rem', color: 'var(--color-overlay-0)' }}>
                  {s.numberOfEpisodes} eps
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Episodes List */}
      {selectedSeason && !loadingSub && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {episodes.map(ep => (
            <Link
              key={ep.uid}
              to={ep.uid ? getTrekRoute('episode', ep.uid) : '#'}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 0.875rem', background: 'var(--color-mantle)',
                borderRadius: '8px', textDecoration: 'none', color: 'inherit',
                border: '1px solid var(--color-surface-0)',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-surface-1)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-surface-0)'}
            >
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem',
                fontWeight: 600, color: 'var(--color-peach)', width: '2.5rem',
                textAlign: 'center', flexShrink: 0,
              }}>
                {ep.episodeNumber || '?'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                  {ep.title || ep.name || 'Unknown'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                  {ep.stardateFrom && <span>Stardate {formatStardate(ep.stardateFrom)} </span>}
                </div>
              </div>
              {ep.usAirDate && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                  {ep.usAirDate}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {loadingSub && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-subtext-0)' }}>
          Loading...
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ height: '2rem', width: '200px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: '80px', background: 'var(--color-surface-0)', borderRadius: '10px', opacity: 0.2 }} />
        ))}
      </div>
    </div>
  )
}
