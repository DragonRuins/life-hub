/**
 * Fuel Economy Page
 *
 * Sub-page of a specific vehicle. Shows:
 *   - Stats cards (avg MPG, total gallons, spending, etc.)
 *   - MPG over time chart
 *   - Price per gallon over time chart
 *   - Full fuel log table with color-coded MPG
 *
 * Route: /vehicles/:id/fuel
 */
import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Fuel, Trash2, Pencil, TrendingUp, TrendingDown, DollarSign, Droplets, Gauge, BarChart3, ChevronLeft, X } from 'lucide-react'
import useIsMobile from '../hooks/useIsMobile'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { vehicles, fuel } from '../api/client'
import FuelForm from '../components/FuelForm'
import { formatDate, formatShortDate } from '../utils/formatDate'

export default function FuelEconomy() {
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

  // Load vehicle info + fuel data on mount
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
      // Reload data
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

  if (loading) return <LoadingSkeleton />

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

  // Price chart data (includes all entries, not just ones with MPG)
  const priceChartData = [...filteredEntries]
    .reverse()
    .map(e => ({
      date: formatShortDate(e.date),
      pricePerGallon: e.cost_per_gallon,
    }))

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header with back link */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          to={`/vehicles/${vehicleId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            color: 'var(--color-subtext-0)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            marginBottom: '0.5rem',
          }}
        >
          <ChevronLeft size={16} />
          {vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}` : 'Back to Vehicle'}
        </Link>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Fuel Economy
        </h1>
        {vehicle && (
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim ? `(${vehicle.trim})` : ''}
          </p>
        )}
      </div>

      {/* Stats + Charts + Table */}
      {(
        <>
          {/* Stats Cards */}
          {stats && stats.total_entries > 0 ? (
            <>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '0.75rem',
                marginBottom: '1.5rem',
              }}>
                <StatCard
                  icon={<Gauge size={18} />}
                  iconColor="var(--color-blue)"
                  iconBg="rgba(137, 180, 250, 0.1)"
                  label="Avg MPG"
                  value={stats.avg_mpg != null ? stats.avg_mpg.toFixed(1) : '—'}
                />
                <StatCard
                  icon={<BarChart3 size={18} />}
                  iconColor="var(--color-teal)"
                  iconBg="rgba(148, 226, 213, 0.1)"
                  label="Avg MPG (Last 5)"
                  value={stats.avg_mpg_last_5 != null ? stats.avg_mpg_last_5.toFixed(1) : '—'}
                />
                <StatCard
                  icon={<Droplets size={18} />}
                  iconColor="var(--color-sky)"
                  iconBg="rgba(137, 220, 235, 0.1)"
                  label="Total Gallons"
                  value={stats.total_gallons != null ? stats.total_gallons.toLocaleString() : '—'}
                />
                <StatCard
                  icon={<DollarSign size={18} />}
                  iconColor="var(--color-green)"
                  iconBg="rgba(166, 227, 161, 0.1)"
                  label="Total Spent"
                  value={stats.total_spent != null ? `$${stats.total_spent.toLocaleString()}` : '—'}
                />
                <StatCard
                  icon={<TrendingUp size={18} />}
                  iconColor="var(--color-green)"
                  iconBg="rgba(166, 227, 161, 0.1)"
                  label="Best MPG"
                  value={stats.best_mpg != null ? stats.best_mpg.toFixed(1) : '—'}
                />
                <StatCard
                  icon={<TrendingDown size={18} />}
                  iconColor="var(--color-red)"
                  iconBg="rgba(243, 139, 168, 0.1)"
                  label="Worst MPG"
                  value={stats.worst_mpg != null ? stats.worst_mpg.toFixed(1) : '—'}
                />
              </div>

              {/* Timeframe Selector */}
              <TimeframeSelector value={timeframe} onChange={setTimeframe} />

              {/* Charts */}
              {chartData.length >= 2 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(400px, 100%), 1fr))',
                  gap: '1rem',
                  marginBottom: '1.5rem',
                }}>
                  {/* MPG Over Time Chart */}
                  <div className="card">
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-subtext-0)' }}>
                      MPG Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-1)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: 'var(--color-subtext-0)', fontSize: 12 }}
                          stroke="var(--color-surface-1)"
                        />
                        <YAxis
                          tick={{ fill: 'var(--color-subtext-0)', fontSize: 12 }}
                          stroke="var(--color-surface-1)"
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--color-surface-0)',
                            border: '1px solid var(--color-surface-1)',
                            borderRadius: '8px',
                            color: 'var(--color-text)',
                            fontSize: '0.85rem',
                          }}
                          formatter={(value) => [`${value} MPG`, 'MPG']}
                        />
                        {stats.avg_mpg && (
                          <ReferenceLine
                            y={stats.avg_mpg}
                            stroke="var(--color-overlay-0)"
                            strokeDasharray="5 5"
                            label={{
                              value: `Avg: ${stats.avg_mpg}`,
                              position: 'right',
                              fill: 'var(--color-subtext-0)',
                              fontSize: 11,
                            }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="mpg"
                          stroke="var(--color-blue)"
                          strokeWidth={2}
                          dot={{ fill: 'var(--color-blue)', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Price Per Gallon Over Time Chart */}
                  <div className="card">
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--color-subtext-0)' }}>
                      Price Per Gallon Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={priceChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-1)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: 'var(--color-subtext-0)', fontSize: 12 }}
                          stroke="var(--color-surface-1)"
                        />
                        <YAxis
                          tick={{ fill: 'var(--color-subtext-0)', fontSize: 12 }}
                          stroke="var(--color-surface-1)"
                          domain={['auto', 'auto']}
                          tickFormatter={(v) => `$${v}`}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--color-surface-0)',
                            border: '1px solid var(--color-surface-1)',
                            borderRadius: '8px',
                            color: 'var(--color-text)',
                            fontSize: '0.85rem',
                          }}
                          formatter={(value) => [`$${value.toFixed(3)}`, 'Price/Gal']}
                        />
                        {stats.avg_cost_per_gallon && (
                          <ReferenceLine
                            y={stats.avg_cost_per_gallon}
                            stroke="var(--color-overlay-0)"
                            strokeDasharray="5 5"
                            label={{
                              value: `Avg: $${stats.avg_cost_per_gallon}`,
                              position: 'right',
                              fill: 'var(--color-subtext-0)',
                              fontSize: 11,
                            }}
                          />
                        )}
                        <Line
                          type="monotone"
                          dataKey="pricePerGallon"
                          stroke="var(--color-green)"
                          strokeWidth={2}
                          dot={{ fill: 'var(--color-green)', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Fuel Log */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--color-surface-0)' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                    Fuel Log ({entries.length} entries)
                  </h3>
                </div>
                {isMobile ? (
                  /* Mobile: card view */
                  <div style={{ padding: '0.75rem' }}>
                    {entries.map((entry) => (
                      <div key={entry.id} style={{
                        padding: '0.75rem',
                        borderBottom: '1px solid var(--color-surface-0)',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {formatDate(entry.date)}
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            {entry.mpg != null ? (
                              <span style={{
                                padding: '0.125rem 0.5rem',
                                borderRadius: '4px',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                background: entry.mpg >= (stats?.avg_mpg || 0)
                                  ? 'rgba(166, 227, 161, 0.15)'
                                  : 'rgba(243, 139, 168, 0.15)',
                                color: entry.mpg >= (stats?.avg_mpg || 0)
                                  ? 'var(--color-green)'
                                  : 'var(--color-red)',
                              }}>
                                {entry.mpg.toFixed(1)} MPG
                              </span>
                            ) : (
                              <span style={{ color: 'var(--color-overlay-0)', fontSize: '0.8rem' }}>
                                {entry.missed_previous ? 'skipped' : '—'}
                              </span>
                            )}
                            <button
                              onClick={() => { setEditingEntry(entry); setShowEditForm(true) }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--color-overlay-0)', padding: '0.25rem',
                                borderRadius: '4px', display: 'flex', alignItems: 'center',
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--color-overlay-0)', padding: '0.25rem',
                                borderRadius: '4px', display: 'flex', alignItems: 'center',
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="form-grid-2col" style={{ gap: '0.25rem 1rem', fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                          <div>Odometer: <span style={{ color: 'var(--color-text)' }}>{entry.mileage?.toLocaleString()}</span></div>
                          <div>Gallons: <span style={{ color: 'var(--color-text)' }}>{entry.gallons_added?.toFixed(2)}</span></div>
                          <div>$/gal: <span style={{ color: 'var(--color-text)' }}>${entry.cost_per_gallon?.toFixed(3)}</span></div>
                          <div>Total: <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>${entry.total_cost?.toFixed(2)}</span></div>
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
                      fontSize: '0.85rem',
                    }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
                          <Th>Date</Th>
                          <Th align="right">Odometer</Th>
                          <Th align="right">Gallons</Th>
                          <Th align="right">Price/Gal</Th>
                          <Th align="right">Total Cost</Th>
                          <Th align="right">MPG</Th>
                          <Th align="center" style={{ width: '48px' }}></Th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr
                            key={entry.id}
                            style={{ borderBottom: '1px solid var(--color-surface-0)' }}
                          >
                            <Td>{formatDate(entry.date)}</Td>
                            <Td align="right">{entry.mileage?.toLocaleString()}</Td>
                            <Td align="right">{entry.gallons_added?.toFixed(2)}</Td>
                            <Td align="right">${entry.cost_per_gallon?.toFixed(3)}</Td>
                            <Td align="right" style={{ fontWeight: 600 }}>${entry.total_cost?.toFixed(2)}</Td>
                            <Td align="right">
                              {entry.mpg != null ? (
                                <span style={{
                                  padding: '0.125rem 0.5rem',
                                  borderRadius: '4px',
                                  fontWeight: 600,
                                  fontSize: '0.8rem',
                                  background: entry.mpg >= (stats?.avg_mpg || 0)
                                    ? 'rgba(166, 227, 161, 0.15)'
                                    : 'rgba(243, 139, 168, 0.15)',
                                  color: entry.mpg >= (stats?.avg_mpg || 0)
                                    ? 'var(--color-green)'
                                    : 'var(--color-red)',
                                }}>
                                  {entry.mpg.toFixed(1)}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-overlay-0)' }}>
                                  {entry.missed_previous ? 'skipped' : '—'}
                                </span>
                              )}
                            </Td>
                            <Td align="center">
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                <button
                                  onClick={() => { setEditingEntry(entry); setShowEditForm(true) }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--color-overlay-0)',
                                    padding: '0.25rem',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
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
                                    color: 'var(--color-overlay-0)',
                                    padding: '0.25rem',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                  title="Delete entry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <Fuel size={32} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
              <p style={{ color: 'var(--color-subtext-0)', marginBottom: '0.5rem' }}>
                No fuel entries yet for {vehicle?.year} {vehicle?.make} {vehicle?.model}.
              </p>
              <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.85rem' }}>
                Add fuel logs from the vehicle detail page or via the Apple Shortcut.
              </p>
            </div>
          )}

          {/* Edit Fuel Log Modal */}
          {showEditForm && editingEntry && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}>
              <div className="card" style={{ width: '100%', maxWidth: 'min(500px, calc(100vw - 2rem))', margin: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Edit Fuel Log</h2>
                  <button className="btn btn-ghost" onClick={() => { setShowEditForm(false); setEditingEntry(null) }}>
                    <X size={18} />
                  </button>
                </div>
                <FuelForm
                  vehicleId={vehicleId}
                  vehicleMileage={vehicle?.current_mileage}
                  fuelLog={editingEntry}
                  onSubmit={handleUpdateEntry}
                  onCancel={() => { setShowEditForm(false); setEditingEntry(null) }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}


/**
 * Stat card component for the stats row.
 */
function StatCard({ icon, iconColor, iconBg, label, value }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: iconColor,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
        {value}
      </div>
    </div>
  )
}


/** Table header cell */
function Th({ children, align = 'left', style = {} }) {
  return (
    <th style={{
      padding: '0.625rem 1rem',
      textAlign: align,
      fontWeight: 600,
      fontSize: '0.75rem',
      color: 'var(--color-subtext-0)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      ...style,
    }}>
      {children}
    </th>
  )
}


/** Table data cell */
function Td({ children, align = 'left', style = {} }) {
  return (
    <td style={{
      padding: '0.625rem 1rem',
      textAlign: align,
      color: 'var(--color-text)',
      ...style,
    }}>
      {children}
    </td>
  )
}


const TIMEFRAMES = [
  { key: 'all', label: 'All Time' },
  { key: '1y', label: '1Y' },
  { key: '6m', label: '6M' },
  { key: '3m', label: '3M' },
  { key: '1m', label: '1M' },
]

/**
 * Filters entries to only those within the selected timeframe.
 * Entries are expected newest-first (descending date order).
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


/** Timeframe selector pill buttons */
function TimeframeSelector({ value, onChange }) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.375rem',
      marginBottom: '1rem',
    }}>
      {TIMEFRAMES.map(tf => (
        <button
          key={tf.key}
          className={`btn ${value === tf.key ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => onChange(tf.key)}
          style={{
            fontSize: '0.75rem',
            padding: '0.3rem 0.75rem',
          }}
        >
          {tf.label}
        </button>
      ))}
    </div>
  )
}


function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '2rem', width: '200px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '2rem' }} />
      <div style={{ height: '40px', width: '280px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{ height: '90px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ height: '300px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
        <div style={{ height: '300px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
      </div>
    </div>
  )
}
