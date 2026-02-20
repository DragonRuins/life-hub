/**
 * Dashboard Page
 *
 * Decluttered layout with 4 sections:
 *   1. Weather Widget (full width)
 *   2. Vehicle Overview + Maintenance Alerts (2 columns)
 *   3. Recent Activity (full width, 5 entries)
 *   4. System Status (compact module tiles)
 *
 * API calls: weather, fleet-status, system-stats, vehicles.list (for modals)
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Car, StickyNote, Wrench, Plus, Droplets, Wind,
  X, Fuel, FolderKanban, BookOpen, Server, Telescope, Library,
  CheckCircle2, AlertTriangle, CircleDot, ChevronRight
} from 'lucide-react'
import { dashboard, vehicles } from '../api/client'
import { getWeatherInfo, getDayName } from '../components/weatherCodes'
import MaintenanceForm from '../components/MaintenanceForm'
import FuelForm from '../components/FuelForm'

export default function Dashboard() {
  const [weather, setWeather] = useState(null)
  const [fleetStatus, setFleetStatus] = useState(null)
  const [systemStats, setSystemStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickAddFuel, setShowQuickAddFuel] = useState(false)
  const [vehiclesList, setVehiclesList] = useState([])
  const [maintenanceItems, setMaintenanceItems] = useState([])

  // Build dashboard API params from localStorage vehicle selection
  function getDashboardParams() {
    const id = localStorage.getItem('dashboard_vehicle_id')
    if (id && id !== 'all') return { vehicle_id: id }
    return {}
  }

  async function loadDashboard() {
    try {
      const params = getDashboardParams()
      const [w, fs, ss, v, items] = await Promise.all([
        dashboard.getWeather().catch(() => null),
        dashboard.getFleetStatus(params).catch(() => null),
        dashboard.getSystemStats().catch(() => null),
        vehicles.list().catch(() => []),
        vehicles.maintenanceItems.list().catch(() => []),
      ])
      setWeather(w)
      setFleetStatus(fs)
      setSystemStats(ss)
      setVehiclesList(v)
      setMaintenanceItems(items)

      // If no localStorage selection, check fleet-status for primary
      const storedId = localStorage.getItem('dashboard_vehicle_id')
      if (!storedId && fs?.vehicle_summaries?.length > 0) {
        // Default to first vehicle
        localStorage.setItem('dashboard_vehicle_id', String(fs.vehicle_summaries[0].id))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()

    function onVehicleChanged() {
      loadDashboard()
    }
    window.addEventListener('vehicle-selection-changed', onVehicleChanged)
    return () => window.removeEventListener('vehicle-selection-changed', onVehicleChanged)
  }, [])

  async function handleQuickAddMaintenance(data) {
    try {
      await vehicles.addMaintenance(data.vehicle_id, data)
      const params = getDashboardParams()
      const fs = await dashboard.getFleetStatus(params)
      setFleetStatus(fs)
      setShowQuickAdd(false)
    } catch (err) {
      alert('Failed to add maintenance: ' + err.message)
    }
  }

  async function handleQuickAddFuel(data) {
    try {
      await vehicles.fuelLogs.create(data.vehicle_id, data)
      const params = getDashboardParams()
      const fs = await dashboard.getFleetStatus(params)
      setFleetStatus(fs)
      setShowQuickAddFuel(false)
    } catch (err) {
      alert('Failed to add fuel log: ' + err.message)
    }
  }

  if (loading) return <LoadingSkeleton />

  // Find the selected vehicle from fleet-status
  const selectedId = localStorage.getItem('dashboard_vehicle_id')
  const isAllFleet = !selectedId || selectedId === 'all'
  const selectedVehicle = !isAllFleet
    ? fleetStatus?.vehicle_summaries?.find(v => String(v.id) === selectedId)
    : null

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
        <div style={{ marginBottom: '1.5rem' }}>
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

      {/* Row 2: Vehicle Overview + Maintenance Alerts (2 columns) */}
      <div className="form-grid-2col" style={{ marginBottom: '1.5rem' }}>
        <VehicleOverviewCard
          vehicle={selectedVehicle}
          fleetStatus={fleetStatus}
          isAllFleet={isAllFleet}
          onAddMaintenance={() => setShowQuickAdd(true)}
          onAddFuel={() => setShowQuickAddFuel(true)}
        />
        <MaintenanceAlertsCard alerts={fleetStatus?.interval_alerts || []} />
      </div>

      {/* Row 3: Recent Activity (full width) */}
      <div style={{ marginBottom: '1.5rem' }}>
        <RecentActivityCard timeline={fleetStatus?.activity_timeline || []} />
      </div>

      {/* Row 4: System Status (full width) */}
      <div>
        <SystemStatusCard stats={systemStats} />
      </div>

      {/* Quick Add Maintenance Modal */}
      {showQuickAdd && (
        <ModalOverlay
          title="Quick Add Service Record"
          onClose={() => setShowQuickAdd(false)}
        >
          <MaintenanceForm
            vehicles={vehiclesList}
            maintenanceItems={maintenanceItems}
            onSubmit={handleQuickAddMaintenance}
            onCancel={() => setShowQuickAdd(false)}
          />
        </ModalOverlay>
      )}

      {/* Quick Add Fuel Log Modal */}
      {showQuickAddFuel && (
        <ModalOverlay
          title="Quick Add Fuel Log"
          onClose={() => setShowQuickAddFuel(false)}
        >
          <FuelForm
            vehicles={vehiclesList}
            onSubmit={handleQuickAddFuel}
            onCancel={() => setShowQuickAddFuel(false)}
          />
        </ModalOverlay>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Vehicle Overview Card
// ═══════════════════════════════════════════════════════════════════════════
function VehicleOverviewCard({ vehicle, fleetStatus, isAllFleet, onAddMaintenance, onAddFuel }) {
  // Fleet aggregate when "All Fleet" is selected
  if (isAllFleet || !vehicle) {
    const summaries = fleetStatus?.vehicle_summaries || []
    const totalVehicles = summaries.length
    const fuelStats = fleetStatus?.fuel_stats

    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <IconCircle color="var(--color-blue)" bgColor="rgba(137, 180, 250, 0.1)">
              <Car size={18} />
            </IconCircle>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Fleet Overview</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                {totalVehicles} vehicle{totalVehicles !== 1 ? 's' : ''} tracked
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className="btn btn-primary" style={smallBtnStyle} onClick={onAddMaintenance} title="Add maintenance">
              <Wrench size={12} />
            </button>
            <button className="btn btn-primary" style={smallBtnStyle} onClick={onAddFuel} title="Add fuel log">
              <Fuel size={12} />
            </button>
          </div>
        </div>

        {totalVehicles > 0 ? (
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {fuelStats?.fleet_avg_mpg != null && (
              <StatBlock label="Fleet Avg MPG" value={fuelStats.fleet_avg_mpg} color="var(--color-green)" />
            )}
            <StatBlock label="Vehicles" value={totalVehicles} color="var(--color-blue)" />
          </div>
        ) : (
          <EmptyState message="No vehicles yet" linkTo="/vehicles" linkLabel="Add your first vehicle" />
        )}

        <div style={{ marginTop: '0.75rem' }}>
          <Link to="/vehicles" style={{ fontSize: '0.8rem', color: 'var(--color-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            View all vehicles <ChevronRight size={14} />
          </Link>
        </div>
      </div>
    )
  }

  // Single vehicle view
  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <IconCircle color="var(--color-blue)" bgColor="rgba(137, 180, 250, 0.1)">
            <Car size={18} />
          </IconCircle>
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>{vehicleName}</h3>
            {vehicle.trim && (
              <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>{vehicle.trim}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button className="btn btn-primary" style={smallBtnStyle} onClick={onAddMaintenance} title="Add maintenance">
            <Wrench size={12} />
          </button>
          <button className="btn btn-primary" style={smallBtnStyle} onClick={onAddFuel} title="Add fuel log">
            <Fuel size={12} />
          </button>
        </div>
      </div>

      {/* Large odometer reading */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '2rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        marginBottom: '0.75rem',
      }}>
        {vehicle.current_mileage > 0 ? vehicle.current_mileage.toLocaleString() : '---'}
        <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--color-subtext-0)', marginLeft: '0.25rem' }}>mi</span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        {vehicle.last_mpg != null && (
          <StatBlock label="Last MPG" value={vehicle.last_mpg} color="var(--color-green)" />
        )}
        {vehicle.avg_mpg != null && (
          <StatBlock label="Avg MPG" value={vehicle.avg_mpg} color="var(--color-teal)" />
        )}
        {vehicle.equipped_tire_set && (
          <StatBlock
            label="Tires"
            value={vehicle.equipped_tire_set.name || vehicle.equipped_tire_set.tire_brand || '-'}
            color="var(--color-blue)"
            isText
          />
        )}
      </div>

      <div style={{ marginTop: '0.75rem' }}>
        <Link to={`/vehicles/${vehicle.id}`} style={{ fontSize: '0.8rem', color: 'var(--color-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          Vehicle details <ChevronRight size={14} />
        </Link>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Maintenance Alerts Card
// ═══════════════════════════════════════════════════════════════════════════
const ALERT_COLORS = {
  overdue: 'var(--color-red)',
  due: 'var(--color-yellow)',
  due_soon: 'var(--color-peach)',
}

function MaintenanceAlertsCard({ alerts }) {
  const hasAlerts = alerts.length > 0

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1rem' }}>
        <IconCircle
          color={hasAlerts ? 'var(--color-peach)' : 'var(--color-green)'}
          bgColor={hasAlerts ? 'rgba(250, 179, 135, 0.1)' : 'rgba(166, 227, 161, 0.1)'}
        >
          {hasAlerts ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
        </IconCircle>
        <div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Maintenance Alerts</h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
            {hasAlerts ? `${alerts.length} item${alerts.length !== 1 ? 's' : ''} need attention` : 'All clear'}
          </span>
        </div>
      </div>

      {!hasAlerts ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem',
          background: 'rgba(166, 227, 161, 0.06)',
          borderRadius: '8px',
        }}>
          <CheckCircle2 size={16} style={{ color: 'var(--color-green)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--color-green)' }}>
            All maintenance up to date
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {alerts.slice(0, 5).map((alert, i) => {
            const color = ALERT_COLORS[alert.status] || 'var(--color-subtext-0)'
            return (
              <div
                key={`${alert.interval_id}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 0.625rem',
                  background: 'var(--color-mantle)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />

                {/* Alert info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alert.item_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                    {alert.vehicle_name}
                  </div>
                </div>

                {/* Remaining */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {alert.miles_remaining != null && (
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color, fontFamily: "'JetBrains Mono', monospace" }}>
                      {alert.miles_remaining < 0 ? '+' : ''}{Math.abs(alert.miles_remaining).toLocaleString()} mi
                    </div>
                  )}
                  {alert.days_remaining != null && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {alert.days_remaining < 0 ? '+' : ''}{Math.abs(alert.days_remaining)}d
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {alerts.length > 5 && (
            <Link to="/vehicles" style={{ fontSize: '0.8rem', color: 'var(--color-blue)', textDecoration: 'none', textAlign: 'center', padding: '0.25rem' }}>
              View all {alerts.length} alerts
            </Link>
          )}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Recent Activity Card
// ═══════════════════════════════════════════════════════════════════════════
const TIMELINE_TYPE_CONFIG = {
  maintenance: { icon: Wrench, color: 'var(--color-peach)', bgColor: 'rgba(250, 179, 135, 0.1)' },
  fuel: { icon: Fuel, color: 'var(--color-green)', bgColor: 'rgba(166, 227, 161, 0.1)' },
  note: { icon: StickyNote, color: 'var(--color-mauve)', bgColor: 'rgba(203, 166, 247, 0.1)' },
}

function RecentActivityCard({ timeline }) {
  const entries = timeline.slice(0, 5)

  return (
    <div className="card">
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
        Recent Activity
      </h3>

      {entries.length === 0 ? (
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>No recent activity</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {entries.map((entry, i) => {
            const config = TIMELINE_TYPE_CONFIG[entry.type] || { icon: CircleDot, color: 'var(--color-subtext-0)', bgColor: 'rgba(108, 112, 134, 0.1)' }
            const Icon = config.icon
            return (
              <div
                key={`${entry.type}-${entry.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.5rem 0.625rem',
                  background: 'var(--color-mantle)',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  background: config.bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={14} style={{ color: config.color }} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.title}
                  </div>
                  {(entry.vehicle_name || entry.subtitle) && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                      {entry.vehicle_name}{entry.subtitle ? ` — ${entry.subtitle}` : ''}
                    </div>
                  )}
                </div>

                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-subtext-0)',
                  flexShrink: 0,
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {entry.date}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// System Status Card
// ═══════════════════════════════════════════════════════════════════════════

const MODULE_TILES = [
  {
    key: 'notes',
    label: 'Notes',
    icon: StickyNote,
    color: 'var(--color-mauve)',
    bgColor: 'rgba(203, 166, 247, 0.1)',
    link: '/notes',
    getValue: (s) => s?.notes?.count ?? 0,
    getSublabel: (s) => {
      const starred = s?.notes?.starred ?? 0
      return starred > 0 ? `${starred} starred` : 'notes'
    },
  },
  {
    key: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    color: 'var(--color-yellow)',
    bgColor: 'rgba(249, 226, 175, 0.1)',
    link: '/projects',
    getValue: (s) => s?.projects?.active ?? 0,
    getSublabel: () => 'active',
    getAlert: (s) => {
      const overdue = s?.projects?.overdue ?? 0
      return overdue > 0 ? `${overdue} overdue` : null
    },
  },
  {
    key: 'kb',
    label: 'Knowledge Base',
    icon: BookOpen,
    color: 'var(--color-green)',
    bgColor: 'rgba(166, 227, 161, 0.1)',
    link: '/kb',
    getValue: (s) => s?.kb?.total ?? 0,
    getSublabel: () => 'articles',
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
    icon: Server,
    color: 'var(--color-teal)',
    bgColor: 'rgba(148, 226, 213, 0.1)',
    link: '/infrastructure',
    getValue: (s) => s?.infrastructure?.hosts ?? 0,
    getSublabel: (s) => {
      const cr = s?.infrastructure?.containers_running ?? 0
      const ct = s?.infrastructure?.containers_total ?? 0
      return `hosts, ${cr}/${ct} containers`
    },
    getAlert: (s) => {
      const inc = s?.infrastructure?.active_incidents ?? 0
      return inc > 0 ? `${inc} incident${inc !== 1 ? 's' : ''}` : null
    },
  },
  {
    key: 'astrometrics',
    label: 'Astrometrics',
    icon: Telescope,
    color: 'var(--color-blue)',
    bgColor: 'rgba(137, 180, 250, 0.1)',
    link: '/astrometrics',
    getValue: (s) => s?.astrometrics?.crew_in_space ?? 0,
    getSublabel: () => 'crew in space',
  },
  {
    key: 'trek',
    label: 'Database',
    icon: Library,
    color: 'var(--color-yellow)',
    bgColor: 'rgba(249, 226, 175, 0.1)',
    link: '/trek',
    getValue: (s) => s?.trek?.cached_entities ?? 0,
    getSublabel: (s) => {
      const favs = s?.trek?.favorites ?? 0
      return favs > 0 ? `cached, ${favs} favorites` : 'cached entries'
    },
  },
]

function SystemStatusCard({ stats }) {
  return (
    <div className="card">
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem' }}>
        System Status
      </h3>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '0.75rem',
      }}>
        {MODULE_TILES.map(tile => {
          const Icon = tile.icon
          const value = tile.getValue(stats)
          const sublabel = tile.getSublabel(stats)
          const alert = tile.getAlert?.(stats)

          return (
            <Link
              key={tile.key}
              to={tile.link}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                background: 'var(--color-mantle)',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-0)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--color-mantle)'}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: tile.bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon size={18} style={{ color: tile.color }} />
              </div>
              <div>
                <div style={{
                  fontSize: '1.1rem',
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  lineHeight: 1.2,
                }}>
                  {value}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                  {sublabel}
                </div>
                {alert && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-red)', fontWeight: 600, marginTop: '0.125rem' }}>
                    {alert}
                  </div>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Weather Widget (preserved from original)
// ═══════════════════════════════════════════════════════════════════════════
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


// ═══════════════════════════════════════════════════════════════════════════
// Shared Utility Components
// ═══════════════════════════════════════════════════════════════════════════

const smallBtnStyle = {
  fontSize: '0.7rem',
  padding: '0.25rem 0.5rem',
  lineHeight: 1.2,
}

function IconCircle({ color, bgColor, children }) {
  return (
    <div style={{
      width: '36px',
      height: '36px',
      borderRadius: '8px',
      background: bgColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      color,
    }}>
      {children}
    </div>
  )
}

function StatBlock({ label, value, color, isText }) {
  return (
    <div>
      <div style={{
        fontSize: isText ? '0.9rem' : '1.1rem',
        fontWeight: 700,
        fontFamily: isText ? 'inherit' : "'JetBrains Mono', monospace",
        color: color || 'var(--color-text)',
        lineHeight: 1.2,
      }}>
        {value}
      </div>
      <div style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </div>
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

function ModalOverlay({ title, onClose, children }) {
  return (
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
      <div className="card" style={{ width: '100%', maxWidth: 'min(500px, calc(100vw - 2rem))', margin: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{title}</h2>
          <button className="btn btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '2rem', width: '200px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '2rem' }} />
      <div style={{ height: '180px', background: 'var(--color-surface-0)', borderRadius: '12px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div className="form-grid-2col" style={{ marginBottom: '1.5rem' }}>
        <div style={{ height: '200px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
        <div style={{ height: '200px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
      </div>
      <div style={{ height: '200px', background: 'var(--color-surface-0)', borderRadius: '12px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div style={{ height: '100px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
    </div>
  )
}
