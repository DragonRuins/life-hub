/**
 * LCARSTrekFavorites.jsx - Favorites List (LCARS Theme)
 *
 * LCARS-styled "Bookmarked Entries" panel with category filter.
 * Route: /trek/favorites
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Trash2, ArrowLeft } from 'lucide-react'
import { trek } from '../../api/client'
import { formatDate } from '../../utils/formatDate'
import { getTrekLCARSLabel, getTrekRoute } from '../../utils/trekHelpers'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

export default function LCARSTrekFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const result = await trek.favorites.list()
        setFavorites(Array.isArray(result) ? result : [])
      } catch { setFavorites([]) }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function removeFavorite(id) {
    try {
      await trek.favorites.remove(id)
      setFavorites(prev => prev.filter(f => f.id !== id))
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <LCARSPanel title="Bookmarked Entries" color="var(--lcars-african-violet)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
            color: 'var(--lcars-african-violet)', textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}>
            Retrieving bookmarks...
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
        title="Bookmarked Entries"
        color="var(--lcars-african-violet)"
        headerRight={
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
            color: 'var(--lcars-text-on-color)', fontWeight: 600,
          }}>
            {favorites.length} ENTRIES
          </span>
        }
      >
        {favorites.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <Heart size={24} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
            <div style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
              color: 'var(--lcars-gray)', textTransform: 'uppercase',
            }}>
              No bookmarked entries
            </div>
            <div style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
              color: 'var(--lcars-gray)', marginTop: '0.25rem', opacity: 0.7,
            }}>
              Browse database entries and select the heart icon to bookmark
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {favorites.map(fav => (
              <div
                key={fav.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  borderLeft: '3px solid var(--lcars-african-violet)',
                }}
              >
                <Link
                  to={getTrekRoute(fav.entity_type, fav.entity_uid)}
                  style={{
                    flex: 1, textDecoration: 'none', color: 'inherit',
                    display: 'flex', flexDirection: 'column', gap: '0.125rem',
                  }}
                >
                  <span style={{
                    fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
                    textTransform: 'uppercase', color: 'var(--lcars-space-white)',
                    letterSpacing: '0.03em',
                  }}>
                    {fav.entity_name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontFamily: "'Antonio', sans-serif", fontSize: '0.65rem',
                      padding: '0.1rem 0.4rem', borderRadius: '6px',
                      background: 'var(--lcars-african-violet)', color: 'var(--lcars-text-on-color)',
                      textTransform: 'uppercase',
                    }}>
                      {getTrekLCARSLabel(fav.entity_type)}
                    </span>
                    {fav.notes && (
                      <span style={{
                        fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
                        color: 'var(--lcars-gray)', overflow: 'hidden',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {fav.notes}
                      </span>
                    )}
                  </div>
                </Link>

                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
                  color: 'var(--lcars-gray)', flexShrink: 0,
                }}>
                  {formatDate(fav.created_at)}
                </span>

                <button
                  onClick={() => removeFavorite(fav.id)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--lcars-gray)', padding: '0.25rem', flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-tomato)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
                  title="Remove bookmark"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </LCARSPanel>
    </div>
  )
}
