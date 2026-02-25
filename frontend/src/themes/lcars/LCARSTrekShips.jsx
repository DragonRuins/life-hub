/**
 * LCARSTrekShips.jsx - Starship Registry (LCARS Theme)
 *
 * LCARS-styled vessel registry with class filter and ship list.
 * Route: /trek/ships
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, X, ArrowLeft } from 'lucide-react'
import { trek } from '../../api/client'
import { getTrekRoute } from '../../utils/trekHelpers'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'

export default function LCARSTrekShips() {
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

  const totalPages = pageInfo.totalPages || 1

  const paginationFooter = totalPages > 1 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <PillButton onClick={() => loadShips(Math.max(0, page - 1), selectedClass?.uid)} disabled={page === 0}>
        Prev
      </PillButton>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
        color: 'var(--lcars-text-on-color)', fontWeight: 600,
      }}>
        {page + 1}/{totalPages}
      </span>
      <PillButton onClick={() => loadShips(Math.min(totalPages - 1, page + 1), selectedClass?.uid)} disabled={page >= totalPages - 1}>
        Next
      </PillButton>
    </div>
  ) : null

  if (loading) {
    return (
      <LCARSPanel title="Vessel Registry" color="var(--lcars-sunflower)">
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '1rem',
            color: 'var(--lcars-sunflower)', textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}>
            Accessing vessel registry...
          </span>
        </div>
      </LCARSPanel>
    )
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

      {/* Class Filter */}
      {classes.length > 0 && (
        <LCARSPanel title="Vessel Classification" color="var(--lcars-tanoi)">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {selectedClass && (
              <button
                className="lcars-element button auto"
                onClick={() => filterByClass(null)}
                style={{
                  padding: '0.25rem 0.625rem', borderRadius: '10px',
                  background: 'var(--lcars-tomato)', border: 'none',
                  height: 'auto', fontSize: '0.7rem',
                  alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                }}
              >
                <X size={10} /> Clear
              </button>
            )}
            {classes.slice(0, 30).map(cls => (
              <button
                className="lcars-element button auto"
                key={cls.uid}
                onClick={() => filterByClass(cls)}
                style={{
                  padding: '0.25rem 0.625rem', borderRadius: '10px',
                  background: selectedClass?.uid === cls.uid ? 'var(--lcars-sunflower)' : 'var(--lcars-tanoi)',
                  border: 'none', height: 'auto', fontSize: '0.7rem',
                  opacity: selectedClass?.uid === cls.uid ? 1 : 0.7,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                {cls.name}
              </button>
            ))}
          </div>
        </LCARSPanel>
      )}

      {/* Ships List */}
      <LCARSPanel
        title={selectedClass ? `${selectedClass.name} Class Vessels` : 'Vessel Registry'}
        color="var(--lcars-sunflower)"
        footer={paginationFooter}
      >
        {loadingShips ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
              color: 'var(--lcars-sunflower)', textTransform: 'uppercase',
            }}>
              Loading...
            </span>
          </div>
        ) : ships.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
              color: 'var(--lcars-gray)', textTransform: 'uppercase',
            }}>
              No vessels found
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {ships.map(ship => (
              <Link
                key={ship.uid}
                to={getTrekRoute('spacecraft', ship.uid)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.75rem', textDecoration: 'none',
                  color: 'inherit', borderLeft: '3px solid var(--lcars-sunflower)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 204, 153, 0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  flex: 1, fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
                  textTransform: 'uppercase', color: 'var(--lcars-space-white)',
                  letterSpacing: '0.03em',
                }}>
                  {ship.name}
                </span>
                {ship.registry && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem',
                    fontWeight: 600, color: 'var(--lcars-sunflower)',
                  }}>
                    {ship.registry}
                  </span>
                )}
                <ChevronRight size={14} style={{ color: 'var(--lcars-gray)', flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        )}
      </LCARSPanel>
    </div>
  )
}

function PillButton({ onClick, disabled, children }) {
  return (
    <button
      className="lcars-element button auto"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.2rem 0.75rem', borderRadius: '10px',
        background: disabled ? 'var(--lcars-gray)' : '#000',
        border: 'none', height: 'auto',
        fontSize: '0.7rem',
        color: disabled ? '#666' : 'var(--lcars-sunflower)',
        opacity: disabled ? 0.5 : 1,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
}
