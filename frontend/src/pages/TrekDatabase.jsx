/**
 * TrekDatabase.jsx - Star Trek Database Landing Page (Catppuccin Theme)
 *
 * The main entry point for the Trek module. Shows:
 *   1. Entry of the Day hero card
 *   2. Search bar
 *   3. Quick Access category grid
 *   4. On This Day episodes
 *   5. Recent favorites
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Star, Shuffle, ChevronRight, Heart, Tv,
  Users, Rocket, Dna, Globe, Cpu, Film, Building2, Utensils
} from 'lucide-react'
import { trek } from '../api/client'
import { ENTITY_CATEGORIES, getTrekCategoryLabel, getTrekRoute } from '../utils/trekHelpers'

const CATEGORY_ICONS = {
  personnel: Users, starships: Rocket, species: Dna,
  worlds: Globe, science: Cpu, media: Tv,
  production: Film, organizations: Building2, culture: Utensils,
}

export default function TrekDatabase() {
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

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Star Trek Database
        </h1>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Federation Library Computer Access / Retrieval System
        </p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          background: 'var(--color-mantle)',
          borderRadius: '12px',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--color-surface-0)',
        }}>
          <Search size={18} style={{ color: 'var(--color-overlay-0)', flexShrink: 0, marginTop: '0.25rem' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search characters, ships, episodes..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: '0.95rem',
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}>
            Search
          </button>
        </div>
      </form>

      {/* Entry of the Day */}
      {daily && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Star size={18} style={{ color: 'var(--color-yellow)' }} />
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Entry of the Day</h2>
            </div>
            <button onClick={handleShuffle} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}>
              <Shuffle size={14} /> Shuffle
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{daily.entity_name}</h3>
            <span style={{
              fontSize: '0.7rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '999px',
              background: 'rgba(137, 180, 250, 0.1)',
              color: 'var(--color-blue)',
              textTransform: 'uppercase',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}>
              {getTrekCategoryLabel(daily.entity_type)}
            </span>
          </div>

          {/* Summary fields */}
          {daily.summary_data && Object.keys(daily.summary_data).length > 0 && (
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {Object.entries(daily.summary_data).map(([key, value]) => (
                value != null && (
                  <div key={key} style={{ fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--color-subtext-0)', textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}:
                    </span>{' '}
                    <span style={{ fontWeight: 500 }}>{String(value)}</span>
                  </div>
                )
              ))}
            </div>
          )}

          <Link
            to={daily.entity_uid ? getTrekRoute(daily.entity_type, daily.entity_uid) : '/trek'}
            style={{ fontSize: '0.85rem', color: 'var(--color-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
          >
            View Full Entry <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* Quick Access Category Grid */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Browse Categories</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.75rem',
        }}>
          {Object.entries(ENTITY_CATEGORIES).map(([key, cat]) => {
            const Icon = CATEGORY_ICONS[key] || Star
            return (
              <Link
                key={key}
                to={`/trek/${cat.types[0]}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem', background: 'var(--color-mantle)',
                  borderRadius: '10px', textDecoration: 'none', color: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-0)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-mantle)'}
              >
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: `color-mix(in srgb, ${cat.color} 10%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: cat.color,
                }}>
                  <Icon size={18} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                    {cat.types.length} type{cat.types.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Shortcuts */}
      <div className="form-grid-2col" style={{ marginBottom: '1.5rem' }}>
        <Link to="/trek/episodes" className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Tv size={20} style={{ color: 'var(--color-peach)' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Episode Guide</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>Browse all series and episodes</div>
          </div>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--color-overlay-0)' }} />
        </Link>
        <Link to="/trek/ships" className="card" style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Rocket size={20} style={{ color: 'var(--color-teal)' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Starship Registry</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>Browse spacecraft and classes</div>
          </div>
          <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--color-overlay-0)' }} />
        </Link>
      </div>

      {/* On This Day */}
      {onThisDay.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            On This Day
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {onThisDay.slice(0, 5).map((ep, i) => (
              <Link
                key={ep.uid || i}
                to={ep.uid ? getTrekRoute('episode', ep.uid) : '#'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.5rem 0.625rem', background: 'var(--color-mantle)',
                  borderRadius: '8px', textDecoration: 'none', color: 'inherit',
                  fontSize: '0.85rem',
                }}
              >
                <Tv size={14} style={{ color: 'var(--color-peach)', flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{ep.title || ep.name}</span>
                {ep.usAirDate && (
                  <span style={{ marginLeft: 'auto', color: 'var(--color-subtext-0)', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                    {ep.usAirDate}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Favorites */}
      {favorites.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Recent Favorites</h2>
            <Link to="/trek/favorites" style={{ fontSize: '0.8rem', color: 'var(--color-blue)', textDecoration: 'none' }}>
              View all <ChevronRight size={14} style={{ verticalAlign: 'middle' }} />
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {favorites.map(fav => (
              <Link
                key={fav.id}
                to={getTrekRoute(fav.entity_type, fav.entity_uid)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.625rem',
                  padding: '0.5rem 0.625rem', background: 'var(--color-mantle)',
                  borderRadius: '8px', textDecoration: 'none', color: 'inherit',
                  fontSize: '0.85rem',
                }}
              >
                <Heart size={14} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
                <span style={{ fontWeight: 500 }}>{fav.entity_name}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: '0.7rem', padding: '0.1rem 0.4rem',
                  borderRadius: '999px', background: 'rgba(137, 180, 250, 0.1)',
                  color: 'var(--color-blue)', textTransform: 'uppercase',
                }}>
                  {getTrekCategoryLabel(fav.entity_type)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '2rem', width: '280px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '2rem' }} />
      <div style={{ height: '48px', background: 'var(--color-surface-0)', borderRadius: '12px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div style={{ height: '180px', background: 'var(--color-surface-0)', borderRadius: '12px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ height: '64px', background: 'var(--color-surface-0)', borderRadius: '10px', opacity: 0.2 }} />
        ))}
      </div>
    </div>
  )
}
