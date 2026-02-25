/**
 * LCARSTrekBrowse.jsx - Category Browser (LCARS Theme)
 *
 * LCARS-styled paginated list of entities for a given type.
 * Route: /trek/:entityType
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowLeft, Search, X } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekLCARSLabel, getTrekRoute } from '../../utils/trekHelpers'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

export default function LCARSTrekBrowse() {
  const { entityType } = useParams()
  const [entries, setEntries] = useState([])
  const [pageInfo, setPageInfo] = useState({})
  const [lcarsName, setLcarsName] = useState('')
  const [page, setPage] = useState(0)
  const [nameFilter, setNameFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { setPage(0); setNameFilter(''); setActiveFilter(''); setLoading(true) }, [entityType])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const result = await trek.browse(entityType, page, 25, activeFilter)
        setEntries(result.entries || [])
        setPageInfo(result.page || {})
        setLcarsName(result.lcars_name || getTrekLCARSLabel(entityType))
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

  const paginationFooter = totalPages > 1 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <PillButton onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
        Prev
      </PillButton>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
        color: 'var(--lcars-text-on-color)', fontWeight: 600,
      }}>
        {page + 1}/{totalPages}
      </span>
      <PillButton onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
        Next
      </PillButton>
    </div>
  ) : null

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

      {/* Name Filter */}
      <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
          placeholder="Filter by name..."
          style={{
            flex: 1, background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--lcars-gray)', borderRadius: '4px',
            padding: '0.5rem 0.75rem', color: 'var(--lcars-space-white)',
            fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
            outline: 'none', letterSpacing: '0.05em',
          }}
        />
        {activeFilter && (
          <button
            type="button"
            onClick={clearFilter}
            style={{
              padding: '0.5rem 0.75rem', background: 'var(--lcars-tomato)',
              border: 'none', borderRadius: '20px', cursor: 'pointer',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
              fontWeight: 600, textTransform: 'uppercase', color: 'var(--lcars-text-on-color)',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
            }}
          >
            <X size={12} /> Clear
          </button>
        )}
        <button
          type="submit"
          style={{
            padding: '0.5rem 1rem', background: 'var(--lcars-sunflower)',
            border: 'none', borderRadius: '20px', cursor: 'pointer',
            fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
            fontWeight: 600, textTransform: 'uppercase', color: 'var(--lcars-text-on-color)',
          }}
        >
          Filter
        </button>
      </form>

      <LCARSPanel
        title={`${lcarsName || 'Database'}${activeFilter ? ` — "${activeFilter}"` : ''}`}
        color="var(--lcars-sunflower)"
        headerRight={
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
            color: 'var(--lcars-text-on-color)', fontWeight: 600,
          }}>
            {totalElements.toLocaleString()} RECORDS
          </span>
        }
        footer={paginationFooter}
      >
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
              color: 'var(--lcars-sunflower)', textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }}>
              Accessing database...
            </span>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
              color: 'var(--lcars-gray)', textTransform: 'uppercase',
            }}>
              No records found
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {entries.map(entry => {
              const name = entry.name || entry.title || 'Unknown'
              const subInfo = entry.registry || entry.abbreviation || entry.usAirDate || ''
              return (
                <Link
                  key={entry.uid}
                  to={getTrekRoute(entityType, entry.uid)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.5rem 0.75rem', textDecoration: 'none',
                    color: 'inherit', transition: 'background 0.1s',
                    borderLeft: '3px solid var(--lcars-sunflower)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 204, 153, 0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    flex: 1, fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.85rem', textTransform: 'uppercase',
                    color: 'var(--lcars-space-white)', letterSpacing: '0.03em',
                  }}>
                    {name}
                  </span>
                  {subInfo && (
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.75rem', color: 'var(--lcars-gray)',
                    }}>
                      {subInfo}
                    </span>
                  )}
                  <ChevronRight size={14} style={{ color: 'var(--lcars-gray)', flexShrink: 0 }} />
                </Link>
              )
            })}
          </div>
        )}
      </LCARSPanel>
    </div>
  )
}

function PillButton({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.2rem 0.75rem', borderRadius: '10px',
        background: disabled ? 'var(--lcars-gray)' : '#000',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
        fontWeight: 600, textTransform: 'uppercase', color: disabled ? '#666' : 'var(--lcars-sunflower)',
        letterSpacing: '0.05em', opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  )
}
