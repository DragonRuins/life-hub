/**
 * TrekSearch.jsx - Search Results (Catppuccin Theme)
 *
 * Shows search results grouped by entity type.
 * Route: /trek/search?q=picard
 */
import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ChevronRight, ChevronDown } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekCategoryLabel, getTrekRoute } from '../../utils/trekHelpers'

export default function TrekSearch() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})

  useEffect(() => {
    const q = searchParams.get('q')
    if (q && q.length >= 2) {
      setQuery(q)
      doSearch(q)
    }
  }, [searchParams])

  async function doSearch(q) {
    setLoading(true)
    try {
      const result = await trek.search(q)
      setResults(result.results || {})
      setTotal(result.total || 0)
      // Expand all groups by default
      const expanded = {}
      Object.keys(result.results || {}).forEach(k => { expanded[k] = true })
      setExpandedGroups(expanded)
    } catch { setResults({}); setTotal(0) }
    finally { setLoading(false) }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (query.trim().length >= 2) {
      setSearchParams({ q: query.trim() })
    }
  }

  function toggleGroup(key) {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Link to="/trek" style={{ color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem' }}>
          Database
        </Link>
        <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
        <span style={{ fontSize: '0.85rem' }}>Search</span>
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Search Database</h1>

      {/* Search Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <div style={{
          display: 'flex', gap: '0.5rem',
          background: 'var(--color-mantle)', borderRadius: '12px',
          padding: '0.5rem 0.75rem', border: '1px solid var(--color-surface-0)',
        }}>
          <Search size={18} style={{ color: 'var(--color-overlay-0)', flexShrink: 0, marginTop: '0.25rem' }} />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search characters, ships, episodes..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--color-text)', fontSize: '0.95rem',
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}>
            Search
          </button>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-subtext-0)' }}>Searching...</div>
      ) : total === 0 && searchParams.get('q') ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>
            No results found for "{searchParams.get('q')}"
          </p>
        </div>
      ) : (
        <>
          {total > 0 && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)', marginBottom: '1rem' }}>
              {total} result{total !== 1 ? 's' : ''} found
            </p>
          )}

          {Object.entries(results).map(([type, items]) => (
            <div key={type} className="card" style={{ marginBottom: '0.75rem' }}>
              <button
                onClick={() => toggleGroup(type)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  color: 'inherit', padding: 0, marginBottom: expandedGroups[type] ? '0.75rem' : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.9rem', fontWeight: 600 }}>{getTrekCategoryLabel(type)}</h3>
                  <span style={{
                    fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '999px',
                    background: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {items.length}
                  </span>
                </div>
                <ChevronDown size={16} style={{
                  color: 'var(--color-overlay-0)',
                  transform: expandedGroups[type] ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }} />
              </button>

              {expandedGroups[type] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {items.map(item => (
                    <Link
                      key={item.uid}
                      to={getTrekRoute(type, item.uid)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.5rem 0.625rem', background: 'var(--color-mantle)',
                        borderRadius: '6px', textDecoration: 'none', color: 'inherit',
                        fontSize: '0.85rem',
                      }}
                    >
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                      {item.summary_data && Object.values(item.summary_data).filter(Boolean).length > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                          {Object.values(item.summary_data).filter(Boolean)[0]}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
