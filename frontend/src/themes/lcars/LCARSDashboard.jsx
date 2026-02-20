/**
 * LCARSDashboard.jsx - LCARS Operations Center
 *
 * Decluttered layout with 5 sections:
 *   1. Header: Operations Overview + Quick Actions
 *   2. Maintenance Alerts (full width)
 *   3. Vehicle Readout + Environmental Sensors (2 columns)
 *   4. Ship's Log (5 entries, full width)
 *   5. Systems Status Board (full width, module tiles)
 *
 * API calls: weather, fleet-status, system-stats, vehicles.list (for modals)
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  StickyNote, Wrench, Plus, Droplets, Wind, X,
  Fuel, Thermometer,
  CircleDot, FolderKanban, BookOpen, Server, Telescope,
  ChevronRight
} from 'lucide-react'
import { dashboard, vehicles } from '../../api/client'
import { getWeatherInfo, getDayName } from '../../components/weatherCodes'
import MaintenanceForm from '../../components/MaintenanceForm'
import FuelForm from '../../components/FuelForm'
import LCARSPanel, { LCARSDataRow, LCARSGauge, LCARSMiniPanel } from './LCARSPanel'


// ── Status color mapping ────────────────────────────────────────────────
const STATUS_COLORS = {
  overdue: 'var(--lcars-tomato)',
  due: 'var(--lcars-sunflower)',
  due_soon: 'var(--lcars-butterscotch)',
  ok: 'var(--lcars-green)',
  unknown: 'var(--lcars-gray)',
}

// ── Timeline event icon colors ──────────────────────────────────────────
const TIMELINE_COLORS = {
  maintenance: 'var(--lcars-butterscotch)',
  fuel: 'var(--lcars-green)',
  note: 'var(--lcars-african-violet)',
}


export default function LCARSDashboard() {
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

      // If no localStorage selection, default to first vehicle
      const storedId = localStorage.getItem('dashboard_vehicle_id')
      if (!storedId && fs?.vehicle_summaries?.length > 0) {
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
      const params = getDashboardParams()
      await vehicles.addMaintenance(data.vehicle_id, data)
      const fs = await dashboard.getFleetStatus(params)
      setFleetStatus(fs)
      setShowQuickAdd(false)
    } catch (err) {
      alert('Failed to add maintenance: ' + err.message)
    }
  }

  async function handleQuickAddFuel(data) {
    try {
      const params = getDashboardParams()
      await vehicles.fuelLogs.create(data.vehicle_id, data)
      const fs = await dashboard.getFleetStatus(params)
      setFleetStatus(fs)
      setShowQuickAddFuel(false)
    } catch (err) {
      alert('Failed to add fuel log: ' + err.message)
    }
  }

  if (loading) return <LCARSLoadingSkeleton />

  const now = new Date()
  const utcYear = now.getUTCFullYear()
  const utcDoy = Math.floor((now.getTime() - Date.UTC(utcYear, 0, 1)) / 86400000) + 1
  const utcHour = now.getUTCHours()
  const stardate = `${utcYear}.${String(utcDoy).padStart(3, '0')}.${String(utcHour).padStart(2, '0')}`

  // Find the selected vehicle
  const selectedId = localStorage.getItem('dashboard_vehicle_id')
  const isAllFleet = !selectedId || selectedId === 'all'
  const selectedVehicle = !isAllFleet
    ? fleetStatus?.vehicle_summaries?.find(v => String(v.id) === selectedId)
    : null

  return (
    <div style={{ maxWidth: '1400px' }}>
      {/* ── Header with Quick Actions ────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginBottom: '1.5rem',
        gap: '1rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '1.5rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--lcars-space-white)',
          }}>
            Operations Overview
          </h1>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: 'var(--lcars-sunflower)',
            marginTop: '0.25rem',
          }}>
            Stardate {stardate} &mdash;{' '}
            {now.toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <LCARSActionButton
            onClick={() => setShowQuickAdd(true)}
            color="var(--lcars-butterscotch)"
            icon={<Wrench size={14} />}
            label="Log Service"
          />
          <LCARSActionButton
            onClick={() => setShowQuickAddFuel(true)}
            color="var(--lcars-green)"
            icon={<Fuel size={14} />}
            label="Log Fuel"
          />
        </div>
      </div>

      {error && (
        <LCARSPanel title="System Alert" color="var(--lcars-tomato)" style={{ marginBottom: '1rem' }}>
          <div style={{ color: 'var(--lcars-tomato)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
            Error loading data: {error}
          </div>
        </LCARSPanel>
      )}

      {/* ── Row 1: Maintenance Alerts (full width) ───────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <MaintenanceAlertPanel alerts={fleetStatus?.interval_alerts || []} />
      </div>

      {/* ── Row 2: Vehicle Readout + Weather (2 columns) ─────────────── */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <VehicleReadoutPanel
          vehicle={selectedVehicle}
          fleetStatus={fleetStatus}
          isAllFleet={isAllFleet}
        />
        {weather && !weather.error ? (
          <LCARSWeatherPanel weather={weather} />
        ) : (
          <LCARSPanel title="Environmental Sensors" color="var(--lcars-sunflower)">
            <div style={{
              padding: '1.5rem',
              textAlign: 'center',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.82rem',
              color: 'var(--lcars-gray)',
            }}>
              Sensors offline
            </div>
          </LCARSPanel>
        )}
      </div>

      {/* ── Row 3: Ship's Log (full width, 5 entries) ────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <ActivityTimelinePanel timeline={fleetStatus?.activity_timeline || []} />
      </div>

      {/* ── Row 4: Systems Status Board (full width) ─────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <SystemsStatusBoard stats={systemStats} />
      </div>

      {/* ── Quick Add Maintenance Modal ──────────────────────────────── */}
      {showQuickAdd && (
        <LCARSModalOverlay
          title="Log Service Record"
          onClose={() => setShowQuickAdd(false)}
        >
          <MaintenanceForm
            vehicles={vehiclesList}
            maintenanceItems={maintenanceItems}
            onSubmit={handleQuickAddMaintenance}
            onCancel={() => setShowQuickAdd(false)}
          />
        </LCARSModalOverlay>
      )}

      {/* ── Quick Add Fuel Log Modal ─────────────────────────────────── */}
      {showQuickAddFuel && (
        <LCARSModalOverlay
          title="Log Fuel Entry"
          onClose={() => setShowQuickAddFuel(false)}
        >
          <FuelForm
            vehicles={vehiclesList}
            onSubmit={handleQuickAddFuel}
            onCancel={() => setShowQuickAddFuel(false)}
          />
        </LCARSModalOverlay>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 1: Maintenance Alerts
// ═══════════════════════════════════════════════════════════════════════════
function MaintenanceAlertPanel({ alerts }) {
  const hasAlerts = alerts.length > 0
  const accentColor = hasAlerts ? 'var(--lcars-tomato)' : 'var(--lcars-green)'

  return (
    <LCARSPanel
      title="Maintenance Alerts"
      color={accentColor}
      noPadding={hasAlerts}
    >
      {!hasAlerts ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.5rem 0',
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: 'var(--lcars-green)',
            boxShadow: '0 0 6px var(--lcars-green)',
          }} />
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.9rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--lcars-green)',
          }}>
            All Systems Nominal
          </span>
        </div>
      ) : (
        <div>
          {alerts.map((alert, i) => (
            <div
              key={`${alert.interval_id}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.5rem 0.75rem',
                borderBottom: i < alerts.length - 1 ? '1px solid rgba(102, 102, 136, 0.15)' : 'none',
              }}
            >
              {/* Status color indicator with glow on overdue */}
              <div style={{
                width: '4px',
                alignSelf: 'stretch',
                background: STATUS_COLORS[alert.status],
                flexShrink: 0,
                boxShadow: alert.status === 'overdue' ? `0 0 6px ${STATUS_COLORS[alert.status]}` : 'none',
              }} />

              {/* Alert info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--lcars-space-white)',
                  }}>
                    {alert.item_name}
                  </span>
                  <StatusBadge status={alert.status} />
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem',
                  color: 'var(--lcars-gray)',
                  marginTop: '0.125rem',
                }}>
                  {alert.vehicle_name}
                </div>
              </div>

              {/* Remaining info */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                {alert.miles_remaining != null && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: STATUS_COLORS[alert.status],
                  }}>
                    {alert.miles_remaining < 0 ? '+' : ''}{Math.abs(alert.miles_remaining).toLocaleString()} mi
                  </div>
                )}
                {alert.days_remaining != null && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.68rem',
                    color: 'var(--lcars-gray)',
                  }}>
                    {alert.days_remaining < 0 ? '+' : ''}{Math.abs(alert.days_remaining)}d
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {alert.percent_miles > 0 && (
                <div style={{ width: '60px', flexShrink: 0 }}>
                  <SquaredProgressBar
                    percent={Math.min(alert.percent_miles, 150)}
                    max={100}
                    color={STATUS_COLORS[alert.status]}
                    height={6}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 2: Vehicle Readout (single vehicle sensor-style)
// ═══════════════════════════════════════════════════════════════════════════
function VehicleReadoutPanel({ vehicle, fleetStatus, isAllFleet }) {
  const summaries = fleetStatus?.vehicle_summaries || []

  // Fleet aggregate when "All Fleet" is selected
  if (isAllFleet || !vehicle) {
    const fuelStats = fleetStatus?.fuel_stats

    return (
      <LCARSPanel title="Fleet Status" color="var(--lcars-ice)">
        {summaries.length === 0 ? (
          <LCARSEmptyState
            message="No vehicles registered"
            linkTo="/vehicles"
            linkLabel="Register First Vehicle"
          />
        ) : (
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '2rem',
              fontWeight: 700,
              color: 'var(--lcars-space-white)',
              letterSpacing: '-0.02em',
              lineHeight: 1,
              marginBottom: '0.75rem',
            }}>
              {summaries.length}
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 400,
                color: 'var(--lcars-gray)',
                marginLeft: '0.375rem',
              }}>vehicles</span>
            </div>

            {fuelStats?.fleet_avg_mpg != null && (
              <LCARSDataRow
                icon={<Fuel size={13} />}
                label="Fleet Avg MPG"
                value={fuelStats.fleet_avg_mpg}
                color="var(--lcars-green)"
              />
            )}

            <div style={{ marginTop: '0.75rem' }}>
              <Link to="/vehicles" style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                color: 'var(--lcars-ice)',
                textDecoration: 'none',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}>
                Fleet Details <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        )}
      </LCARSPanel>
    )
  }

  // Single vehicle readout
  const vehicleName = `${vehicle.year} ${vehicle.make} ${vehicle.model}`
  const worstColor = STATUS_COLORS[vehicle.worst_status] || 'var(--lcars-ice)'

  // Find last service from activity timeline
  const lastService = fleetStatus?.activity_timeline?.find(
    e => e.type === 'maintenance' && e.vehicle_id === vehicle.id
  )

  return (
    <LCARSPanel title="Vehicle Readout" color={worstColor}>
      {/* Vehicle designation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <span style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.92rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--lcars-space-white)',
        }}>
          {vehicleName}
        </span>
        <StatusBadge status={vehicle.worst_status} />
      </div>

      {/* Large odometer */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '2rem',
        fontWeight: 700,
        color: 'var(--lcars-space-white)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        marginBottom: '0.75rem',
      }}>
        {vehicle.current_mileage > 0 ? vehicle.current_mileage.toLocaleString() : '---'}
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 400,
          color: 'var(--lcars-gray)',
          marginLeft: '0.25rem',
        }}>mi</span>
      </div>

      {/* Data rows */}
      {vehicle.last_mpg != null && (
        <LCARSDataRow
          icon={<Fuel size={13} />}
          label="Last MPG"
          value={vehicle.last_mpg}
          color="var(--lcars-green)"
        />
      )}
      {vehicle.avg_mpg != null && (
        <LCARSDataRow
          icon={<Fuel size={13} />}
          label="Fleet Avg"
          value={vehicle.avg_mpg}
          color="var(--lcars-ice)"
        />
      )}
      {vehicle.equipped_tire_set && (
        <LCARSDataRow
          icon={<CircleDot size={13} />}
          label="Tires"
          value={`${vehicle.equipped_tire_set.name || vehicle.equipped_tire_set.tire_brand || '-'} (${(vehicle.equipped_tire_set.accumulated_mileage || 0).toLocaleString()} mi)`}
          color="var(--lcars-butterscotch)"
        />
      )}
      {lastService && (
        <LCARSDataRow
          icon={<Wrench size={13} />}
          label="Last Service"
          value={`${lastService.title} — ${lastService.date}`}
          color="var(--lcars-sunflower)"
        />
      )}

      {/* Gauge bars for maintenance interval alerts */}
      {(() => {
        const vehicleAlerts = (fleetStatus?.interval_alerts || [])
          .filter(a => a.vehicle_id === vehicle.id)
        if (vehicleAlerts.length === 0) return null
        return (
          <div style={{ marginTop: '0.5rem' }}>
            {vehicleAlerts.map(alert => (
              <LCARSGauge
                key={alert.interval_id}
                label={alert.item_name}
                value={`${Math.abs(alert.miles_remaining ?? 0).toLocaleString()} mi`}
                percent={alert.percent_miles || 0}
                color={STATUS_COLORS[alert.status]}
              />
            ))}
          </div>
        )
      })()}

      {/* Link to detail */}
      <div style={{ marginTop: '0.75rem' }}>
        <Link to={`/vehicles/${vehicle.id}`} style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          color: worstColor,
          textDecoration: 'none',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
        }}>
          Full Readout <ChevronRight size={14} />
        </Link>
      </div>
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 3: Weather / Environmental Sensors
// ═══════════════════════════════════════════════════════════════════════════
function LCARSWeatherPanel({ weather }) {
  const current = weather.current
  const daily = weather.daily
  const currentInfo = getWeatherInfo(current.weather_code)

  return (
    <LCARSPanel title="Environmental Sensors" color="var(--lcars-sunflower)">
      {/* Current conditions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '0.5rem 0.75rem',
        marginBottom: '0.5rem',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '2.25rem',
            fontWeight: 700,
            color: 'var(--lcars-space-white)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            {Math.round(current.temperature_2m)}°
          </div>
          <div style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            color: 'var(--lcars-sunflower)',
            letterSpacing: '0.08em',
            marginTop: '0.25rem',
          }}>
            {currentInfo.description}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <LCARSDataRow
            icon={<Thermometer size={13} />}
            label="Feels Like"
            value={`${Math.round(current.apparent_temperature)}°`}
            color="var(--lcars-sunflower)"
          />
          <LCARSDataRow
            icon={<Droplets size={13} />}
            label="Humidity"
            value={`${current.relative_humidity_2m}%`}
            color="var(--lcars-ice)"
          />
          <LCARSDataRow
            icon={<Wind size={13} />}
            label="Wind"
            value={`${Math.round(current.wind_speed_10m)} mph`}
            color="var(--lcars-african-violet)"
          />
        </div>
      </div>

      {/* 5-Day Forecast */}
      {daily && (
        <div style={{
          borderTop: '1px solid rgba(102, 102, 136, 0.3)',
          display: 'flex',
        }}>
          {daily.time.map((day, i) => {
            const info = getWeatherInfo(daily.weather_code[i])
            return (
              <div
                key={day}
                style={{
                  flex: 1,
                  padding: '0.625rem 0.25rem',
                  textAlign: 'center',
                  borderRight: i < daily.time.length - 1 ? '1px solid rgba(102, 102, 136, 0.2)' : 'none',
                }}
              >
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  color: 'var(--lcars-gray)',
                  letterSpacing: '0.04em',
                }}>
                  {getDayName(day)}
                </div>
                <div style={{ fontSize: '1rem', margin: '0.125rem 0' }}>{info.icon}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem' }}>
                  <span style={{ color: 'var(--lcars-space-white)', fontWeight: 600 }}>
                    {Math.round(daily.temperature_2m_max[i])}°
                  </span>
                  <span style={{ color: 'var(--lcars-gray)', marginLeft: '0.2rem' }}>
                    {Math.round(daily.temperature_2m_min[i])}°
                  </span>
                </div>
                {daily.precipitation_probability_max[i] > 20 && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.62rem',
                    color: 'var(--lcars-ice)',
                    marginTop: '0.06rem',
                  }}>
                    {daily.precipitation_probability_max[i]}%
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 4: Activity Timeline / Ship's Log (5 entries)
// ═══════════════════════════════════════════════════════════════════════════
function ActivityTimelinePanel({ timeline }) {
  const entries = timeline.slice(0, 5)

  const getIcon = (type) => {
    switch (type) {
      case 'maintenance': return <Wrench size={14} />
      case 'fuel': return <Fuel size={14} />
      case 'note': return <StickyNote size={14} />
      default: return <CircleDot size={14} />
    }
  }

  return (
    <LCARSPanel title="Ship's Log" color="var(--lcars-sunflower)" noPadding={entries.length > 0}>
      {entries.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '1.5rem 0.75rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          color: 'var(--lcars-gray)',
        }}>
          No activity recorded
        </div>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <div
              key={`${entry.type}-${entry.id}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                padding: '0.5rem 0.75rem',
                borderBottom: i < entries.length - 1 ? '1px solid rgba(102, 102, 136, 0.15)' : 'none',
              }}
            >
              {/* Type icon */}
              <div style={{
                color: TIMELINE_COLORS[entry.type] || 'var(--lcars-gray)',
                marginTop: '0.125rem',
                flexShrink: 0,
              }}>
                {getIcon(entry.type)}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--lcars-space-white)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.title}
                </div>
                {entry.subtitle && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.68rem',
                    color: 'var(--lcars-gray)',
                    marginTop: '0.0625rem',
                  }}>
                    {entry.subtitle}
                  </div>
                )}
                {entry.vehicle_name && (
                  <div style={{
                    fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.62rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--lcars-gray)',
                    marginTop: '0.125rem',
                  }}>
                    {entry.vehicle_name}
                  </div>
                )}
              </div>

              {/* Date */}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.68rem',
                color: 'var(--lcars-gray)',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {entry.date}
              </div>
            </div>
          ))}
        </div>
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 5: Systems Status Board
// ═══════════════════════════════════════════════════════════════════════════

