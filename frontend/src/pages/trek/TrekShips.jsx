/**
 * TrekShips.jsx - Starship Registry (Catppuccin Theme)
 *
 * Shows spacecraft classes and individual ships.
 * Route: /trek/ships
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronLeft, Rocket, X } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekRoute } from '../../utils/trekHelpers'

export default function TrekShips() {
  const [ships, setShips] = useState([])
  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [pageInfo, setPageInfo] = useState({})
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingShips, setLoadingShips] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const [shipsResult, classResult] = await Promise.all([
          trek.ships.list(0),
          trek.ships.classes(),
        ])
        setShips(shipsResult.ships || [])
        setPageInfo(shipsResult.page || {})
        setClasses(classResult.classes || [])
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  async function loadShips(p = 0, classUid = null) {
    setLoadingShips(true)
    try {
      const result = await trek.ships.list(p, classUid || undefined)
      setShips(result.ships || [])
      setPageInfo(result.page || {})
      setPage(p)
    } catch { /* silent */ }
    finally { setLoadingShips(false) }
  }

  function filterByClass(cls) {
    setSelectedClass(cls)
    loadShips(0, cls?.uid)
  }

  if (loading) return <LoadingSkeleton />

  const totalPages = pageInfo.totalPages || 1

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <Link to="/trek" style={{ color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.85rem' }}>
          Database
        </Link>
        <ChevronRight size={14} style={{ color: 'var(--color-overlay-0)' }} />
        <span style={{ fontSize: '0.85rem' }}>Starship Registry</span>
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Starship Registry</h1>

      {/* Class Filter */}
      {classes.length > 0 && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Filter by Class</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {selectedClass && (
              <button
                onClick={() => filterByClass(null)}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
              >
                <X size={12} /> Clear
              </button>
            )}
            {classes.slice(0, 30).map(cls => (
              <button
                key={cls.uid}
                onClick={() => filterByClass(cls)}
                style={{
                  fontSize: '0.75rem', padding: '0.25rem 0.625rem',
                  borderRadius: '999px', border: '1px solid var(--color-surface-0)',
                  background: selectedClass?.uid === cls.uid ? 'var(--color-blue)' : 'var(--color-mantle)',
                  color: selectedClass?.uid === cls.uid ? 'var(--color-crust)' : 'var(--color-text)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {cls.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ships List */}
      {loadingShips ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-subtext-0)' }}>Loading...</div>
      ) : ships.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>No ships found</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {ships.map(ship => (
              <Link
                key={ship.uid}
                to={getTrekRoute('spacecraft', ship.uid)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.875rem', background: 'var(--color-mantle)',
                  borderRadius: '10px', textDecoration: 'none', color: 'inherit',
                  border: '1px solid var(--color-surface-0)',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-teal)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-surface-0)'}
              >
                <Rocket size={18} style={{ color: 'var(--color-teal)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ship.name}</div>
                  {ship.registry && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {ship.registry}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
              <button
                className="btn btn-ghost"
                onClick={() => loadShips(Math.max(0, page - 1), selectedClass?.uid)}
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
                onClick={() => loadShips(Math.min(totalPages - 1, page + 1), selectedClass?.uid)}
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

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '2rem', width: '250px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div style={{ height: '80px', background: 'var(--color-surface-0)', borderRadius: '12px', marginBottom: '1rem', opacity: 0.3 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: '64px', background: 'var(--color-surface-0)', borderRadius: '10px', opacity: 0.2 }} />
        ))}
      </div>
    </div>
  )
}
