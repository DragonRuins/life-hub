/**
 * LCARSTrekDatabase.jsx - Star Trek Database Landing Page (LCARS Theme)
 *
 * This IS the Library Computer Access / Retrieval System. Shows:
 *   1. "FEDERATION DATABASE - ENTRY OF THE DAY" readout panel
 *   2. LCARS panel button grid for categories
 *   3. "HISTORICAL DATABASE" section for On This Day
 *   4. "LCARS ACCESS - QUERY READY" search bar
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Shuffle, ChevronRight, Heart } from 'lucide-react'
import { trek } from '../../api/client'
import { ENTITY_CATEGORIES, getTrekCategoryLabel, getTrekRoute, getTrekLCARSLabel } from '../../utils/trekHelpers'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

const LCARS_CAT_COLORS = {
  personnel: 'var(--lcars-ice)',
  starships: 'var(--lcars-sunflower)',
  species: 'var(--lcars-green)',
  worlds: 'var(--lcars-african-violet)',
  science: 'var(--lcars-tanoi)',
  media: 'var(--lcars-butterscotch)',
  production: 'var(--lcars-lilac)',
  organizations: 'var(--lcars-rust)',
  culture: 'var(--lcars-gold)',
}

export default function LCARSTrekDatabase() {
  const [daily, setDaily] = useState(null)
  const [onThisDay, setOnThisDay] = useState([])
  const [favorites, setFavorites] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      try {
        const [d, otd, favs] = await Promise.all([
          trek.daily().catch(() => null),
          trek.episodes.onThisDay().catch(() => ({ episodes: [] })),
          trek.favorites.list().catch(() => []),
        ])
        setDaily(d)
        setOnThisDay(otd.episodes || [])
        setFavorites(Array.isArray(favs) ? favs.slice(0, 5) : [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function handleShuffle() {
    try {
      const result = await trek.dailyShuffle()
      setDaily(result)
    } catch { /* silent */ }
  }

  function handleSearch(e) {
    e.preventDefault()
    if (searchQuery.trim().length >= 2) {
      navigate(`/trek/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '1rem' }}>
        <LCARSPanel title="Federation Database" color="var(--lcars-gold)">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '1rem',
              color: 'var(--lcars-sunflower)', textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }}>
              Accessing database...
            </span>
          </div>
        </LCARSPanel>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Search Bar */}
      <LCARSPanel title="LCARS Access — Query Ready" color="var(--lcars-ice)">
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Enter search query..."
            style={{
              flex: 1, background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--lcars-gray)', borderRadius: '4px',
              padding: '0.5rem 0.75rem', color: 'var(--lcars-space-white)',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
              outline: 'none', letterSpacing: '0.05em',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem', background: 'var(--lcars-ice)',
              border: 'none', borderRadius: '20px', cursor: 'pointer',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
              fontWeight: 600, textTransform: 'uppercase', color: '#000',
              letterSpacing: '0.05em',
            }}
          >
            <Search size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
            Search
          </button>
        </form>
      </LCARSPanel>

      {/* Entry of the Day */}
      {daily && (
        <LCARSPanel
          title="Federation Database — Entry of the Day"
          color="var(--lcars-gold)"
          headerRight={
            <button
              onClick={handleShuffle}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: '#000', display: 'flex', alignItems: 'center', gap: '0.25rem',
                fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
                textTransform: 'uppercase',
              }}
            >
              <Shuffle size={12} /> Shuffle
            </button>
          }
        >
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '1.5rem',
              fontWeight: 700, color: 'var(--lcars-space-white)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              marginBottom: '0.25rem',
            }}>
              {daily.entity_name}
            </div>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
              padding: '0.125rem 0.5rem', borderRadius: '10px',
              background: 'var(--lcars-gold)', color: '#000',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {getTrekLCARSLabel(daily.entity_type)}
            </span>
          </div>

          {daily.summary_data && Object.keys(daily.summary_data).length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              {Object.entries(daily.summary_data).map(([key, value]) =>
                value != null ? (
                  <LCARSDataRow
                    key={key}
                    label={key.replace(/([A-Z])/g, ' $1').trim()}
                    value={String(value)}
                    color="var(--lcars-gold)"
                  />
                ) : null
              )}
            </div>
          )}

          <Link
            to={daily.entity_uid ? getTrekRoute(daily.entity_type, daily.entity_uid) : '/trek'}
            style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.82rem',
              color: 'var(--lcars-ice)', textDecoration: 'none',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            }}
          >
            Access Full Record <ChevronRight size={14} />
          </Link>
        </LCARSPanel>
      )}

      {/* Category Grid */}
      <LCARSPanel title="Database Access" color="var(--lcars-sunflower)">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '4px',
        }}>
          {Object.entries(ENTITY_CATEGORIES).map(([key, cat]) => (
            <Link
              key={key}
              to={`/trek/${cat.types[0]}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0.75rem 0.5rem',
                background: LCARS_CAT_COLORS[key] || 'var(--lcars-sunflower)',
                borderRadius: '8px', textDecoration: 'none',
                transition: 'filter 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.3)'}
              onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
            >
              <span style={{
                fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
                fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: '#000',
                textAlign: 'center',
              }}>
                {cat.lcarsLabel || cat.label}
              </span>
            </Link>
          ))}
        </div>
      </LCARSPanel>

      {/* Quick Links */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
        <Link
          to="/trek/episodes"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.75rem', background: 'var(--lcars-butterscotch)',
            borderRadius: '20px 4px 4px 20px', textDecoration: 'none',
            transition: 'filter 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.3)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
        >
          <span style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
            fontWeight: 600, textTransform: 'uppercase', color: '#000',
            letterSpacing: '0.08em',
          }}>
            Episode Guide
          </span>
        </Link>
        <Link
          to="/trek/ships"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0.75rem', background: 'var(--lcars-sunflower)',
            borderRadius: '4px 20px 20px 4px', textDecoration: 'none',
            transition: 'filter 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.3)'}
          onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
        >
          <span style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
            fontWeight: 600, textTransform: 'uppercase', color: '#000',
            letterSpacing: '0.08em',
          }}>
            Vessel Registry
          </span>
        </Link>
      </div>

      {/* On This Day */}
      {onThisDay.length > 0 && (
        <LCARSPanel title="Historical Database — On This Day" color="var(--lcars-butterscotch)">
          {onThisDay.slice(0, 5).map((ep, i) => (
            <LCARSDataRow
              key={ep.uid || i}
              label={ep.title || ep.name || 'Unknown'}
              value={ep.usAirDate || ''}
              color="var(--lcars-butterscotch)"
              icon={
                <Link to={ep.uid ? getTrekRoute('episode', ep.uid) : '#'} style={{ color: 'inherit' }}>
                  <ChevronRight size={14} />
                </Link>
              }
            />
          ))}
        </LCARSPanel>
      )}

      {/* Recent Favorites */}
      {favorites.length > 0 && (
        <LCARSPanel
          title="Bookmarked Entries"
          color="var(--lcars-african-violet)"
          headerRight={
            <Link
              to="/trek/favorites"
              style={{
                fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
                color: '#000', textDecoration: 'none', textTransform: 'uppercase',
              }}
            >
              View All
            </Link>
          }
        >
          {favorites.map(fav => (
            <LCARSDataRow
              key={fav.id}
              label={fav.entity_name}
              value={getTrekLCARSLabel(fav.entity_type)}
              color="var(--lcars-african-violet)"
              icon={
                <Link to={getTrekRoute(fav.entity_type, fav.entity_uid)} style={{ color: 'var(--lcars-african-violet)' }}>
                  <Heart size={12} />
                </Link>
              }
            />
          ))}
        </LCARSPanel>
      )}
    </div>
  )
}