// Module tile definitions
const SYSTEM_TILES = [
  {
    key: 'notes',
    label: 'Notes Database',
    icon: StickyNote,
    color: 'var(--lcars-african-violet)',
    link: '/notes',
    getValue: (s) => s?.notes?.count ?? 0,
    getUnit: () => 'entries',
    getSecondary: (s) => {
      const starred = s?.notes?.starred ?? 0
      return starred > 0 ? `${starred} starred` : null
    },
  },
  {
    key: 'projects',
    label: 'Project Tracker',
    icon: FolderKanban,
    color: 'var(--lcars-lilac)',
    link: '/projects',
    getValue: (s) => s?.projects?.active ?? 0,
    getUnit: () => 'active',
    getSecondary: (s) => {
      const overdue = s?.projects?.overdue ?? 0
      return overdue > 0 ? `${overdue} overdue` : null
    },
    getAlertColor: (s) => {
      const overdue = s?.projects?.overdue ?? 0
      return overdue > 0 ? 'var(--lcars-tomato)' : null
    },
  },
  {
    key: 'kb',
    label: 'Library Computer',
    icon: BookOpen,
    color: 'var(--lcars-gold)',
    link: '/kb',
    getValue: (s) => s?.kb?.total ?? 0,
    getUnit: () => 'entries',
    getSecondary: (s) => {
      const pub = s?.kb?.published ?? 0
      return `${pub} verified`
    },
  },
  {
    key: 'infrastructure',
    label: 'Engineering Status',
    icon: Server,
    color: 'var(--lcars-tanoi)',
    link: '/infrastructure',
    getValue: (s) => {
      const inc = s?.infrastructure?.active_incidents ?? 0
      return inc > 0 ? 'ALERT' : 'NOMINAL'
    },
    getUnit: (s) => {
      const h = s?.infrastructure?.hosts ?? 0
      return `${h}/${h} hosts`
    },
    getSecondary: (s) => {
      const cr = s?.infrastructure?.containers_running ?? 0
      const ct = s?.infrastructure?.containers_total ?? 0
      return `${cr}/${ct} containers`
    },
    getAlertColor: (s) => {
      const inc = s?.infrastructure?.active_incidents ?? 0
      return inc > 0 ? 'var(--lcars-red-alert)' : null
    },
    isTextValue: true,
  },
  {
    key: 'astrometrics',
    label: 'Astrometrics',
    icon: Telescope,
    color: 'var(--lcars-ice)',
    link: '/astrometrics',
    getValue: (s) => s?.astrometrics?.crew_in_space ?? 0,
    getUnit: () => 'crew in space',
    getSecondary: (s) => {
      const name = s?.astrometrics?.next_launch_name
      return name ? `Next: ${name.length > 30 ? name.slice(0, 30) + '...' : name}` : null
    },
  },
]

