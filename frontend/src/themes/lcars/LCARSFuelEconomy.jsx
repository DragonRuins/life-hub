/**
 * LCARSFuelEconomy.jsx - LCARS-native Fuel Economy Page
 *
 * Replaces the default FuelEconomy when LCARS theme is active.
 * Charts get LCARS styling (custom tooltip, grid, axes colors).
 * Stats displayed as sensor readouts in LCARSPanel.
 * Table wrapped in LCARS panel with proper data-terminal aesthetics.
 *
 * Route: /vehicles/:id/fuel
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Fuel, Trash2, Pencil, TrendingUp, TrendingDown, DollarSign, Droplets, Gauge, BarChart3, ChevronLeft } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { vehicles, fuel } from '../../api/client'
import FuelForm from '../../components/FuelForm'
import { formatDate, formatShortDate } from '../../utils/formatDate'
import useIsMobile from '../../hooks/useIsMobile'
import LCARSPanel, { LCARSStat } from './LCARSPanel'
import LCARSModal from './LCARSModal'

export default function LCARSFuelEconomy() {
  const { id } = useParams()
  const vehicleId = parseInt(id)
  const isMobile = useIsMobile()

  const [vehicle, setVehicle] = useState(null)
  const [entries, setEntries] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('all')
  const [editingEntry, setEditingEntry] = useState(null)
  const [showEditForm, setShowEditForm] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [v, entriesData, statsData] = await Promise.all([
          vehicles.get(vehicleId),
          fuel.entries(vehicleId),
          fuel.stats(vehicleId),
        ])
        setVehicle(v)
        setEntries(entriesData)
        setStats(statsData)
      } catch (err) {
        console.error('Failed to load fuel data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [vehicleId])

  async function handleUpdateEntry(data) {
    try {
      await vehicles.fuelLogs.update(editingEntry.id, data)
      const [entriesData, statsData] = await Promise.all([
        fuel.entries(vehicleId),
        fuel.stats(vehicleId),
      ])
      setEntries(entriesData)
      setStats(statsData)
      setEditingEntry(null)
      setShowEditForm(false)
    } catch (err) {
      alert('Failed to update entry: ' + err.message)
    }
  }

  async function handleDeleteEntry(entryId) {
    if (!confirm('Delete this fuel entry?')) return
    try {
      await fuel.deleteEntry(entryId)
      const [entriesData, statsData] = await Promise.all([
        fuel.entries(vehicleId),
        fuel.stats(vehicleId),
      ])
      setEntries(entriesData)
      setStats(statsData)
    } catch (err) {
      alert('Failed to delete entry: ' + err.message)
    }
  }

  if (loading) return <LCARSLoadingSkeleton />

  // Filter entries by selected timeframe
  const filteredEntries = filterByTimeframe(entries, timeframe)

  // Prepare chart data (oldest first for left-to-right chronological order)
  const chartData = [...filteredEntries]
    .reverse()
    .filter(e => e.mpg != null)
    .map(e => ({
      date: formatShortDate(e.date),
      mpg: e.mpg,
      pricePerGallon: e.cost_per_gallon,
    }))

  const priceChartData = [...filteredEntries]
    .reverse()
    .map(e => ({
      date: formatShortDate(e.date),
      pricePerGallon: e.cost_per_gallon,
    }))

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link
          to={`/vehicles/${vehicleId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            color: 'var(--lcars-ice)',
            textDecoration: 'none',
            fontSize: '0.8rem',
            fontFamily: "'Antonio', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.5rem',
          }}
        >
          <ChevronLeft size={14} />
          {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Back to Vehicle'}
        </Link>
        <h1 style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--lcars-space-white)',
        }}>
          Fuel Economy Analysis
        </h1>
        {vehicle && (
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: 'var(--lcars-sunflower)',
            marginTop: '0.25rem',
          }}>
            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim ? `// ${vehicle.trim}` : ''}
          </div>
        )}
      </div>

      {stats && stats.total_entries > 0 ? (
        <>
          {/* Stats Panel */}
          <LCARSPanel title="Performance Metrics" color="var(--lcars-ice)" style={{ marginBottom: '1rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.25rem',
            }}>
              <LCARSStat
                icon={<Gauge size={18} />}
                label="Avg MPG"
                value={stats.avg_mpg != null ? stats.avg_mpg.toFixed(1) : '\u2014'}
                color="var(--lcars-ice)"
              />
              <LCARSStat
                icon={<BarChart3 size={18} />}
                label="Avg MPG (Last 5)"
                value={stats.avg_mpg_last_5 != null ? stats.avg_mpg_last_5.toFixed(1) : '\u2014'}
                color="var(--lcars-african-violet)"
              />
              <LCARSStat
                icon={<Droplets size={18} />}
                label="Total Gallons"
                value={stats.total_gallons != null ? stats.total_gallons.toLocaleString() : '\u2014'}
                color="var(--lcars-sky)"
              />
              <LCARSStat
                icon={<DollarSign size={18} />}
                label="Total Spent"
                value={stats.total_spent != null ? `$${stats.total_spent.toLocaleString()}` : '\u2014'}
                color="var(--lcars-green)"
              />
              <LCARSStat
                icon={<TrendingUp size={18} />}
                label="Best MPG"
                value={stats.best_mpg != null ? stats.best_mpg.toFixed(1) : '\u2014'}
                color="var(--lcars-green)"
              />
              <LCARSStat
                icon={<TrendingDown size={18} />}
                label="Worst MPG"
                value={stats.worst_mpg != null ? stats.worst_mpg.toFixed(1) : '\u2014'}
                color="var(--lcars-tomato)"
              />
            </div>
          </LCARSPanel>

          {/* Timeframe Selector */}
          <LCARSTimeframeSelector value={timeframe} onChange={setTimeframe} />

          {/* Charts */}
          {chartData.length >= 2 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))',
              gap: '1rem',
              marginBottom: '1rem',
            }}>
              {/* MPG Over Time */}
              <LCARSPanel title="Efficiency Curve // MPG" color="var(--lcars-ice)" noPadding>
                <div style={{ padding: '1rem 0.5rem 0.5rem 0' }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={chartData}>
                      <CartesianGrid
                        strokeDasharray="2 4"
                        stroke="rgba(102, 102, 136, 0.25)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fill: 'var(--lcars-gray)',
                          fontSize: 11,
                          fontFamily: "'Antonio', sans-serif",
                        }}
                        stroke="rgba(102, 102, 136, 0.4)"
                        tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                        axisLine={{ stroke: 'var(--lcars-ice)', strokeWidth: 2 }}
                      />
                      <YAxis
                        tick={{
                          fill: 'var(--lcars-gray)',
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                        stroke="rgba(102, 102, 136, 0.4)"
                        tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                        axisLine={{ stroke: 'var(--lcars-ice)', strokeWidth: 2 }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<LCARSTooltip unit="MPG" color="var(--lcars-ice)" />} />
                      {stats.avg_mpg && (
                        <ReferenceLine
                          y={stats.avg_mpg}
                          stroke="var(--lcars-sunflower)"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                          label={{
                            value: `AVG ${stats.avg_mpg}`,
                            position: 'right',
                            fill: 'var(--lcars-sunflower)',
                            fontSize: 10,
                            fontFamily: "'Antonio', sans-serif",
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="mpg"
                        stroke="var(--lcars-ice)"
                        strokeWidth={2.5}
                        dot={{
                          fill: '#000000',
                          stroke: 'var(--lcars-ice)',
                          strokeWidth: 2,
                          r: 4,
                        }}
                        activeDot={{
                          fill: 'var(--lcars-ice)',
                          stroke: 'var(--lcars-space-white)',
                          strokeWidth: 2,
                          r: 6,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </LCARSPanel>

              {/* Price Per Gallon Over Time */}
              <LCARSPanel title="Cost Analysis // $/Gallon" color="var(--lcars-green)" noPadding>
                <div style={{ padding: '1rem 0.5rem 0.5rem 0' }}>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={priceChartData}>
                      <CartesianGrid
                        strokeDasharray="2 4"
                        stroke="rgba(102, 102, 136, 0.25)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{
                          fill: 'var(--lcars-gray)',
                          fontSize: 11,
                          fontFamily: "'Antonio', sans-serif",
                        }}
                        stroke="rgba(102, 102, 136, 0.4)"
                        tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                        axisLine={{ stroke: 'var(--lcars-green)', strokeWidth: 2 }}
                      />
                      <YAxis
                        tick={{
                          fill: 'var(--lcars-gray)',
                          fontSize: 11,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                        stroke="rgba(102, 102, 136, 0.4)"
                        tickLine={{ stroke: 'rgba(102, 102, 136, 0.3)' }}
                        axisLine={{ stroke: 'var(--lcars-green)', strokeWidth: 2 }}
                        domain={['auto', 'auto']}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip content={<LCARSTooltip unit="$/gal" color="var(--lcars-green)" prefix="$" decimals={3} />} />
                      {stats.avg_cost_per_gallon && (
                        <ReferenceLine
                          y={stats.avg_cost_per_gallon}
                          stroke="var(--lcars-sunflower)"
                          strokeDasharray="4 4"
                          strokeWidth={1}
                          label={{
                            value: `AVG $${stats.avg_cost_per_gallon}`,
                            position: 'right',
                            fill: 'var(--lcars-sunflower)',
                            fontSize: 10,
                            fontFamily: "'Antonio', sans-serif",
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="pricePerGallon"
                        stroke="var(--lcars-green)"
                        strokeWidth={2.5}
                        dot={{
                          fill: '#000000',
                          stroke: 'var(--lcars-green)',
                          strokeWidth: 2,
                          r: 4,
                        }}
                        activeDot={{
                          fill: 'var(--lcars-green)',
                          stroke: 'var(--lcars-space-white)',
                          strokeWidth: 2,
                          r: 6,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </LCARSPanel>
            </div>
          )}

          {/* Fuel Log */}
          <LCARSPanel
            title={`Fuel Log // ${entries.length} Entries`}
            color="var(--lcars-sunflower)"
            noPadding={!isMobile}
          >
            {isMobile ? (
              /* Mobile: card view */
              <div>
                {entries.map((entry) => (
                  <div key={entry.id} style={{
                    padding: '0.75rem 0',
                    borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.82rem',
                        color: 'var(--lcars-sunflower)',
                      }}>
                        {formatDate(entry.date)}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {entry.mpg != null ? (
                          <span style={{
                            padding: '0.1rem 0.5rem',
                            fontWeight: 600,
                            fontSize: '0.78rem',
                            fontFamily: "'JetBrains Mono', monospace",
                            background: entry.mpg >= (stats?.avg_mpg || 0)
                              ? 'rgba(153, 153, 51, 0.2)'
                              : 'rgba(204, 68, 68, 0.2)',
                            color: entry.mpg >= (stats?.avg_mpg || 0)
                              ? 'var(--lcars-green)'
                              : 'var(--lcars-tomato)',
                            border: `1px solid ${entry.mpg >= (stats?.avg_mpg || 0)
                              ? 'rgba(153, 153, 51, 0.4)'
                              : 'rgba(204, 68, 68, 0.4)'}`,
                          }}>
                            {entry.mpg.toFixed(1)} MPG
                          </span>
                        ) : (
                          <span style={{ color: 'var(--lcars-gray)', fontSize: '0.78rem' }}>
                            {entry.missed_previous ? 'SKIP' : '\u2014'}
                          </span>
                        )}
                        <button
                          onClick={() => { setEditingEntry(entry); setShowEditForm(true) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--lcars-gray)', padding: '0.25rem',
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--lcars-gray)', padding: '0.25rem',
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="form-grid-2col" style={{ gap: '0.2rem 1rem', fontSize: '0.75rem' }}>
                      <div style={{ color: 'var(--lcars-gray)' }}>ODO: <span style={{ color: 'var(--lcars-ice)' }}>{entry.mileage?.toLocaleString()}</span></div>
                      <div style={{ color: 'var(--lcars-gray)' }}>GAL: <span style={{ color: 'var(--lcars-ice)' }}>{entry.gallons_added?.toFixed(2)}</span></div>
                      <div style={{ color: 'var(--lcars-gray)' }}>$/GAL: <span style={{ color: 'var(--lcars-ice)' }}>${entry.cost_per_gallon?.toFixed(3)}</span></div>
                      <div style={{ color: 'var(--lcars-gray)' }}>TOTAL: <span style={{ color: 'var(--lcars-almond-creme)', fontWeight: 600 }}>${entry.total_cost?.toFixed(2)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Desktop: table view */
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.82rem',
                }}>
                  <thead>
                    <tr>
                      <LTh>Date</LTh>
                      <LTh align="right">Odometer</LTh>
                      <LTh align="right">Gallons</LTh>
                      <LTh align="right">Price/Gal</LTh>
                      <LTh align="right">Total Cost</LTh>
                      <LTh align="right">MPG</LTh>
                      <LTh align="center" style={{ width: '40px' }}></LTh>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => {
                      const rowBg = i % 2 !== 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent'
                      return (
                      <tr
                        key={entry.id}
                        style={{ transition: 'background 0.1s', background: rowBg }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 204, 153, 0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = rowBg}
                      >
                        <LTd>{formatDate(entry.date)}</LTd>
                        <LTd align="right">{entry.mileage?.toLocaleString()}</LTd>
                        <LTd align="right">{entry.gallons_added?.toFixed(2)}</LTd>
                        <LTd align="right">${entry.cost_per_gallon?.toFixed(3)}</LTd>
                        <LTd align="right" style={{ fontWeight: 600 }}>${entry.total_cost?.toFixed(2)}</LTd>
                        <LTd align="right">
                          {entry.mpg != null ? (
                            <span style={{
                              display: 'inline-block',
                              padding: '0.1rem 0.5rem',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              fontFamily: "'JetBrains Mono', monospace",
                              background: entry.mpg >= (stats?.avg_mpg || 0)
                                ? 'rgba(153, 153, 51, 0.2)'
                                : 'rgba(204, 68, 68, 0.2)',
                              color: entry.mpg >= (stats?.avg_mpg || 0)
                                ? 'var(--lcars-green)'
                                : 'var(--lcars-tomato)',
                              border: `1px solid ${entry.mpg >= (stats?.avg_mpg || 0)
                                ? 'rgba(153, 153, 51, 0.4)'
                                : 'rgba(204, 68, 68, 0.4)'}`,
                            }}>
                              {entry.mpg.toFixed(1)}
                            </span>
                          ) : (
                            <span style={{
                              color: 'var(--lcars-gray)',
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '0.78rem',
                            }}>
                              {entry.missed_previous ? 'SKIP' : '\u2014'}
                            </span>
                          )}
                        </LTd>
                        <LTd align="center">
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => { setEditingEntry(entry); setShowEditForm(true) }}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--lcars-gray)',
                                padding: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-sunflower)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
                              title="Edit entry"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--lcars-gray)',
                                padding: '0.25rem',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-tomato)'}
                              onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
                              title="Delete entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </LTd>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </LCARSPanel>
        </>
      ) : (
        <LCARSPanel title="No Data" color="var(--lcars-gray)" style={{ marginTop: '1rem' }}>
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <Fuel size={28} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem',
              color: 'var(--lcars-gray)',
              marginBottom: '0.5rem',
            }}>
              No fuel entries for {vehicle?.year} {vehicle?.make} {vehicle?.model}
            </div>
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.78rem',
              color: 'var(--lcars-gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Add fuel logs from the vehicle detail page
            </div>
          </div>
        </LCARSPanel>
      )}

      {/* Edit Fuel Log Modal */}
      <LCARSModal
        isOpen={showEditForm && !!editingEntry}
        onClose={() => { setShowEditForm(false); setEditingEntry(null) }}
        title="Edit Fuel Log"
      >
        {editingEntry && (
          <FuelForm
            vehicleId={vehicleId}
            vehicleMileage={vehicle?.current_mileage}
            fuelLog={editingEntry}
            onSubmit={handleUpdateEntry}
            onCancel={() => { setShowEditForm(false); setEditingEntry(null) }}
          />
        )}
      </LCARSModal>
    </div>
  )
}


/**
 * Custom LCARS-styled Recharts tooltip.
 * Black background with colored accent border, monospace values.
 */
const TIMEFRAMES = [
  { key: 'all', label: 'All Time' },
  { key: '1y', label: '1Y' },
  { key: '6m', label: '6M' },
  { key: '3m', label: '3M' },
  { key: '1m', label: '1M' },
]

/**
 * Filters entries to only those within the selected timeframe.
 */
function filterByTimeframe(entries, timeframe) {
  if (timeframe === 'all') return entries
  const now = new Date()
  const cutoff = new Date(now)
  switch (timeframe) {
    case '1y': cutoff.setFullYear(cutoff.getFullYear() - 1); break
    case '6m': cutoff.setMonth(cutoff.getMonth() - 6); break
    case '3m': cutoff.setMonth(cutoff.getMonth() - 3); break
    case '1m': cutoff.setMonth(cutoff.getMonth() - 1); break
    default: return entries
  }
  return entries.filter(e => new Date(e.date) >= cutoff)
}


/**
 * LCARS-styled timeframe selector bar.
 */
function LCARSTimeframeSelector({ value, onChange }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '3px',
      marginBottom: '1rem',
    }}>
      {/* Label */}
      <span style={{
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        fontSize: '0.72rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--lcars-gray)',
        marginRight: '0.5rem',
        whiteSpace: 'nowrap',
      }}>
        Timeframe
      </span>
      {TIMEFRAMES.map(tf => {
        const isActive = value === tf.key
        return (
          <button
            key={tf.key}
            onClick={() => onChange(tf.key)}
            style={{
              padding: '0.3rem 0.75rem',
              border: 'none',
              background: isActive ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)',
              color: isActive ? 'var(--lcars-text-on-color)' : 'var(--lcars-gray)',
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '0.75rem',
              fontWeight: isActive ? 600 : 400,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderRadius: 0,
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = 'rgba(102, 102, 136, 0.4)'
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = 'rgba(102, 102, 136, 0.25)'
            }}
          >
            {tf.label}
          </button>
        )
      })}
    </div>
  )
}


function LCARSTooltip({ active, payload, label, unit, color, prefix = '', decimals = 1 }) {
  if (!active || !payload?.length) return null

  const value = payload[0].value

  return (
    <div style={{
      background: '#000000',
      border: `2px solid ${color}`,
      borderLeft: `5px solid ${color}`,
      padding: '0.5rem 0.75rem',
      minWidth: '120px',
    }}>
      <div style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--lcars-gray)',
        marginBottom: '0.25rem',
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '1.1rem',
        fontWeight: 700,
        color: 'var(--lcars-space-white)',
      }}>
        {prefix}{typeof value === 'number' ? value.toFixed(decimals) : value}
      </div>
      <div style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color,
        marginTop: '0.125rem',
      }}>
        {unit}
      </div>
    </div>
  )
}


