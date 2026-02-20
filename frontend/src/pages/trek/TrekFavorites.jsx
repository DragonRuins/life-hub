/**
 * TrekFavorites.jsx - Favorites List (Catppuccin Theme)
 *
 * Shows all bookmarked Star Trek entries with category filter,
 * notes preview, and remove action.
 * Route: /trek/favorites
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Heart, ChevronRight, Trash2 } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekCategoryLabel, getTrekRoute, ENTITY_CATEGORIES } from '../../utils/trekHelpers'

export default function TrekFavorites() {
  const [favorites, setFavorites] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadFavorites()
  }, [filter])

  async function loadFavorites() {
    setLoading(true)
    try {
      const result = await trek.favorites.list(filter)
      setFavorites(Array.isArray(result) ? result : [])
    } catch { setFavorites([]) }
    finally { setLoading(false) }
  }

  async function removeFavorite(id) {
    try {
      await trek.favorites.remove(id)
      setFavorites(prev => prev.filter(f => f.id !== id))
    } catch { /* silent */ }
  }

  // Get unique entity types from favorites for filter
  const uniqueTypes = [...new Set(favorites.map(f => f.entity_type))]

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Link to="/trek" style={{ color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem' }}>
          Database
        </Link>
        <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
        <span style={{ fontSize: '0.85rem' }}>Favorites</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Favorites</h1>
        <span style={{
          fontSize: '0.8rem', padding: '0.2rem 0.625rem', borderRadius: '999px',
          background: 'rgba(243, 139, 168, 0.1)', color: 'var(--color-red)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {favorites.length}
        </span>
      </div>

      {/* Filter */}
      {uniqueTypes.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '1rem' }}>
          <button
            onClick={() => setFilter('all')}
            style={{
              fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: '999px',
              border: '1px solid var(--color-surface-0)', cursor: 'pointer',
              background: filter === 'all' ? 'var(--color-blue)' : 'var(--color-mantle)',
              color: filter === 'all' ? 'var(--color-crust)' : 'var(--color-text)',
            }}
          >
            All
          </button>
          {uniqueTypes.map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              style={{
                fontSize: '0.75rem', padding: '0.25rem 0.625rem', borderRadius: '999px',
                border: '1px solid var(--color-surface-0)', cursor: 'pointer',
                background: filter === type ? 'var(--color-blue)' : 'var(--color-mantle)',
                color: filter === type ? 'var(--color-crust)' : 'var(--color-text)',
              }}
            >
              {getTrekCategoryLabel(type)}
            </button>
          ))}
        </div>
      )}

      {/* Favorites List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-subtext-0)' }}>Loading...</div>
      ) : favorites.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Heart size={24} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)', marginBottom: '0.5rem' }}>No favorites yet</p>
          <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.85rem' }}>
            Browse the database and click the heart icon to save entries.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {favorites.map(fav => (
            <div
              key={fav.id}
              className="card"
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              <Heart size={16} style={{ color: 'var(--color-red)', flexShrink: 0 }} />

              <Link
                to={getTrekRoute(fav.entity_type, fav.entity_uid)}
                style={{ flex: 1, textDecoration: 'none', color: 'inherit', minWidth: 0 }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{fav.entity_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px',
                    background: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)',
                    textTransform: 'uppercase',
                  }}>
                    {getTrekCategoryLabel(fav.entity_type)}
                  </span>
                  {fav.notes && (
                    <span style={{
                      fontSize: '0.75rem', color: 'var(--color-subtext-0)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {fav.notes}
                    </span>
                  )}
                </div>
              </Link>

              <span style={{ fontSize: '0.7rem', color: 'var(--color-overlay-0)', flexShrink: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                {fav.created_at?.split('T')[0]}
              </span>

              <button
                onClick={() => removeFavorite(fav.id)}
                className="btn btn-ghost"
                style={{ padding: '0.25rem', flexShrink: 0, color: 'var(--color-overlay-0)' }}
                title="Remove favorite"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