function SystemsStatusBoard({ stats }) {
  return (
    <LCARSPanel title="Systems Status" color="var(--lcars-gold)">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.5rem',
      }}>
        {SYSTEM_TILES.map((tile) => {
          const Icon = tile.icon
          const value = tile.getValue(stats)
          const unit = tile.getUnit(stats)
          const secondary = tile.getSecondary?.(stats)
          const alertColor = tile.getAlertColor?.(stats)

          return (
            <Link
              key={tile.key}
              to={tile.link}
              style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
            >
              <LCARSMiniPanel title={tile.label} color={alertColor || tile.color} style={{ height: '100%' }}>
                {/* Icon + main value row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                  <Icon size={13} style={{ color: alertColor || tile.color, flexShrink: 0 }} />
                  <span style={{
                    fontFamily: tile.isTextValue ? "'Antonio', sans-serif" : "'JetBrains Mono', monospace",
                    fontSize: tile.isTextValue ? '1.1rem' : '1.5rem',
                    fontWeight: 700,
                    color: alertColor || 'var(--lcars-space-white)',
                    letterSpacing: tile.isTextValue ? '0.06em' : '-0.02em',
                    lineHeight: 1.1,
                  }}>
                    {value}
                  </span>
                </div>

                {/* Unit */}
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.62rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--lcars-gray)',
                }}>
                  {unit}
                </div>

                {/* Secondary stat */}
                {secondary && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.62rem',
                    color: alertColor || 'var(--lcars-gray)',
                    marginTop: '0.25rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {secondary}
                  </div>
                )}
              </LCARSMiniPanel>
            </Link>
          )
        })}
      </div>
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Shared Utility Components
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Status badge - small colored pill showing interval status.
 */