/**
 * LCARS table header cell.
 */
function LTh({ children, align = 'left', style = {} }) {
  return (
    <th style={{
      padding: '0.625rem 1rem',
      textAlign: align,
      fontWeight: 600,
      fontSize: '0.72rem',
      fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--lcars-sunflower)',
      borderBottom: '2px solid var(--lcars-sunflower)',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  )
}


/**
 * LCARS table data cell.
 */
function LTd({ children, align = 'left', style = {} }) {
  return (
    <td style={{
      padding: '0.5rem 1rem',
      textAlign: align,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.8rem',
      color: 'var(--lcars-space-white)',
      borderBottom: '1px solid rgba(102, 102, 136, 0.2)',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </td>
  )
}


/**
 * LCARS loading skeleton.
 */
function LCARSLoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{
        height: '1rem',
        width: '180px',
        background: 'rgba(102, 102, 136, 0.15)',
        marginBottom: '0.5rem',
      }} />
      <div style={{
        height: '1.5rem',
        width: '300px',
        background: 'rgba(102, 102, 136, 0.2)',
        marginBottom: '1.5rem',
      }} />
      {/* Stats skeleton */}
      <div style={{
        height: '120px',
        background: 'rgba(102, 102, 136, 0.06)',
        border: '1px solid rgba(102, 102, 136, 0.15)',
        marginBottom: '1rem',
      }} />
      {/* Charts skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div style={{
          height: '300px',
          background: 'rgba(102, 102, 136, 0.06)',
          border: '1px solid rgba(102, 102, 136, 0.15)',
        }} />
        <div style={{
          height: '300px',
          background: 'rgba(102, 102, 136, 0.06)',
          border: '1px solid rgba(102, 102, 136, 0.15)',
        }} />
      </div>
      {/* Table skeleton */}
      <div style={{
        height: '250px',
        background: 'rgba(102, 102, 136, 0.06)',
        border: '1px solid rgba(102, 102, 136, 0.15)',
      }} />
    </div>
  )
}
