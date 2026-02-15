/**
 * Dashboard Page
 *
 * The main landing page. Shows:
 *   - Current weather widget
 *   - 5-day forecast
 *   - Quick stats from each module
 *   - Recent activity
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Car, StickyNote, Wrench, Plus, Cloud, Droplets, Wind, Pin, X, Fuel } from 'lucide-react'
import { dashboard, vehicles } from '../api/client'
import { getWeatherInfo, getDayName } from '../components/weatherCodes'
import MaintenanceForm from '../components/MaintenanceForm'
import FuelForm from '../components/FuelForm'

export default function Dashboard() {
  const [weather, setWeather] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickAddFuel, setShowQuickAddFuel] = useState(false)
  const [vehiclesList, setVehiclesList] = useState([])
  const [maintenanceItems, setMaintenanceItems] = useState([])

  useEffect(() => {
    async function load() {
      try {
        const [w, s, v, items] = await Promise.all([
          dashboard.getWeather(),
          dashboard.getSummary(),
          vehicles.list(),
          vehicles.maintenanceItems.list().catch(() => []),
        ])
        setWeather(w)
        setSummary(s)
        setVehiclesList(v)
        setMaintenanceItems(items)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleQuickAddMaintenance(data) {
    try {
      await vehicles.addMaintenance(data.vehicle_id, data)
      const s = await dashboard.getSummary()
      setSummary(s)
      setShowQuickAdd(false)
    } catch (err) {
      alert('Failed to add maintenance: ' + err.message)
    }
  }

  async function handleQuickAddFuel(data) {
    try {
      await vehicles.fuelLogs.create(data.vehicle_id, data)
      const s = await dashboard.getSummary()
      setSummary(s)
      setShowQuickAddFuel(false)
    } catch (err) {
      alert('Failed to add fuel log: ' + err.message)
    }
  }

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Weather Section */}
      {weather && !weather.error && (
        <div style={{ marginBottom: '2rem' }}>
          <WeatherWidget weather={weather} />
        </div>
      )}

      {error && (
        <div className="card" style={{ borderColor: 'var(--color-red)', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--color-red)', fontSize: '0.875rem' }}>
            Error loading data: {error}
          </p>
        </div>
      )}

      {/* Module Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '1rem',
        }}
      >
        {/* Vehicles Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(137, 180, 250, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Car size={18} style={{ color: 'var(--color-blue)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Vehicles</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                  {summary?.vehicles?.count || 0} tracked
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/vehicles" className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>View All</Link>
              <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowQuickAdd(true)} title="Add maintenance record">
                <Wrench size={14} />
              </button>
              <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowQuickAddFuel(true)} title="Add fuel log">
                <Fuel size={14} />
              </button>
            </div>
          </div>

          {summary?.vehicles?.count > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Recent Maintenance */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                  Recent Maintenance
                </div>
                {summary?.vehicles?.recent_maintenance?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {summary.vehicles.recent_maintenance.slice(0, 2).map((log) => (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', background: 'var(--color-mantle)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <Wrench size={14} style={{ color: 'var(--color-peach)', flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{log.vehicle?.make} - {log.service_type}</span>
                        <span style={{ color: 'var(--color-subtext-0)', fontSize: '0.8rem' }}>{log.date}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-subtext-1)', fontSize: '0.8rem' }}>No maintenance logs yet</p>
                )}
              </div>

              {/* Recent Fill-ups */}
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                  Recent Fill-ups
                </div>
                {summary?.vehicles?.recent_fuel_logs?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {summary.vehicles.recent_fuel_logs.slice(0, 2).map((log) => (
                      <div key={log.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.5rem 0.625rem', background: 'var(--color-mantle)', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <Fuel size={14} style={{ color: 'var(--color-green)', flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{log.vehicle?.make} - ${log.total_cost?.toFixed(2)}</span>
                        <span style={{ color: 'var(--color-subtext-0)', fontSize: '0.8rem' }}>
                          {log.mpg ? `${log.mpg.toFixed(1)} mpg` : log.date}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: 'var(--color-subtext-1)', fontSize: '0.8rem' }}>No fuel logs yet</p>
                )}
              </div>
            </div>
          ) : (
            <EmptyState
              message="No vehicles yet"
              linkTo="/vehicles"
              linkLabel="Add your first vehicle"
            />
          )}
        </div>

        {/* Notes Card */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(203, 166, 247, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <StickyNote size={18} style={{ color: 'var(--color-mauve)' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Notes</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                  {summary?.notes?.count || 0} saved
                </span>
              </div>
            </div>
            <Link to="/notes" className="btn btn-ghost" style={{ fontSize: '0.8rem' }}>View All</Link>
          </div>

          {summary?.notes?.recent?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {summary.notes.recent.slice(0, 3).map((note) => (
                <div
                  key={note.id}
                  style={{
                    padding: '0.5rem 0.625rem',
                    background: 'var(--color-mantle)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {note.is_pinned && <Pin size={12} style={{ color: 'var(--color-yellow)' }} />}
                    <span style={{ fontWeight: 500 }}>{note.title}</span>
                  </div>
                  <p style={{
                    color: 'var(--color-subtext-0)',
                    fontSize: '0.8rem',
                    marginTop: '0.125rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              message="No notes yet"
              linkTo="/notes"
              linkLabel="Create your first note"
            />
          )}
        </div>
      </div>

      {/* Quick Add Maintenance Modal */}
      {showQuickAdd && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Quick Add Service Record</h2>
              <button className="btn btn-ghost" onClick={() => setShowQuickAdd(false)}>
                <X size={18} />
              </button>
            </div>
            <MaintenanceForm
              vehicles={vehiclesList}
              maintenanceItems={maintenanceItems}
              onSubmit={handleQuickAddMaintenance}
              onCancel={() => setShowQuickAdd(false)}
            />
          </div>
        </div>
      )}

      {/* Quick Add Fuel Log Modal */}
      {showQuickAddFuel && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', margin: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Quick Add Fuel Log</h2>
              <button className="btn btn-ghost" onClick={() => setShowQuickAddFuel(false)}>
                <X size={18} />
              </button>
            </div>
            <FuelForm
              vehicles={vehiclesList}
              onSubmit={handleQuickAddFuel}
              onCancel={() => setShowQuickAddFuel(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}


/**
 * Weather widget showing current conditions and 5-day forecast.
 */
function WeatherWidget({ weather }) {
  const current = weather.current
  const daily = weather.daily
  const currentInfo = getWeatherInfo(current.weather_code)

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Current Weather */}
      <div
        style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, rgba(137, 180, 250, 0.08), rgba(203, 166, 247, 0.05))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current Weather
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.03em' }}>
                {Math.round(current.temperature_2m)}°
              </span>
              <span style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
                Feels like {Math.round(current.apparent_temperature)}°
              </span>
            </div>
            <div style={{ fontSize: '0.95rem', marginTop: '0.25rem' }}>
              {currentInfo.icon} {currentInfo.description}
            </div>
          </div>

          {/* Current stats */}
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <div style={{ textAlign: 'center' }}>
              <Droplets size={16} style={{ color: 'var(--color-sky)', marginBottom: '0.25rem' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{current.relative_humidity_2m}%</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)' }}>Humidity</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Wind size={16} style={{ color: 'var(--color-teal)', marginBottom: '0.25rem' }} />
              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{Math.round(current.wind_speed_10m)} mph</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)' }}>Wind</div>
            </div>
          </div>
        </div>
      </div>

      {/* 5-Day Forecast */}
      {daily && (
        <div
          style={{
            display: 'flex',
            borderTop: '1px solid var(--color-surface-0)',
          }}
        >
          {daily.time.map((day, i) => {
            const info = getWeatherInfo(daily.weather_code[i])
            return (
              <div
                key={day}
                style={{
                  flex: 1,
                  padding: '0.875rem 0.5rem',
                  textAlign: 'center',
                  borderRight: i < daily.time.length - 1 ? '1px solid var(--color-surface-0)' : 'none',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', fontWeight: 500 }}>
                  {getDayName(day)}
                </div>
                <div style={{ fontSize: '1.25rem', margin: '0.25rem 0' }}>{info.icon}</div>
                <div style={{ fontSize: '0.8rem' }}>
                  <span style={{ fontWeight: 600 }}>{Math.round(daily.temperature_2m_max[i])}°</span>
                  <span style={{ color: 'var(--color-overlay-0)', marginLeft: '0.25rem' }}>
                    {Math.round(daily.temperature_2m_min[i])}°
                  </span>
                </div>
                {daily.precipitation_probability_max[i] > 20 && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-sky)', marginTop: '0.125rem' }}>
                    {daily.precipitation_probability_max[i]}%
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


function EmptyState({ message, linkTo, linkLabel }) {
  return (
    <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
      <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
        {message}
      </p>
      <Link to={linkTo} className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
        <Plus size={14} /> {linkLabel}
      </Link>
    </div>
  )
}


function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '2rem', width: '200px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '2rem' }} />
      <div style={{ height: '180px', background: 'var(--color-surface-0)', borderRadius: '12px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ height: '200px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
        <div style={{ height: '200px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
      </div>
    </div>
  )
}