function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || 'var(--lcars-gray)'
  return (
    <span style={{
      padding: '0.1rem 0.4rem',
      background: color,
      color: '#000000',
      fontFamily: "'Antonio', sans-serif",
      fontSize: '0.6rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      {status}
    </span>
  )
}

/**
 * Squared progress bar (no border-radius, LCARS style).
 */
function SquaredProgressBar({ percent, max = 100, color, height = 6 }) {
  const fill = Math.min((percent / max) * 100, 100)
  return (
    <div style={{
      width: '100%',
      height: `${height}px`,
      background: 'rgba(102, 102, 136, 0.2)',
    }}>
      <div style={{
        width: `${fill}%`,
        height: '100%',
        background: color,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

/**
 * LCARS-styled action button for the header area.
 */
function LCARSActionButton({ onClick, color, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
        padding: '0.375rem 0.75rem',
        border: 'none',
        background: 'rgba(102, 102, 136, 0.2)',
        color: 'var(--lcars-gray)',
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.75rem',
        fontWeight: 500,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = color
        e.currentTarget.style.color = '#000000'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(102, 102, 136, 0.2)'
        e.currentTarget.style.color = 'var(--lcars-gray)'
      }}
    >
      {icon} {label}
    </button>
  )
}

/**
 * Empty state for LCARS panels.
 */
function LCARSEmptyState({ message, linkTo, linkLabel }) {
  return (
    <div style={{ textAlign: 'center', padding: '1.5rem 0.75rem' }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.82rem',
        color: 'var(--lcars-gray)',
        marginBottom: '0.75rem',
      }}>
        {message}
      </div>
      <Link to={linkTo} className="btn btn-primary" style={{
        fontSize: '0.78rem',
        textDecoration: 'none',
      }}>
        <Plus size={14} /> {linkLabel}
      </Link>
    </div>
  )
}

/**
 * LCARS-styled modal overlay for quick-add forms.
 */
function LCARSModalOverlay({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        width: '100%',
        maxWidth: '520px',
        margin: '1rem',
        background: '#000000',
        border: '2px solid var(--lcars-butterscotch)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          background: 'var(--lcars-butterscotch)',
        }}>
          <span style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#000000',
          }}>
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.2)',
              border: 'none',
              color: '#000000',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '1.25rem' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * LCARS loading skeleton.
 */
function LCARSLoadingSkeleton() {
  const skeletonBar = { background: 'rgba(102, 102, 136, 0.08)', border: '1px solid rgba(102, 102, 136, 0.15)' }

  return (
    <div style={{ maxWidth: '1400px' }}>
      <div style={{ height: '1.5rem', width: '240px', background: 'rgba(102, 102, 136, 0.2)', marginBottom: '0.5rem' }} />
      <div style={{ height: '0.8rem', width: '300px', background: 'rgba(102, 102, 136, 0.1)', marginBottom: '1.5rem' }} />

      {/* Row 1: Full width */}
      <div style={{ height: '80px', marginBottom: '1rem', ...skeletonBar }} />

      {/* Row 2: 2 cols */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div style={{ height: '220px', ...skeletonBar }} />
        <div style={{ height: '220px', ...skeletonBar }} />
      </div>

      {/* Row 3: Full width */}
      <div style={{ height: '200px', marginBottom: '1rem', ...skeletonBar }} />

      {/* Row 4: Full width */}
      <div style={{ height: '120px', ...skeletonBar }} />
    </div>
  )
}
