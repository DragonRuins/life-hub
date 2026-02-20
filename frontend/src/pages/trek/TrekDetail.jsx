/**
 * TrekDetail.jsx - Entity Detail View (Catppuccin Theme)
 *
 * Shows full detail for any Star Trek entity with:
 *   - Header with name, category badge, favorite toggle
 *   - Key facts panel (entity-specific layout)
 *   - Related entities as cross-links
 *   - Personal notes (if favorited)
 *
 * Route: /trek/:entityType/:uid
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronRight, Heart, ArrowLeft } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekCategoryLabel, getTrekRoute, TrekEntityLink, formatStardate, processEntityFields } from '../../utils/trekHelpers'

export default function TrekDetail() {
  const { entityType, uid } = useParams()
  const [data, setData] = useState(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteId, setFavoriteId] = useState(null)
  const [favoriteNotes, setFavoriteNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const result = await trek.detail(entityType, uid)
        setData(result)
        setIsFavorite(result.is_favorite || false)
        setFavoriteId(result.favorite_id)
        setFavoriteNotes(result.favorite_notes || '')
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [entityType, uid])

  async function toggleFavorite() {
    if (isFavorite && favoriteId) {
      try {
        await trek.favorites.remove(favoriteId)
        setIsFavorite(false)
        setFavoriteId(null)
      } catch { /* silent */ }
    } else {
      try {
        const entity = getEntityData()
        const result = await trek.favorites.add({
          entity_type: entityType,
          entity_uid: uid,
          entity_name: entity?.name || entity?.title || 'Unknown',
          summary_data: {},
        })
        setIsFavorite(true)
        setFavoriteId(result.id)
      } catch { /* silent */ }
    }
  }

  async function saveNotes() {
    if (!favoriteId) return
    try {
      await trek.favorites.update(favoriteId, { notes: favoriteNotes })
    } catch { /* silent */ }
  }

  function getEntityData() {
    if (!data?.data) return null
    const detailKey = data.detail_key || entityType
    return data.data[detailKey] || data.data
  }

  if (loading) return <LoadingSkeleton />
  if (error) return (
    <div style={{ maxWidth: '800px' }}>
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--color-red)', marginBottom: '1rem' }}>Error: {error}</p>
        <Link to="/trek" className="btn btn-ghost">Back to Database</Link>
      </div>
    </div>
  )

  const entity = getEntityData()
  if (!entity) return null

  const name = entity.name || entity.title || 'Unknown'

  return (
    <div style={{ maxWidth: '800px' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Link to="/trek" style={{ color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem' }}>
          Database
        </Link>
        <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
        <Link to={`/trek/${entityType}`} style={{ color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem' }}>
          {getTrekCategoryLabel(entityType)}
        </Link>
        <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{name}</span>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{name}</h1>
              <span style={{
                fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '999px',
                background: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)',
                textTransform: 'uppercase', fontWeight: 600,
              }}>
                {getTrekCategoryLabel(entityType)}
              </span>
            </div>
            {entity.uid && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-overlay-0)', fontFamily: "'JetBrains Mono', monospace" }}>
                UID: {entity.uid}
              </div>
            )}
          </div>
          <button
            onClick={toggleFavorite}
            className="btn btn-ghost"
            style={{ flexShrink: 0, color: isFavorite ? 'var(--color-red)' : 'var(--color-overlay-0)' }}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Key Facts + Indicators */}
      <EntityFields entity={entity} entityType={entityType} />

      {/* Related Entities */}
      <RelatedEntities entity={entity} entityType={entityType} />

      {/* Notes (when favorited) */}
      {isFavorite && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Personal Notes</h2>
          <textarea
            value={favoriteNotes}
            onChange={e => setFavoriteNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Add your notes about this entry..."
            rows={4}
            style={{
              width: '100%', background: 'var(--color-mantle)', border: '1px solid var(--color-surface-0)',
              borderRadius: '8px', padding: '0.75rem', color: 'var(--color-text)',
              fontSize: '0.85rem', resize: 'vertical', outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  )
}


// ── Entity Fields Renderer ──────────────────────────────────────────────

function EntityFields({ entity, entityType }) {
  const { fields, indicators } = processEntityFields(entity)

  return (
    <>
      {fields.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Details</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
            {fields.map(field => (
              <div key={field.label} style={{ padding: '0.5rem', background: 'var(--color-mantle)', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.125rem' }}>
                  {field.label}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                  {field.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {indicators.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Classification</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem' }}>
            {indicators.map(ind => (
              <div
                key={ind.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}
              >
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: ind.active ? 'var(--color-green)' : 'var(--color-surface-1)',
                  boxShadow: ind.active ? '0 0 6px var(--color-green)' : 'none',
                  opacity: ind.active ? 1 : 0.4,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: '0.8rem',
                  color: ind.active ? 'var(--color-text)' : 'var(--color-overlay-0)',
                  opacity: ind.active ? 1 : 0.6,
                }}>
                  {ind.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {fields.length === 0 && indicators.length === 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>No additional details available</p>
        </div>
      )}
    </>
  )
}


// ── Related Entities ────────────────────────────────────────────────────

function RelatedEntities({ entity, entityType }) {
  // Look for arrays of related entities (objects with uid + name/title)
  const relatedSections = Object.entries(entity).filter(([key, value]) => {
    if (!Array.isArray(value) || value.length === 0) return false
    // Check if items have uid and name/title
    return value[0] && (value[0].uid || value[0].name || value[0].title)
  })

  if (relatedSections.length === 0) return null

  return (
    <>
      {relatedSections.map(([key, items]) => (
        <div key={key} className="card" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'capitalize' }}>
            {formatFieldName(key)}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {items.slice(0, 30).map((item, i) => {
              const itemName = item.name || item.title || 'Unknown'
              const relType = inferEntityType(key)
              return item.uid ? (
                <Link
                  key={item.uid || i}
                  to={getTrekRoute(relType, item.uid)}
                  style={{
                    fontSize: '0.8rem', padding: '0.25rem 0.625rem',
                    background: 'var(--color-mantle)', borderRadius: '6px',
                    textDecoration: 'none', color: 'var(--color-blue)',
                    border: '1px solid var(--color-surface-0)',
                  }}
                >
                  {itemName}
                </Link>
              ) : (
                <span key={i} style={{
                  fontSize: '0.8rem', padding: '0.25rem 0.625rem',
                  background: 'var(--color-mantle)', borderRadius: '6px',
                  color: 'var(--color-text)',
                }}>
                  {itemName}
                </span>
              )
            })}
            {items.length > 30 && (
              <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', padding: '0.25rem' }}>
                +{items.length - 30} more
              </span>
            )}
          </div>
        </div>
      ))}
    </>
  )
}


// ── Utilities ────────────────────────────────────────────────────────────

function formatFieldName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
}

function inferEntityType(fieldName) {
  // Map relation field names to entity types for cross-linking
  const map = {
    characters: 'character', performers: 'performer', episodes: 'episode',
    seasons: 'season', series: 'series', movies: 'movie',
    spacecrafts: 'spacecraft', spacecraftClasses: 'spacecraftClass',
    species: 'species', organizations: 'organization',
    writers: 'staff', directors: 'staff', staff: 'staff',
    astronomicalObjects: 'astronomicalObject', locations: 'location',
    foods: 'food', animals: 'animal', weapons: 'weapon',
    technology: 'technology', materials: 'material',
    occupations: 'occupation', titles: 'title',
    books: 'book', companies: 'company', soundtracks: 'soundtrack',
    comicSeries: 'comicSeries', videoGames: 'videoGame',
  }
  return map[fieldName] || fieldName.replace(/s$/, '')
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ height: '1rem', width: '200px', background: 'var(--color-surface-0)', borderRadius: '4px', marginBottom: '1rem', opacity: 0.3 }} />
      <div style={{ height: '120px', background: 'var(--color-surface-0)', borderRadius: '12px', marginBottom: '1rem', opacity: 0.3 }} />
      <div style={{ height: '200px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
    </div>
  )
}
