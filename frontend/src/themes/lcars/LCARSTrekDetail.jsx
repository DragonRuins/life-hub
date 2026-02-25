/**
 * LCARSTrekDetail.jsx - Entity Detail View (LCARS Theme)
 *
 * LCARS-styled detail view with:
 *   - Header bar with entity name in Trek terminology
 *   - Key facts in structured readout panels
 *   - Related entities as LCARS text buttons
 *   - "ACCESSING DATABASE..." loading state
 *
 * Route: /trek/:entityType/:uid
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Heart, ChevronRight, ArrowLeft } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekLCARSLabel, getTrekRoute, formatStardate, processEntityFields } from '../../utils/trekHelpers'
import LCARSPanel, { LCARSDataRow, LCARSSegmentedDivider } from './LCARSPanel'

export default function LCARSTrekDetail() {
  const { entityType, uid } = useParams()
  const [data, setData] = useState(null)
  const [isFavorite, setIsFavorite] = useState(false)
  const [favoriteId, setFavoriteId] = useState(null)
  const [favoriteNotes, setFavoriteNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null)
      try {
        const result = await trek.detail(entityType, uid)
        setData(result)
        setIsFavorite(result.is_favorite || false)
        setFavoriteId(result.favorite_id)
        setFavoriteNotes(result.favorite_notes || '')
      } catch (e) { setError(e.message) }
      finally { setLoading(false) }
    }
    load()
  }, [entityType, uid])

  async function toggleFavorite() {
    if (isFavorite && favoriteId) {
      try { await trek.favorites.remove(favoriteId); setIsFavorite(false); setFavoriteId(null) }
      catch { /* silent */ }
    } else {
      try {
        const entity = getEntityData()
        const result = await trek.favorites.add({
          entity_type: entityType, entity_uid: uid,
          entity_name: entity?.name || entity?.title || 'Unknown',
        })
        setIsFavorite(true); setFavoriteId(result.id)
      } catch { /* silent */ }
    }
  }

  async function saveNotes() {
    if (!favoriteId) return
    try { await trek.favorites.update(favoriteId, { notes: favoriteNotes }) }
    catch { /* silent */ }
  }

  function getEntityData() {
    if (!data?.data) return null
    const detailKey = data.detail_key || entityType
    return data.data[detailKey] || data.data
  }

  if (loading) {
    return (
      <LCARSPanel title="Accessing Database..." color="var(--lcars-sunflower)">
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '1rem',
            color: 'var(--lcars-sunflower)', textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}>
            Retrieving record...
          </span>
        </div>
      </LCARSPanel>
    )
  }

  if (error) {
    return (
      <LCARSPanel title="Database Error" color="var(--lcars-tomato)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{ color: 'var(--lcars-tomato)', fontFamily: "'Antonio', sans-serif" }}>
            {error}
          </span>
        </div>
      </LCARSPanel>
    )
  }

  const entity = getEntityData()
  if (!entity) return null

  const name = entity.name || entity.title || 'Unknown'
  const lcarsLabel = getTrekLCARSLabel(entityType)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Back link */}
      <Link
        to={`/trek/${entityType}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
          color: 'var(--lcars-ice)', textDecoration: 'none',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.8rem', textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <ArrowLeft size={14} />
        {lcarsLabel}
      </Link>

      {/* Header Panel */}
      <LCARSPanel
        title={`${lcarsLabel}: ${name}`}
        color="var(--lcars-gold)"
        headerRight={
          <button
            onClick={toggleFavorite}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: isFavorite ? 'var(--lcars-tomato)' : 'var(--lcars-text-on-color)',
              display: 'flex', alignItems: 'center',
            }}
          >
            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        }
      >
        {entity.uid && (
          <LCARSDataRow label="UID" value={entity.uid} color="var(--lcars-gold)" />
        )}
      </LCARSPanel>

      {/* Key Facts + Indicators */}
      <LCARSEntityFields entity={entity} />

      {/* Related Entities */}
      <LCARSRelatedEntities entity={entity} entityType={entityType} />

      {/* Notes (when favorited) */}
      {isFavorite && (
        <LCARSPanel title="Personal Log Entry" color="var(--lcars-african-violet)">
          <textarea
            value={favoriteNotes}
            onChange={e => setFavoriteNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Enter personal log..."
            rows={4}
            style={{
              width: '100%', background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--lcars-gray)', borderRadius: '4px',
              padding: '0.75rem', color: 'var(--lcars-space-white)',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
              resize: 'vertical', outline: 'none', letterSpacing: '0.03em',
            }}
          />
        </LCARSPanel>
      )}
    </div>
  )
}


function LCARSEntityFields({ entity }) {
  const { fields, indicators } = processEntityFields(entity)

  const colors = ['var(--lcars-sunflower)', 'var(--lcars-tanoi)']

  return (
    <>
      {fields.length > 0 && (
        <LCARSPanel title="Record Data" color="var(--lcars-sunflower)">
          <div>
            {fields.map((field, i) => (
              <LCARSDataRow
                key={field.label}
                label={field.label}
                value={field.value}
                color={colors[i % 2]}
              />
            ))}
          </div>
        </LCARSPanel>
      )}

      {indicators.length > 0 && (
        <LCARSPanel title="Classification" color="var(--lcars-tanoi)">
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.25rem',
            padding: '0.25rem 0',
          }}>
            {indicators.map(ind => (
              <div
                key={ind.key}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}
              >
                {/* Indicator light */}
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: ind.active ? 'var(--lcars-sunflower)' : 'var(--lcars-gray)',
                  boxShadow: ind.active ? '0 0 6px var(--lcars-sunflower), 0 0 12px rgba(255, 204, 153, 0.3)' : 'none',
                  opacity: ind.active ? 1 : 0.3,
                  transition: 'all 0.2s ease',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.78rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: ind.active ? 'var(--lcars-space-white)' : 'var(--lcars-gray)',
                  opacity: ind.active ? 1 : 0.5,
                }}>
                  {ind.label}
                </span>
              </div>
            ))}
          </div>
        </LCARSPanel>
      )}

      {fields.length === 0 && indicators.length === 0 && (
        <LCARSPanel title="Record Data" color="var(--lcars-sunflower)">
          <span style={{ color: 'var(--lcars-gray)', fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem' }}>
            No additional data available
          </span>
        </LCARSPanel>
      )}
    </>
  )
}


function LCARSRelatedEntities({ entity, entityType }) {
  const relatedSections = Object.entries(entity).filter(([key, value]) => {
    if (!Array.isArray(value) || value.length === 0) return false
    return value[0] && (value[0].uid || value[0].name || value[0].title)
  })

  if (relatedSections.length === 0) return null

  const relColors = ['var(--lcars-ice)', 'var(--lcars-african-violet)', 'var(--lcars-butterscotch)', 'var(--lcars-lilac)']

  return (
    <>
      {relatedSections.map(([key, items], sectionIndex) => {
        const color = relColors[sectionIndex % relColors.length]
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim()
        const relType = inferEntityType(key)

        return (
          <LCARSPanel key={key} title={label} color={color}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {items.slice(0, 30).map((item, i) => {
                const itemName = item.name || item.title || 'Unknown'
                return item.uid ? (
                  <Link
                    className="lcars-element button auto"
                    key={item.uid || i}
                    to={getTrekRoute(relType, item.uid)}
                    style={{
                      padding: '0.25rem 0.625rem', borderRadius: '10px',
                      background: color, textDecoration: 'none',
                      height: 'auto', fontSize: '0.75rem',
                      alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    {itemName}
                  </Link>
                ) : (
                  <span
                    key={i}
                    style={{
                      padding: '0.25rem 0.625rem', borderRadius: '10px',
                      background: 'var(--lcars-gray)', color: 'var(--lcars-text-on-color)',
                      fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
                      fontWeight: 600, textTransform: 'uppercase',
                    }}
                  >
                    {itemName}
                  </span>
                )
              })}
              {items.length > 30 && (
                <span style={{
                  padding: '0.25rem', fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.75rem', color: 'var(--lcars-gray)',
                }}>
                  +{items.length - 30} MORE
                </span>
              )}
            </div>
          </LCARSPanel>
        )
      })}
    </>
  )
}


function inferEntityType(fieldName) {
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
  }
  return map[fieldName] || fieldName.replace(/s$/, '')
}
