/**
 * TrekBrowse.jsx - Category Browser (Catppuccin Theme)
 *
 * Paginated card grid of entities for a given type.
 * Route: /trek/:entityType
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekCategoryLabel, getTrekRoute } from '../../utils/trekHelpers'

export default function TrekBrowse() {
  const { entityType } = useParams()
  const [entries, setEntries] = useState([])
  const [pageInfo, setPageInfo] = useState({})
  const [displayName, setDisplayName] = useState('')
  const [page, setPage] = useState(0)
  const [nameFilter, setNameFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPage(0)
    setNameFilter('')
    setActiveFilter('')
    setLoading(true)
  }, [entityType])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const result = await trek.browse(entityType, page, 25, activeFilter)
        setEntries(result.entries || [])
        setPageInfo(result.page || {})
        setDisplayName(result.display_name || getTrekCategoryLabel(entityType))
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [entityType, page, activeFilter])

  function handleFilterSubmit(e) {
    e.preventDefault()
    setPage(0)
    setActiveFilter(nameFilter.trim())
  }

  function clearFilter() {
    setNameFilter('')
    setActiveFilter('')
    setPage(0)
  }

  const totalPages = pageInfo.totalPages || 1
  const totalElements = pageInfo.totalElements || 0

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <Link to="/trek" style={{ color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem' }}>
            Database
          </Link>
          <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{displayName}</span>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{displayName}</h1>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
          {totalElements.toLocaleString()} entries{activeFilter ? ` matching "${activeFilter}"` : ''}
        </p>
      </div>

      {/* Name Filter */}
      <form onSubmit={handleFilterSubmit} style={{ marginBottom: '1rem' }}>
        <div style={{
          display: 'flex', gap: '0.5rem',
          background: 'var(--color-mantle)', borderRadius: '12px',
          padding: '0.5rem 0.75rem', border: '1px solid var(--color-surface-0)',
        }}>
          <Search size={18} style={{ color: 'var(--color-overlay-0)', flexShrink: 0, marginTop: '0.25rem' }} />
          <input
            type="text"
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
            placeholder={`Filter ${displayName.toLowerCase()} by name...`}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--color-text)', fontSize: '0.9rem',
            }}
          />
          {activeFilter && (
            <button type="button" onClick={clearFilter} className="btn btn-ghost" style={{ padding: '0.25rem' }}>
              <X size={16} />
            </button>
          )}
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}>
            Filter
          </button>
        </div>
      </form>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} style={{ height: '80px', background: 'var(--color-surface-0)', borderRadius: '10px', opacity: 0.3 }} />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>No entries found</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {entries.map(entry => (
              <Link
                key={entry.uid}
                to={getTrekRoute(entityType, entry.uid)}
                style={{
                  display: 'block', padding: '0.875rem',
                  background: 'var(--color-mantle)', borderRadius: '10px',
                  textDecoration: 'none', color: 'inherit',
                  border: '1px solid var(--color-surface-0)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-surface-1)'; e.currentTarget.style.background = 'var(--color-surface-0)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-surface-0)'; e.currentTarget.style.background = 'var(--color-mantle)' }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                  {entry.name || entry.title || 'Unknown'}
                </div>
                {/* Show a few summary fields */}
                <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                  {entry.registry && <span>Registry: {entry.registry} </span>}
                  {entry.yearOfBirth && <span>Born: {entry.yearOfBirth} </span>}
                  {entry.abbreviation && <span>{entry.abbreviation} </span>}
                  {entry.seasonNumber != null && <span>Season {entry.seasonNumber} </span>}
                  {entry.episodeNumber != null && <span>Ep {entry.episodeNumber} </span>}
                  {entry.usAirDate && <span>{entry.usAirDate}</span>}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ fontSize: '0.85rem' }}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', fontFamily: "'JetBrains Mono', monospace" }}>
                {page + 1} / {totalPages}
              </span>
              <button
                className="btn btn-ghost"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{ fontSize: '0.85rem' }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
