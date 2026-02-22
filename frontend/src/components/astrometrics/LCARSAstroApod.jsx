/**
 * LCARSAstroApod.jsx - Stellar Cartography (LCARS APOD Viewer)
 *
 * LCARS-themed APOD browser with same features as Catppuccin version:
 * date navigation, favorites, random, HD link, video embed.
 */
import { useState, useEffect, useCallback } from 'react'
import { astrometrics as api } from '../../api/client'
import { formatDate } from '../../utils/formatDate'
import LCARSPanel from '../../themes/lcars/LCARSPanel'
import { ChevronLeft, ChevronRight, Heart, Shuffle, ExternalLink } from 'lucide-react'

const APOD_MIN_DATE = '1995-06-16'
function todayStr() { return new Date().toISOString().split('T')[0] }

export default function LCARSAstroApod() {
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
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  const loadFavorites = useCallback(async () => {
    try { setFavorites(await api.apod.favorites.list()) } catch (e) {}
  }, [])

  useEffect(() => { loadApod(currentDate); loadFavorites() }, [currentDate, loadApod, loadFavorites])

  const goToDate = (offset) => {
    const d = new Date(currentDate + 'T12:00:00')
    d.setDate(d.getDate() + offset)
    const newDate = d.toISOString().split('T')[0]
    if (newDate >= APOD_MIN_DATE && newDate <= todayStr()) setCurrentDate(newDate)
  }

  const handleRandom = async () => {
    setLoading(true)
    try {
      const result = await api.apod.random()
      const data = result.data || result
      setApod(data)
      setIsFavorite(result.is_favorite || false)
      if (data.date) setCurrentDate(data.date)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const toggleFavorite = async () => {
    if (!apod) return
    if (isFavorite) {
      const fav = favorites.find(f => f.date === apod.date)
      if (fav) {
        await api.apod.favorites.delete(fav.id)
        setIsFavorite(false)
        setFavorites(prev => prev.filter(f => f.id !== fav.id))
      }
    } else {
      try {
        const saved = await api.apod.favorites.save({
          date: apod.date, title: apod.title, url: apod.url,
          hdurl: apod.hdurl, media_type: apod.media_type,
          explanation: apod.explanation, thumbnail_url: apod.thumbnail_url,
          copyright: apod.copyright,
        })
        setIsFavorite(true)
        setFavorites(prev => [saved, ...prev])
      } catch (e) {}
    }
  }

  const pillBtn = (onClick, children, active = false, extra = {}) => ({
    onClick,
    style: {
      padding: '0.3rem 0.75rem', background: active ? 'var(--lcars-butterscotch)' : 'var(--lcars-gray)',
      border: 'none', borderRadius: '999px', color: '#000', cursor: 'pointer',
      fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem', fontWeight: 400,
      textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-flex',
      alignItems: 'center', gap: '0.375rem', opacity: active ? 1 : 0.8,
      transition: 'all 0.15s', ...extra,
    },
  })

  return (
    <div>
      {/* Navigation controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button {...pillBtn(() => goToDate(-1))}><ChevronLeft size={14} /></button>
        <input
          type="date" value={currentDate} min={APOD_MIN_DATE} max={todayStr()}
          onChange={e => setCurrentDate(e.target.value)}
          style={{
            background: 'rgba(102, 102, 136, 0.2)', border: '1px solid var(--lcars-gray)',
            borderRadius: '999px', color: 'var(--lcars-space-white)',
            padding: '0.3rem 0.75rem', fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
          }}
        />
        <button {...pillBtn(() => goToDate(1))}><ChevronRight size={14} /></button>
        <button {...pillBtn(handleRandom)}><Shuffle size={14} /> Random</button>
        <button {...pillBtn(toggleFavorite, undefined, isFavorite, { background: isFavorite ? 'var(--lcars-rust)' : undefined })}>
          <Heart size={14} fill={isFavorite ? '#000' : 'none'} />
        </button>
        <button {...pillBtn(() => setShowFavorites(!showFavorites), undefined, showFavorites)}>
          Favorites ({favorites.length})
        </button>
        {apod?.hdurl && (
          <a href={apod.hdurl} target="_blank" rel="noopener noreferrer"
            style={{ ...pillBtn(() => {}).style, textDecoration: 'none' }}>
            <ExternalLink size={14} /> HD
          </a>
        )}
      </div>

      {error && (
        <LCARSPanel title="Error" color="var(--lcars-red-alert)" style={{ marginBottom: '0.75rem' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem', color: 'var(--lcars-red-alert)' }}>
            {error}
          </div>
        </LCARSPanel>
      )}

      {loading && (
        <div style={{
          textAlign: 'center', padding: '3rem',
          fontFamily: "'Antonio', sans-serif", color: 'var(--lcars-ice)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Accessing stellar database...
        </div>
      )}

      {!loading && apod && (
        <LCARSPanel title={apod.title || 'Untitled'} color="var(--lcars-african-violet)">
          {/* Media */}
          {apod.media_type === 'image' ? (
            <img src={apod.url} alt={apod.title}
              style={{ width: '100%', maxHeight: '550px', objectFit: 'contain', background: '#000' }} />
          ) : apod.media_type === 'video' ? (
            <div>
              <iframe src={apod.url} title={apod.title}
                style={{ width: '100%', height: '400px', border: 'none', background: '#000' }}
                allowFullScreen />
              <a href={apod.url} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  color: 'var(--lcars-ice)', fontSize: '0.8rem', marginTop: '0.5rem',
                  textDecoration: 'none', fontFamily: "'JetBrains Mono', monospace" }}>
                Watch on YouTube <ExternalLink size={12} />
              </a>
            </div>
          ) : null}

          {/* Info */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
              color: 'var(--lcars-gray)', marginBottom: '0.5rem',
            }}>
              {formatDate(apod.date)}{apod.copyright ? ` \u2022 ${apod.copyright}` : ''}
            </div>
            <p style={{
              margin: 0, fontSize: '0.85rem', lineHeight: 1.6,
              color: 'var(--lcars-space-white)', fontFamily: 'inherit',
            }}>
              {apod.explanation}
            </p>
          </div>
        </LCARSPanel>
      )}

      {/* Favorites Gallery */}
      {showFavorites && favorites.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
            color: 'var(--lcars-african-violet)', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: '0.5rem',
          }}>
            Saved observations ({favorites.length})
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '6px',
          }}>
            {favorites.map(fav => (
              <div key={fav.id}
                onClick={() => setCurrentDate(fav.date)}
                style={{
                  cursor: 'pointer', background: 'rgba(102, 102, 136, 0.1)',
                  border: '1px solid rgba(102, 102, 136, 0.2)', overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--lcars-african-violet)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(102, 102, 136, 0.2)'}
              >
                {fav.media_type === 'image' && (
                  <img src={fav.url} alt={fav.title}
                    style={{ width: '100%', height: '100px', objectFit: 'cover', opacity: 0.85 }} />
                )}
                <div style={{ padding: '0.375rem 0.5rem' }}>
                  <div style={{
                    fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
                    color: 'var(--lcars-space-white)', textTransform: 'uppercase',
                  }}>{fav.title}</div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
                    color: 'var(--lcars-gray)',
                  }}>{formatDate(fav.date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
