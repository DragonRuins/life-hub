/**
 * AstroApod.jsx - APOD Browser (Catppuccin Theme)
 *
 * Full APOD experience:
 *   - Hero image or video embed
 *   - Date navigation (prev/next arrows + date picker)
 *   - Favorite toggle (heart icon)
 *   - HD link for images
 *   - Random APOD button
 *   - Favorites gallery below main view
 */
import { useState, useEffect, useCallback } from 'react'
import { astrometrics as api } from '../../api/client'
import { ChevronLeft, ChevronRight, Heart, Shuffle, ExternalLink, Calendar } from 'lucide-react'

// APOD started on June 16, 1995
const APOD_MIN_DATE = '1995-06-16'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export default function AstroApod() {
  const [currentDate, setCurrentDate] = useState(todayStr())
  const [apod, setApod] = useState(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showFavorites, setShowFavorites] = useState(false)

  const loadApod = useCallback(async (date) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.apod.get(date)
      setApod(result.data || result)
      setIsFavorite(result.is_favorite || false)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadFavorites = useCallback(async () => {
    try {
      const favs = await api.apod.favorites.list()
      setFavorites(favs)
    } catch (e) {
      // Silent fail for favorites
    }
  }, [])

  useEffect(() => {
    loadApod(currentDate)
    loadFavorites()
  }, [currentDate, loadApod, loadFavorites])

  const goToDate = (offset) => {
    const d = new Date(currentDate + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    const newDate = d.toISOString().split('T')[0]
    if (newDate >= APOD_MIN_DATE && newDate <= todayStr()) {
      setCurrentDate(newDate)
    }
  }

  const handleRandom = async () => {
    setLoading(true)
    try {
      const result = await api.apod.random()
      const data = result.data || result
      setApod(data)
      setIsFavorite(result.is_favorite || false)
      if (data.date) setCurrentDate(data.date)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleFavorite = async () => {
    if (!apod) return

    if (isFavorite) {
      // Find the favorite by date and remove it
      const fav = favorites.find(f => f.date === apod.date)
      if (fav) {
        await api.apod.favorites.delete(fav.id)
        setIsFavorite(false)
        setFavorites(prev => prev.filter(f => f.id !== fav.id))
      }
    } else {
      try {
        const saved = await api.apod.favorites.save({
          date: apod.date,
          title: apod.title,
          url: apod.url,
          hdurl: apod.hdurl,
          media_type: apod.media_type,
          explanation: apod.explanation,
          thumbnail_url: apod.thumbnail_url,
          copyright: apod.copyright,
        })
        setIsFavorite(true)
        setFavorites(prev => [saved, ...prev])
      } catch (e) {
        // Already favorited
      }
    }
  }

  return (
    <div>
      {/* Navigation Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        marginBottom: '1rem', flexWrap: 'wrap',
      }}>
        <button className="btn btn-ghost" onClick={() => goToDate(-1)} disabled={currentDate <= APOD_MIN_DATE}>
          <ChevronLeft size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Calendar size={16} style={{ color: 'var(--color-subtext-0)' }} />
          <input
            type="date"
            value={currentDate}
            min={APOD_MIN_DATE}
            max={todayStr()}
            onChange={e => setCurrentDate(e.target.value)}
            style={{
              background: 'var(--color-surface-0)', border: '1px solid var(--color-surface-1)',
              borderRadius: '6px', color: 'var(--color-text)', padding: '0.375rem 0.625rem',
              fontFamily: 'inherit', fontSize: '0.85rem',
            }}
          />
        </div>

        <button className="btn btn-ghost" onClick={() => goToDate(1)} disabled={currentDate >= todayStr()}>
          <ChevronRight size={18} />
        </button>

        <div style={{ flex: 1 }} />

        <button className="btn btn-ghost" onClick={handleRandom} title="Random APOD">
          <Shuffle size={16} />
          <span>Random</span>
        </button>

        <button
          className="btn btn-ghost"
          onClick={toggleFavorite}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          style={{ color: isFavorite ? 'var(--color-red)' : undefined }}
        >
          <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        <button
          className="btn btn-ghost"
          onClick={() => setShowFavorites(!showFavorites)}
          style={{ color: showFavorites ? 'var(--color-mauve)' : undefined }}
        >
          {showFavorites ? 'Hide' : 'Show'} Favorites ({favorites.length})
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '1rem', background: 'rgba(243, 139, 168, 0.1)',
          borderRadius: '8px', color: 'var(--color-red)', marginBottom: '1rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          Failed to load APOD: {error}
          <button className="btn btn-ghost" onClick={() => loadApod(currentDate)} style={{ marginLeft: 'auto' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-subtext-0)' }}>
          Loading...
        </div>
      )}

      {/* Main APOD Display */}
      {!loading && apod && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Media */}
          {apod.media_type === 'image' ? (
            <img
              src={apod.url}
              alt={apod.title}
              style={{
                width: '100%', maxHeight: '600px', objectFit: 'contain',
                background: '#000', borderRadius: '6px',
              }}
            />
          ) : apod.media_type === 'video' ? (
            <div>
              <iframe
                src={apod.url}
                title={apod.title}
                style={{
                  width: '100%', height: '400px', border: 'none',
                  borderRadius: '6px', background: '#000',
                }}
                allowFullScreen
              />
              {apod.url && (
                <a
                  href={apod.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    color: 'var(--color-blue)', fontSize: '0.85rem', marginTop: '0.5rem',
                    textDecoration: 'none',
                  }}
                >
                  Watch on YouTube <ExternalLink size={14} />
                </a>
              )}
            </div>
          ) : null}

          {/* Info */}
          <div style={{ padding: '1rem 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
                  {apod.title}
                </h2>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                  {formatDate(apod.date)}
                  {apod.copyright && ` \u2022 ${apod.copyright}`}
                </p>
              </div>
              {apod.hdurl && (
                <a
                  href={apod.hdurl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                  style={{ flexShrink: 0 }}
                >
                  <ExternalLink size={14} /> HD
                </a>
              )}
            </div>
            <p style={{
              margin: '1rem 0 0', fontSize: '0.9rem', lineHeight: 1.6,
              color: 'var(--color-subtext-1)',
            }}>
              {apod.explanation}
            </p>
          </div>
        </div>
      )}

      {/* Favorites Gallery */}
      {showFavorites && favorites.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Favorites ({favorites.length})
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '0.75rem',
          }}>
            {favorites.map(fav => (
              <div
                key={fav.id}
                className="card"
                style={{ cursor: 'pointer', overflow: 'hidden', padding: 0 }}
                onClick={() => setCurrentDate(fav.date)}
              >
                {fav.media_type === 'image' && (
                  <img
                    src={fav.url}
                    alt={fav.title}
                    style={{ width: '100%', height: '120px', objectFit: 'cover' }}
                  />
                )}
                <div style={{ padding: '0.5rem 0.75rem' }}>
                  <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 500 }}>{fav.title}</p>
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.7rem', color: 'var(--color-subtext-0)' }}>
                    {fav.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showFavorites && favorites.length === 0 && (
        <div style={{
          marginTop: '1.5rem', textAlign: 'center', padding: '2rem',
          color: 'var(--color-subtext-0)',
        }}>
          No favorites saved yet. Click the heart icon to save an APOD.
        </div>
      )}
    </div>
  )
}
