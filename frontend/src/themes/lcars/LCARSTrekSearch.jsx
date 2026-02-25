/**
 * LCARSTrekSearch.jsx - Search Results (LCARS Theme)
 *
 * LCARS-styled search with "COMPUTER QUERY IN PROGRESS..." loading state.
 * Route: /trek/search?q=picard
 */
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ChevronRight, ChevronDown, ArrowLeft } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekLCARSLabel, getTrekRoute } from '../../utils/trekHelpers'
import LCARSPanel, { LCARSSegmentedDivider } from './LCARSPanel'

export default function LCARSTrekSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.length >= 2) { setQuery(q); doSearch(q) }
  }, [searchParams])

  async function doSearch(q) {
    setLoading(true)
    try {
      const result = await trek.search(q)
      setResults(result.results || {})
      setTotal(result.total || 0)
      const expanded = {}
      Object.keys(result.results || {}).forEach(k => { expanded[k] = true })
      setExpandedGroups(expanded)
    } catch { setResults({}); setTotal(0) }
    finally { setLoading(false) }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (query.trim().length >= 2) setSearchParams({ q: query.trim() })
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

      {/* Search Input */}
      <LCARSPanel title="Computer Query Interface" color="var(--lcars-ice)">
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Enter search parameters..."
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
              fontWeight: 600, textTransform: 'uppercase', color: 'var(--lcars-text-on-color)',
            }}
          >
            Execute
          </button>
        </form>
      </LCARSPanel>

      {/* Results */}
      {loading ? (
        <LCARSPanel title="Processing Query" color="var(--lcars-sunflower)">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '1rem',
              color: 'var(--lcars-sunflower)', textTransform: 'uppercase',
              letterSpacing: '0.15em',
            }}>
              Computer query in progress...
            </span>
          </div>
        </LCARSPanel>
      ) : total === 0 && searchParams.get('q') ? (
        <LCARSPanel title="Query Result" color="var(--lcars-gray)">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
              color: 'var(--lcars-gray)', textTransform: 'uppercase',
            }}>
              No records match query "{searchParams.get('q')}"
            </span>
          </div>
        </LCARSPanel>
      ) : Object.entries(results).length > 0 && (
        <>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
            color: 'var(--lcars-gray)', padding: '0 0.5rem',
          }}>
            {total} record{total !== 1 ? 's' : ''} found
          </div>

          {Object.entries(results).map(([type, items]) => {
            const colors = ['var(--lcars-ice)', 'var(--lcars-sunflower)', 'var(--lcars-african-violet)',
              'var(--lcars-butterscotch)', 'var(--lcars-lilac)', 'var(--lcars-tanoi)']
            const colorIndex = Object.keys(results).indexOf(type)
            const color = colors[colorIndex % colors.length]

            return (
              <LCARSPanel
                key={type}
                title={`${getTrekLCARSLabel(type)} — ${items.length} result${items.length !== 1 ? 's' : ''}`}
                color={color}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {items.map(item => (
                    <Link
                      key={item.uid}
                      to={getTrekRoute(type, item.uid)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.5rem 0.75rem', textDecoration: 'none',
                        color: 'inherit', borderLeft: `3px solid ${color}`,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = `color-mix(in srgb, ${color} 5%, transparent)`}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{
                        flex: 1, fontFamily: "'Antonio', sans-serif",
                        fontSize: '0.85rem', textTransform: 'uppercase',
                        color: 'var(--lcars-space-white)', letterSpacing: '0.03em',
                      }}>
                        {item.name}
                      </span>
                      <ChevronRight size={14} style={{ color: 'var(--lcars-gray)', flexShrink: 0 }} />
                    </Link>
                  ))}
                </div>
              </LCARSPanel>
            )
          })}
        </>
      )}
    </div>
  )
}
