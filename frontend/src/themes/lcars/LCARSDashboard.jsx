/**
 * LCARSDashboard.jsx - LCARS Operations Center
 *
 * Full fleet operations dashboard with 8 data panels:
 *   Row 1: Maintenance Alerts (full width)
 *   Row 2: Vehicle Quick Status Cards (full width)
 *   Row 3: Weather / Environmental + Fleet Fuel Economy
 *   Row 4: Cost Analysis + Tire Wear Monitor
 *   Row 5: Activity Timeline + Component Health
 *   Row 6: Notification Feed + Notes Database
 *
 * Data comes from GET /api/dashboard/fleet-status (single aggregated call)
 * plus weather and summary endpoints.
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Car, StickyNote, Wrench, Plus, Droplets, Wind, Pin, Star, X,
  Fuel, Thermometer, AlertTriangle, DollarSign, Gauge,
  Clock, Cpu, Bell, BellOff, CircleDot, FolderKanban, BookOpen, Server, Telescope
} from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { dashboard, vehicles, notifications, projects, kb, infrastructure as infraApi, astrometrics as astroApi } from '../../api/client'
import { getWeatherInfo, getDayName } from '../../components/weatherCodes'
import { getComponentType } from '../../constants/componentTypes'
import MaintenanceForm from '../../components/MaintenanceForm'
import FuelForm from '../../components/FuelForm'
import LCARSPanel, { LCARSDataRow, LCARSStat } from './LCARSPanel'


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
  const [summary, setSummary] = useState(null)
  const [notificationFeed, setNotificationFeed] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickAddFuel, setShowQuickAddFuel] = useState(false)
  const [vehiclesList, setVehiclesList] = useState([])
  const [maintenanceItems, setMaintenanceItems] = useState([])
  const [projectStats, setProjectStats] = useState(null)
  const [kbStats, setKbStats] = useState(null)
  const [infraDash, setInfraDash] = useState(null)
  const [astroData, setAstroData] = useState(null)

  // Build dashboard API params from localStorage vehicle selection
  function getDashboardParams() {
    const id = localStorage.getItem('dashboard_vehicle_id')
    if (id && id !== 'all') return { vehicle_id: id }
    return {}
  }

  async function loadDashboard() {
    try {
      const params = getDashboardParams()
      const [w, fs, s, v, items, nFeed, nCount, pStats, kStats, iDash, astroNext, astroCrew] = await Promise.all([
        dashboard.getWeather().catch(() => null),
        dashboard.getFleetStatus(params).catch(() => null),
        dashboard.getSummary(params),
        vehicles.list(),
        vehicles.maintenanceItems.list().catch(() => []),
        notifications.feed({ limit: 10 }).catch(() => []),
        notifications.unreadCount().catch(() => ({ count: 0 })),
        projects.stats().catch(() => null),
        kb.stats().catch(() => null),
        infraApi.dashboard().catch(() => null),
        astroApi.launches.next().catch(() => null),
        astroApi.iss.crew().catch(() => null),
      ])
      setWeather(w)
      setFleetStatus(fs)
      setSummary(s)
      setVehiclesList(v)
      setMaintenanceItems(items)
      setNotificationFeed(Array.isArray(nFeed) ? nFeed : [])
      setUnreadCount(nCount?.count || 0)
      setProjectStats(pStats)
      setKbStats(kStats)
      setInfraDash(iDash)
      setAstroData({
        nextLaunch: astroNext?.data || null,
        crewCount: astroCrew?.data?.number || 0,
      })

      // If no localStorage selection, default to primary vehicle
      const storedId = localStorage.getItem('dashboard_vehicle_id')
      if (!storedId && s.primary_vehicle_id) {
        localStorage.setItem('dashboard_vehicle_id', String(s.primary_vehicle_id))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()

    // Listen for vehicle selection changes from the gear dropdown
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
      const [s, fs] = await Promise.all([
        dashboard.getSummary(params),
        dashboard.getFleetStatus(params),
      ])
      setSummary(s)
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
      const [s, fs] = await Promise.all([
        dashboard.getSummary(params),
        dashboard.getFleetStatus(params),
      ])
      setSummary(s)
      setFleetStatus(fs)
      setShowQuickAddFuel(false)
    } catch (err) {
      alert('Failed to add fuel log: ' + err.message)
    }
  }

  async function handleMarkAllRead() {
    try {
      await notifications.markAllRead()
      setUnreadCount(0)
      setNotificationFeed(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      // Silently fail
    }
  }

  if (loading) return <LCARSLoadingSkeleton />

  const now = new Date()
  const stardate = `${now.getFullYear()}.${String(Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000)).padStart(3, '0')}`

  return (
    <div style={{ maxWidth: '1400px' }}>
      {/* Header with Quick Actions */}
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

      {/* Row 1: Maintenance Alerts (full width) */}
      <div style={{ marginBottom: '1rem' }}>
        <MaintenanceAlertPanel alerts={fleetStatus?.interval_alerts || []} />
      </div>

      {/* Row 2: Vehicle Quick Status Cards (full width) */}
      <div style={{ marginBottom: '1rem' }}>
        <VehicleQuickStatusCards summaries={fleetStatus?.vehicle_summaries || []} />
      </div>

      {/* Row 3: Weather + Fleet Fuel Economy */}
      <div className={weather && !weather.error ? 'form-grid-2col' : undefined} style={{
        ...(!weather || weather.error ? { display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' } : {}),
        marginBottom: '1rem',
      }}>
        {weather && !weather.error && (
          <LCARSWeatherPanel weather={weather} />
        )}
        <FleetFuelEconomyPanel fuelStats={fleetStatus?.fuel_stats} />
      </div>

      {/* Row 4: Cost Analysis + Tire Wear */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <CostAnalysisPanel costAnalysis={fleetStatus?.cost_analysis} />
        <TireWearMonitorPanel tireSets={fleetStatus?.tire_sets || []} />
      </div>

      {/* Row 5: Activity Timeline + Component Health */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <ActivityTimelinePanel timeline={fleetStatus?.activity_timeline || []} />
        <ComponentHealthPanel components={fleetStatus?.active_components || []} />
      </div>

      {/* Row 6: Notifications + Notes */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <NotificationFeedPanel
          feed={notificationFeed}
          unreadCount={unreadCount}
          onMarkAllRead={handleMarkAllRead}
        />
        <LCARSNotesPanel notes={summary?.notes} />
      </div>

      {/* Row 7: Projects */}
      <div style={{ marginBottom: '1rem' }}>
        <LCARSProjectsPanel stats={projectStats} />
      </div>

      {/* Row 8: Library Computer */}
      <div style={{ marginBottom: '1rem' }}>
        <LCARSLibraryComputerPanel stats={kbStats} />
      </div>

      {/* Row 9: Engineering Status */}
      <div style={{ marginBottom: '1rem' }}>
        <LCARSEngineeringPanel data={infraDash} />
      </div>

      {/* Row 10: Astrometrics */}
      <div style={{ marginBottom: '1rem' }}>
        <LCARSAstrometricsPanel data={astroData} />
      </div>

      {/* Quick Add Maintenance Modal */}
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

      {/* Quick Add Fuel Log Modal */}
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
              {/* Status color indicator */}
              <div style={{
                width: '4px',
                alignSelf: 'stretch',
                background: STATUS_COLORS[alert.status],
                flexShrink: 0,
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
// Panel 2: Vehicle Quick Status Cards
// ═══════════════════════════════════════════════════════════════════════════
function VehicleQuickStatusCards({ summaries }) {
  const navigate = useNavigate()

  if (summaries.length === 0) {
    return (
      <LCARSPanel title="Fleet Status" color="var(--lcars-ice)">
        <LCARSEmptyState
          message="No vehicles registered"
          linkTo="/vehicles"
          linkLabel="Register First Vehicle"
        />
      </LCARSPanel>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '1rem',
    }}>
      {summaries.map(v => {
        const accentColor = STATUS_COLORS[v.worst_status] || 'var(--lcars-ice)'
        return (
          <div
            key={v.id}
            onClick={() => navigate(`/vehicles/${v.id}`)}
            style={{
              display: 'flex',
              background: '#000000',
              border: '1px solid rgba(102, 102, 136, 0.3)',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = accentColor}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(102, 102, 136, 0.3)'}
          >
            {/* Left accent bar colored by worst status */}
            <div style={{ width: '6px', background: accentColor, flexShrink: 0 }} />

            <div style={{ flex: 1, padding: '0.625rem 0.75rem' }}>
              {/* Vehicle name + status badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{
                  fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--lcars-space-white)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {v.year} {v.make} {v.model}
                </div>
                <StatusBadge status={v.worst_status} />
              </div>

              {/* Odometer (large monospace) */}
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--lcars-space-white)',
                letterSpacing: '-0.02em',
                margin: '0.25rem 0',
              }}>
                {v.current_mileage > 0 ? v.current_mileage.toLocaleString() : '---'}
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 400,
                  color: 'var(--lcars-gray)',
                  marginLeft: '0.25rem',
                }}>mi</span>
              </div>

              {/* Mini stats row */}
              <div style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
              }}>
                {v.last_mpg != null && (
                  <MiniStat label="MPG" value={v.last_mpg} color="var(--lcars-green)" />
                )}
                {v.interval_counts.overdue > 0 && (
                  <MiniStat
                    label="Overdue"
                    value={v.interval_counts.overdue}
                    color="var(--lcars-tomato)"
                  />
                )}
                {v.interval_counts.due > 0 && (
                  <MiniStat
                    label="Due"
                    value={v.interval_counts.due}
                    color="var(--lcars-sunflower)"
                  />
                )}
                {v.equipped_tire_set && (
                  <MiniStat
                    label="Tires"
                    value={v.equipped_tire_set.name || v.equipped_tire_set.tire_brand || '-'}
                    color="var(--lcars-ice)"
                  />
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 3: Weather (preserved from original)
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
// Panel 4: Fleet Fuel Economy
// ═══════════════════════════════════════════════════════════════════════════
function FleetFuelEconomyPanel({ fuelStats }) {
  if (!fuelStats) return null

  const hasSparkline = fuelStats.sparkline_data?.length > 1

  return (
    <LCARSPanel title="Fleet Fuel Economy" color="var(--lcars-ice)">
      {/* Main stat */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '2.25rem',
            fontWeight: 700,
            color: 'var(--lcars-space-white)',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            {fuelStats.fleet_avg_mpg != null ? fuelStats.fleet_avg_mpg : '---'}
          </div>
          <div style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            color: 'var(--lcars-ice)',
            letterSpacing: '0.08em',
            marginTop: '0.25rem',
          }}>
            Fleet Avg MPG
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <DataField
            label="Fuel Cost (30d)"
            value={`$${fuelStats.total_fuel_cost_30d.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
            color="var(--lcars-green)"
          />
          <DataField
            label="Gallons (30d)"
            value={`${fuelStats.total_gallons_30d} gal`}
          />
          <DataField
            label="Fuel Cost (YTD)"
            value={`$${fuelStats.total_fuel_cost_ytd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          />
        </div>
      </div>

      {/* Sparkline */}
      {hasSparkline && (
        <div style={{
          marginTop: '0.75rem',
          borderTop: '1px solid rgba(102, 102, 136, 0.3)',
          paddingTop: '0.75rem',
        }}>
          <div style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.65rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--lcars-gray)',
            marginBottom: '0.375rem',
          }}>
            MPG Trend
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={fuelStats.sparkline_data}>
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} hide />
              <Tooltip
                contentStyle={{
                  background: '#000000',
                  border: '1px solid var(--lcars-ice)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem',
                }}
                labelStyle={{ color: 'var(--lcars-gray)' }}
                itemStyle={{ color: 'var(--lcars-ice)' }}
              />
              <Line
                type="monotone"
                dataKey="mpg"
                stroke="var(--lcars-ice)"
                strokeWidth={2}
                dot={{ r: 2, fill: 'var(--lcars-ice)' }}
                activeDot={{ r: 4, fill: 'var(--lcars-ice)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 5: Cost Analysis
// ═══════════════════════════════════════════════════════════════════════════
function CostAnalysisPanel({ costAnalysis }) {
  if (!costAnalysis) return null

  const fmt = (val) => `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <LCARSPanel title="Expenditure Analysis" color="var(--lcars-green)">
      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.5rem',
        marginBottom: '0.5rem',
        paddingBottom: '0.375rem',
        borderBottom: '1px solid rgba(102, 102, 136, 0.3)',
      }}>
        <div />
        <CostHeader label="30 Day" />
        <CostHeader label="Year to Date" />
      </div>

      {/* Cost rows */}
      <CostRow label="Maintenance" val30d={fmt(costAnalysis.maintenance_30d)} valYtd={fmt(costAnalysis.maintenance_ytd)} />
      <CostRow label="Fuel" val30d={fmt(costAnalysis.fuel_30d)} valYtd={fmt(costAnalysis.fuel_ytd)} />
      <CostRow label="Parts" val30d={fmt(costAnalysis.parts_30d)} valYtd={fmt(costAnalysis.parts_ytd)} />

      {/* Total row (highlighted) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: '0.5rem',
        marginTop: '0.375rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid rgba(102, 102, 136, 0.3)',
      }}>
        <span style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--lcars-green)',
          fontWeight: 600,
        }}>
          Total
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          fontWeight: 700,
          color: 'var(--lcars-space-white)',
        }}>
          {fmt(costAnalysis.total_30d)}
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          fontWeight: 700,
          color: 'var(--lcars-space-white)',
        }}>
          {fmt(costAnalysis.total_ytd)}
        </span>
      </div>
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 6: Tire Wear Monitor
// ═══════════════════════════════════════════════════════════════════════════
function TireWearMonitorPanel({ tireSets }) {
  const STANDARD_TIRE_LIFE = 50000 // Standard tire life in miles

  return (
    <LCARSPanel title="Tire Wear Monitor" color="var(--lcars-butterscotch)" noPadding={tireSets.length > 0}>
      {tireSets.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '1.5rem 0.75rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          color: 'var(--lcars-gray)',
        }}>
          No equipped tire sets
        </div>
      ) : (
        <div>
          {tireSets.map((ts, i) => {
            const percent = Math.min((ts.accumulated_mileage / STANDARD_TIRE_LIFE) * 100, 100)
            const wearColor = percent < 60
              ? 'var(--lcars-green)'
              : percent < 80
                ? 'var(--lcars-butterscotch)'
                : 'var(--lcars-tomato)'

            return (
              <div
                key={ts.id}
                style={{
                  padding: '0.625rem 0.75rem',
                  borderBottom: i < tireSets.length - 1 ? '1px solid rgba(102, 102, 136, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <div>
                    <div style={{
                      fontFamily: "'Antonio', sans-serif",
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--lcars-space-white)',
                    }}>
                      {ts.name || `${ts.tire_brand} ${ts.tire_model || ''}`}
                    </div>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.68rem',
                      color: 'var(--lcars-gray)',
                    }}>
                      {ts.vehicle_name}
                    </div>
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--lcars-space-white)',
                  }}>
                    {ts.accumulated_mileage.toLocaleString()} mi
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ marginTop: '0.375rem' }}>
                  <SquaredProgressBar
                    percent={percent}
                    max={100}
                    color={wearColor}
                    height={8}
                  />
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '0.125rem',
                  }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.6rem',
                      color: 'var(--lcars-gray)',
                    }}>
                      0
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.6rem',
                      color: 'var(--lcars-gray)',
                    }}>
                      {(STANDARD_TIRE_LIFE / 1000).toLocaleString()}k mi
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 7: Activity Timeline / Ship's Log
// ═══════════════════════════════════════════════════════════════════════════
function ActivityTimelinePanel({ timeline }) {
  const getIcon = (type) => {
    switch (type) {
      case 'maintenance': return <Wrench size={14} />
      case 'fuel': return <Fuel size={14} />
      case 'note': return <StickyNote size={14} />
      default: return <CircleDot size={14} />
    }
  }

  return (
    <LCARSPanel title="Ship's Log" color="var(--lcars-sunflower)" noPadding={timeline.length > 0}>
      {timeline.length === 0 ? (
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
          {timeline.map((entry, i) => (
            <div
              key={`${entry.type}-${entry.id}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.625rem',
                padding: '0.5rem 0.75rem',
                borderBottom: i < timeline.length - 1 ? '1px solid rgba(102, 102, 136, 0.15)' : 'none',
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
// Panel 8: Component Health
// ═══════════════════════════════════════════════════════════════════════════
function ComponentHealthPanel({ components }) {
  const getAgeColor = (days) => {
    if (days == null) return 'var(--lcars-gray)'
    if (days < 365) return 'var(--lcars-green)'
    if (days < 730) return 'var(--lcars-butterscotch)'
    return 'var(--lcars-tomato)'
  }

  // Group by vehicle
  const grouped = {}
  for (const c of components) {
    const key = c.vehicle_name
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(c)
  }

  return (
    <LCARSPanel title="Component Health" color="var(--lcars-african-violet)" noPadding={components.length > 0}>
      {components.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '1.5rem 0.75rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          color: 'var(--lcars-gray)',
        }}>
          No active components tracked
        </div>
      ) : (
        <div>
          {Object.entries(grouped).map(([vehicleName, comps]) => (
            <div key={vehicleName}>
              {/* Vehicle group header */}
              <div style={{
                padding: '0.375rem 0.75rem',
                background: 'rgba(102, 102, 136, 0.08)',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.68rem',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--lcars-african-violet)',
              }}>
                {vehicleName}
              </div>

              {comps.map((c, i) => {
                const typeConfig = getComponentType(c.component_type)
                const ageColor = getAgeColor(c.days_since_install)

                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.4rem 0.75rem',
                      borderBottom: '1px solid rgba(102, 102, 136, 0.1)',
                    }}
                  >
                    {/* Component icon */}
                    <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>
                      {typeConfig.icon}
                    </span>

                    {/* Component info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--lcars-space-white)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {c.brand || ''} {c.model || typeConfig.label}
                      </div>
                    </div>

                    {/* Age info */}
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '0.68rem',
                      color: ageColor,
                      flexShrink: 0,
                      textAlign: 'right',
                    }}>
                      {c.days_since_install != null ? (
                        <>
                          {c.days_since_install}d
                          {c.miles_since_install != null && (
                            <span style={{ color: 'var(--lcars-gray)', marginLeft: '0.25rem' }}>
                              / {c.miles_since_install.toLocaleString()} mi
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ color: 'var(--lcars-gray)' }}>---</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 9: Notification Feed
// ═══════════════════════════════════════════════════════════════════════════
function NotificationFeedPanel({ feed, unreadCount, onMarkAllRead }) {
  const accentColor = unreadCount > 0 ? 'var(--lcars-tomato)' : 'var(--lcars-gray)'

  return (
    <LCARSPanel
      title="Communications"
      color={accentColor}
      headerRight={
        unreadCount > 0 && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#000000',
          }}>
            {unreadCount} UNREAD
          </span>
        )
      }
      noPadding={feed.length > 0}
      footer={
        unreadCount > 0 ? (
          <button
            onClick={onMarkAllRead}
            style={{
              padding: '0.2rem 0.6rem',
              border: 'none',
              background: 'rgba(102, 102, 136, 0.2)',
              color: 'var(--lcars-gray)',
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.7rem',
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--lcars-ice)'
              e.currentTarget.style.color = '#000000'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(102, 102, 136, 0.2)'
              e.currentTarget.style.color = 'var(--lcars-gray)'
            }}
          >
            Mark All Read
          </button>
        ) : null
      }
    >
      {feed.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '1.5rem 0.75rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          color: 'var(--lcars-gray)',
        }}>
          No communications
        </div>
      ) : (
        <div>
          {feed.map((n, i) => (
            <div
              key={n.id}
              style={{
                display: 'flex',
                padding: '0.5rem 0.75rem',
                borderBottom: i < feed.length - 1 ? '1px solid rgba(102, 102, 136, 0.15)' : 'none',
                gap: '0.5rem',
              }}
            >
              {/* Unread indicator */}
              <div style={{
                width: '3px',
                alignSelf: 'stretch',
                background: !n.is_read ? 'var(--lcars-tomato)' : 'transparent',
                flexShrink: 0,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  fontWeight: !n.is_read ? 700 : 400,
                  color: !n.is_read ? 'var(--lcars-space-white)' : 'var(--lcars-gray)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {n.title}
                </div>
                {n.body && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.68rem',
                    color: 'var(--lcars-gray)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '0.0625rem',
                  }}>
                    {n.body}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              {n.created_at && (
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem',
                  color: 'var(--lcars-gray)',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}>
                  {new Date(n.created_at).toLocaleDateString()}
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
// Panel 10: Notes Database
// ═══════════════════════════════════════════════════════════════════════════
function LCARSNotesPanel({ notes }) {
  return (
    <LCARSPanel
      title="Notes Database"
      color="var(--lcars-african-violet)"
      headerRight={
        <Link to="/notes" style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          color: '#000000',
          textDecoration: 'none',
          letterSpacing: '0.05em',
        }}>
          View All
        </Link>
      }
      noPadding
    >
      {notes?.recent?.length > 0 ? (
        <div>
          {notes.recent.slice(0, 4).map((note, i) => (
            <div
              key={note.id}
              style={{
                padding: '0.5rem 0.75rem',
                borderBottom: i < Math.min(notes.recent.length, 4) - 1 ? '1px solid rgba(102, 102, 136, 0.15)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {note.is_starred && (
                  <Star size={11} fill="var(--lcars-sunflower)" style={{ color: 'var(--lcars-sunflower)', flexShrink: 0 }} />
                )}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--lcars-space-white)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {note.title}
                </span>
              </div>
              {note.content_text && (
                <div style={{
                  fontSize: '0.75rem',
                  color: 'var(--lcars-gray)',
                  marginTop: '0.125rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {note.content_text.slice(0, 80)}
                </div>
              )}
              {note.tags && note.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {note.tags.slice(0, 2).map(tag => (
                    <span key={tag.id} style={{
                      fontSize: '0.65rem',
                      padding: '0.06rem 0.4rem',
                      background: 'rgba(204, 153, 255, 0.15)',
                      color: tag.color || 'var(--lcars-african-violet)',
                      fontFamily: "'Antonio', sans-serif",
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <LCARSEmptyState
          message="No notes in database"
          linkTo="/notes"
          linkLabel="Create First Entry"
        />
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 11: Projects
// ═══════════════════════════════════════════════════════════════════════════
function LCARSProjectsPanel({ stats }) {
  return (
    <LCARSPanel
      title="Project Tracker"
      color="var(--lcars-lilac)"
      headerRight={
        <Link to="/projects" style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          color: '#000000',
          textDecoration: 'none',
          letterSpacing: '0.05em',
        }}>
          View All
        </Link>
      }
    >
      {!stats || stats.active_projects === 0 ? (
        <LCARSEmptyState
          message="No projects registered"
          linkTo="/projects"
          linkLabel="Create First Project"
        />
      ) : (
        <div>
          {/* Stats row */}
          <div style={{
            display: 'flex',
            gap: '1.5rem',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
          }}>
            <LCARSStat
              label="Active"
              value={stats.active_projects}
              color="var(--lcars-lilac)"
            />
            <LCARSStat
              label="In Progress"
              value={stats.tasks_in_progress || 0}
              color="var(--lcars-butterscotch)"
            />
            <LCARSStat
              label="Completed"
              value={stats.tasks_completed || 0}
              color="var(--lcars-green)"
            />
            {stats.overdue_tasks > 0 && (
              <LCARSStat
                label="Overdue"
                value={stats.overdue_tasks}
                color="var(--lcars-tomato)"
              />
            )}
          </div>

          {/* Recent tasks */}
          {stats.recent_tasks?.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(102, 102, 136, 0.3)', paddingTop: '0.5rem' }}>
              <div style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--lcars-gray)',
                marginBottom: '0.375rem',
              }}>
                Recent Tasks
              </div>
              {stats.recent_tasks.slice(0, 4).map((task, i) => (
                <LCARSDataRow
                  key={task.id}
                  icon={<FolderKanban size={13} />}
                  label={task.title}
                  value={task.project_name}
                  color="var(--lcars-lilac)"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Panel 12: Library Computer (Knowledge Base)
// ═══════════════════════════════════════════════════════════════════════════
function LCARSLibraryComputerPanel({ stats }) {
  return (
    <LCARSPanel
      title="Library Computer"
      color="var(--lcars-gold)"
      headerRight={
        <Link to="/kb" style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          color: '#000000',
          textDecoration: 'none',
          letterSpacing: '0.05em',
        }}>
          Access
        </Link>
      }
    >
      {!stats || stats.total === 0 ? (
        <LCARSEmptyState
          message="No database entries"
          linkTo="/kb"
          linkLabel="Create First Entry"
        />
      ) : (
        <div>
          {/* Stats row */}
          <div style={{
            display: 'flex',
            gap: '1.5rem',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
          }}>
            <LCARSStat
              label="Entries"
              value={stats.total}
              color="var(--lcars-gold)"
            />
            <LCARSStat
              label="Verified"
              value={stats.by_status?.published || 0}
              color="var(--lcars-green)"
            />
            <LCARSStat
              label="Preliminary"
              value={stats.by_status?.draft || 0}
              color="var(--lcars-sunflower)"
            />
            <LCARSStat
              label="Classifications"
              value={stats.categories_count || 0}
              color="var(--lcars-ice)"
            />
          </div>

          {/* Recent entries */}
          {stats.recent?.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(102, 102, 136, 0.3)', paddingTop: '0.5rem' }}>
              <div style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--lcars-gray)',
                marginBottom: '0.375rem',
              }}>
                Recent Database Entries
              </div>
              {stats.recent.slice(0, 4).map((article) => (
                <LCARSDataRow
                  key={article.id}
                  icon={<BookOpen size={13} />}
                  label={article.title}
                  value={article.status === 'published' ? 'VERIFIED' : article.status?.toUpperCase()}
                  color="var(--lcars-gold)"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Engineering Status Panel (Infrastructure)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Infrastructure summary panel for the LCARS dashboard.
 * Shows host/container/service counts and active incidents.
 */
function LCARSEngineeringPanel({ data }) {
  if (!data) {
    return (
      <LCARSPanel title="Engineering Status" color="var(--lcars-tanoi)">
        <div style={{
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.85rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          No infrastructure data available
        </div>
      </LCARSPanel>
    )
  }

  const hosts = data.hosts || {}
  const containers = data.containers || {}
  const services = data.services || {}
  const incidents = data.incidents || {}

  const totalHosts = hosts.total || 0
  const totalContainers = containers.total || 0
  const runningContainers = containers.by_status?.running || 0
  const totalServices = services.total || 0
  const servicesUp = services.by_status?.up || 0
  const activeIncidents = incidents.active || 0

  // Determine overall system status
  let systemStatus = 'NOMINAL'
  let statusColor = 'var(--lcars-mars)'
  if (activeIncidents > 0) {
    systemStatus = 'ALERT'
    statusColor = 'var(--lcars-red-alert)'
  } else if (totalServices > 0 && servicesUp < totalServices) {
    systemStatus = 'ADVISORY'
    statusColor = 'var(--lcars-gold)'
  }

  return (
    <LCARSPanel title="Engineering Status" color="var(--lcars-tanoi)">
      <div style={{ padding: '0.75rem' }}>
        {/* System status header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Server size={16} color="var(--lcars-tanoi)" />
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: statusColor,
            }}>
              System: {systemStatus}
            </span>
          </div>
          <Link
            to="/infrastructure"
            style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.7rem',
              color: 'var(--lcars-tanoi)',
              textDecoration: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              opacity: 0.8,
            }}
          >
            Full Report &gt;
          </Link>
        </div>

        {/* Stats grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.5rem',
        }}>
          <LCARSStat
            label="Hosts"
            value={totalHosts}
            color="var(--lcars-tanoi)"
          />
          <LCARSStat
            label="Containers"
            value={`${runningContainers}/${totalContainers}`}
            color={runningContainers === totalContainers ? 'var(--lcars-mars)' : 'var(--lcars-gold)'}
          />
          <LCARSStat
            label="Services"
            value={`${servicesUp}/${totalServices}`}
            color={servicesUp === totalServices ? 'var(--lcars-mars)' : 'var(--lcars-gold)'}
          />
          <LCARSStat
            label="Incidents"
            value={activeIncidents}
            color={activeIncidents > 0 ? 'var(--lcars-red-alert)' : 'var(--lcars-mars)'}
          />
        </div>

        {/* Host breakdown if we have hosts */}
        {totalHosts > 0 && hosts.by_type && (
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--lcars-gray)',
              marginBottom: '0.375rem',
            }}>
              Host Registry
            </div>
            {Object.entries(hosts.by_type).map(([type, count]) => (
              <LCARSDataRow
                key={type}
                icon={<Server size={13} />}
                label={type.replace(/_/g, ' ')}
                value={count}
                color="var(--lcars-tanoi)"
              />
            ))}
          </div>
        )}
      </div>
    </LCARSPanel>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Astrometrics Panel
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Astrometrics summary panel for the LCARS dashboard.
 * Shows next launch, crew in space count.
 */
function LCARSAstrometricsPanel({ data }) {
  if (!data) {
    return (
      <LCARSPanel title="Astrometrics" color="var(--lcars-ice)">
        <div style={{
          padding: '1.5rem',
          textAlign: 'center',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.85rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          No astrometrics data available
        </div>
      </LCARSPanel>
    )
  }

  return (
    <LCARSPanel
      title="Astrometrics"
      color="var(--lcars-ice)"
      headerRight={
        <Link to="/astrometrics" style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          color: '#000000',
          textDecoration: 'none',
          letterSpacing: '0.05em',
        }}>
          Full Scan
        </Link>
      }
    >
      <div style={{ padding: '0.75rem' }}>
        {/* System header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Telescope size={16} color="var(--lcars-ice)" />
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '1rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--lcars-ice)',
            }}>
              Sensor Array: Online
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.5rem',
          marginBottom: '0.75rem',
        }}>
          <LCARSStat
            label="Crew in Space"
            value={data.crewCount}
            color="var(--lcars-ice)"
          />
        </div>

        {/* Next launch */}
        {data.nextLaunch && (
          <div style={{ borderTop: '1px solid rgba(102, 102, 136, 0.3)', paddingTop: '0.5rem' }}>
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--lcars-gray)',
              marginBottom: '0.375rem',
            }}>
              Next Mission
            </div>
            <LCARSDataRow
              icon={<Telescope size={13} />}
              label={data.nextLaunch.name}
              value={data.nextLaunch.net
                ? new Date(data.nextLaunch.net).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'TBD'}
              color="var(--lcars-sunflower)"
            />
            {data.nextLaunch.launch_service_provider?.name && (
              <LCARSDataRow
                icon={<Server size={13} />}
                label="Provider"
                value={data.nextLaunch.launch_service_provider.name}
                color="var(--lcars-gray)"
              />
            )}
          </div>
        )}
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
 * Mini stat for vehicle cards - compact label/value.
 */
function MiniStat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.6rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--lcars-gray)',
      }}>
        {label}:
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.72rem',
        fontWeight: 600,
        color: color || 'var(--lcars-space-white)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '120px',
      }}>
        {value}
      </span>
    </div>
  )
}

/**
 * Data field for fuel economy panel - compact label/value pair.
 */
function DataField({ label, value, color }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'baseline',
      gap: '0.375rem',
      padding: '0.2rem 0',
    }}>
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.65rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--lcars-gray)',
        whiteSpace: 'nowrap',
      }}>
        {label}:
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.75rem',
        fontWeight: 600,
        color: color || 'var(--lcars-space-white)',
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}

/**
 * Cost analysis column header.
 */
function CostHeader({ label }) {
  return (
    <span style={{
      fontFamily: "'Antonio', sans-serif",
      fontSize: '0.68rem',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      color: 'var(--lcars-green)',
      textAlign: 'center',
    }}>
      {label}
    </span>
  )
}

/**
 * Cost analysis data row.
 */
function CostRow({ label, val30d, valYtd }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 1fr',
      gap: '0.5rem',
      padding: '0.25rem 0',
    }}>
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.72rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--lcars-gray)',
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--lcars-space-white)',
      }}>
        {val30d}
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--lcars-space-white)',
      }}>
        {valYtd}
      </span>
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
 * LCARS loading skeleton - updated for 6-row layout.
 */
function LCARSLoadingSkeleton() {
  const skeletonBar = { background: 'rgba(102, 102, 136, 0.08)', border: '1px solid rgba(102, 102, 136, 0.15)' }

  return (
    <div style={{ maxWidth: '1400px' }}>
      <div style={{ height: '1.5rem', width: '240px', background: 'rgba(102, 102, 136, 0.2)', marginBottom: '0.5rem' }} />
      <div style={{ height: '0.8rem', width: '300px', background: 'rgba(102, 102, 136, 0.1)', marginBottom: '1.5rem' }} />

      {/* Row 1: Full width */}
      <div style={{ height: '80px', marginBottom: '1rem', ...skeletonBar }} />

      {/* Row 2: Full width */}
      <div style={{ height: '120px', marginBottom: '1rem', ...skeletonBar }} />

      {/* Row 3: 2 cols */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div style={{ height: '220px', ...skeletonBar }} />
        <div style={{ height: '220px', ...skeletonBar }} />
      </div>

      {/* Row 4: 2 cols */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div style={{ height: '180px', ...skeletonBar }} />
        <div style={{ height: '180px', ...skeletonBar }} />
      </div>

      {/* Row 5: 2 cols */}
      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div style={{ height: '200px', ...skeletonBar }} />
        <div style={{ height: '200px', ...skeletonBar }} />
      </div>

      {/* Row 6: 2 cols */}
      <div className="form-grid-2col">
        <div style={{ height: '200px', ...skeletonBar }} />
        <div style={{ height: '200px', ...skeletonBar }} />
      </div>
    </div>
  )
}
