/**
 * GlassDashboard.jsx - Glass Theme Dashboard
 *
 * Grid of glass panels: weather, fleet status, maintenance alerts,
 * recent activity, system status. Apple-style metric cards with
 * large numbers and subtle labels.
 *
 * API calls: weather, fleet-status, system-stats, vehicles.list
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Car, StickyNote, Wrench, Plus, Droplets, Wind,
  X, Fuel, FolderKanban, BookOpen, Server, Telescope, Library,
  CheckCircle2, AlertTriangle, CircleDot, ChevronRight
} from 'lucide-react'
import { dashboard, vehicles } from '../../api/client'
import { formatDate } from '../../utils/formatDate'
import { getWeatherInfo, getDayName } from '../../components/weatherCodes'
import MaintenanceForm from '../../components/MaintenanceForm'
import FuelForm from '../../components/FuelForm'
import GlassPanel from './GlassPanel'
import GlassModal from './GlassModal'
import GlassIcon from './GlassIcon'

const STATUS_COLORS = {
  overdue: '#FF453A',
  due: '#FFD60A',
  due_soon: '#FF9F0A',
  ok: '#30D158',
  unknown: 'rgba(255,255,255,0.30)',
}

const TIMELINE_COLORS = {
  maintenance: '#FF9F0A',
  fuel: '#30D158',
  note: '#BF5AF2',
}

export default function GlassDashboard() {
  const [weather, setWeather] = useState(null)
  const [fleetStatus, setFleetStatus] = useState(null)
  const [systemStats, setSystemStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showQuickAddFuel, setShowQuickAddFuel] = useState(false)
  const [vehiclesList, setVehiclesList] = useState([])
  const [maintenanceItems, setMaintenanceItems] = useState([])

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
    function onVehicleChanged() { loadDashboard() }
    window.addEventListener('vehicle-selection-changed', onVehicleChanged)
    return () => window.removeEventListener('vehicle-selection-changed', onVehicleChanged)
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: '0.9rem' }}>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <GlassPanel title="Error">
        <p style={{ color: '#FF453A' }}>{error}</p>
      </GlassPanel>
    )
  }

  const alerts = (fleetStatus?.interval_alerts || []).filter(a => a.status !== 'ok' && a.status !== 'unknown')
  const timeline = fleetStatus?.recent_activity || []
  const summaries = fleetStatus?.vehicle_summaries || []

  return (
    <div className="glass-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Row 1: Weather + Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Weather Panel */}
        <GlassPanel title="Weather">
          {weather ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2.5rem' }}>{getWeatherInfo(weather.current?.weathercode)?.icon}</span>
                <div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.1 }}>
                    {Math.round(weather.current?.temperature_2m ?? 0)}°
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
                    {getWeatherInfo(weather.current?.weathercode)?.label}
                  </div>
                </div>
              </div>
              {/* Forecast row */}
              <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto' }}>
                {weather.daily?.time?.slice(1, 6).map((day, i) => (
                  <div key={day} style={{
                    textAlign: 'center',
                    padding: '0.5rem',
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.04)',
                    minWidth: '60px',
                  }}>
                    <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>{getDayName(day)}</div>
                    <div style={{ fontSize: '1.1rem', margin: '2px 0' }}>
                      {getWeatherInfo(weather.daily?.weathercode?.[i + 1])?.icon}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {Math.round(weather.daily?.temperature_2m_max?.[i + 1] ?? 0)}°
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: '0.85rem' }}>
              Weather data unavailable
            </div>
          )}
        </GlassPanel>

        {/* Quick Actions */}
        <GlassPanel
          title="Quick Actions"
          headerRight={
            <select
              value={localStorage.getItem('dashboard_vehicle_id') || 'all'}
              onChange={e => {
                localStorage.setItem('dashboard_vehicle_id', e.target.value)
                window.dispatchEvent(new Event('vehicle-selection-changed'))
              }}
              style={{
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '980px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.80)',
              }}
            >
              <option value="all">All Vehicles</option>
              {vehiclesList.map(v => (
                <option key={v.id} value={v.id}>{v.year} {v.make} {v.model}</option>
              ))}
            </select>
          }
        >
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => setShowQuickAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Wrench size={16} />
              Log Maintenance
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setShowQuickAddFuel(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Fuel size={16} />
              Log Fuel
            </button>
          </div>
        </GlassPanel>
      </div>

      {/* Row 2: Maintenance Alerts */}
      {alerts.length > 0 && (
        <GlassPanel title="Maintenance Alerts">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {alerts.slice(0, 5).map((alert, i) => (
              <Link
                key={i}
                to={`/vehicles/${alert.vehicle_id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: STATUS_COLORS[alert.status] || STATUS_COLORS.unknown,
                  }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{alert.interval_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                      {alert.vehicle_name}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: STATUS_COLORS[alert.status] || STATUS_COLORS.unknown,
                  textTransform: 'uppercase',
                }}>
                  {alert.status?.replace('_', ' ')}
                </span>
              </Link>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Row 3: Fleet + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {/* Fleet Overview */}
        <GlassPanel title="Fleet Overview">
          {summaries.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {summaries.map(v => (
                <Link
                  key={v.id}
                  to={`/vehicles/${v.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    borderRadius: '12px',
                    background: 'rgba(255,255,255,0.03)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                      {v.year} {v.make} {v.model}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
                      {v.current_mileage?.toLocaleString() || '—'} mi
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.25)' }} />
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: '0.85rem' }}>
              No vehicles registered
            </div>
          )}
        </GlassPanel>

        {/* Recent Activity */}
        <GlassPanel title="Recent Activity">
          {timeline.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {timeline.slice(0, 5).map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0',
                    borderBottom: i < Math.min(timeline.length, 5) - 1
                      ? '1px solid rgba(255,255,255,0.04)'
                      : 'none',
                  }}
                >
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: TIMELINE_COLORS[entry.type] || 'rgba(255,255,255,0.30)',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{entry.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.40)' }}>
                      {entry.vehicle_name} {entry.date ? `· ${formatDate(entry.date)}` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.40)', fontSize: '0.85rem' }}>
              No recent activity
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Row 4: System Status */}
      <GlassPanel title="System Status">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
        }}>
          {[
            { label: 'Notes', value: systemStats?.notes?.count ?? 0, icon: StickyNote, color: '#BF5AF2', to: '/notes' },
            { label: 'Projects', value: systemStats?.projects?.active ?? 0, icon: FolderKanban, color: '#30D158', to: '/projects' },
            { label: 'Knowledge', value: systemStats?.kb?.total ?? 0, icon: BookOpen, color: '#FF9F0A', to: '/kb' },
            { label: 'Hosts', value: systemStats?.infrastructure?.hosts ?? 0, icon: Server, color: '#64D2FF', to: '/infrastructure' },
            { label: 'Space', value: systemStats?.astrometrics?.crew_in_space ?? 0, icon: Telescope, color: '#FFD60A', to: '/astrometrics' },
            { label: 'Database', value: systemStats?.trek?.cached_entities ?? 0, icon: Library, color: '#FF375F', to: '/trek' },
          ].map(stat => (
            <Link
              key={stat.label}
              to={stat.to}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '1rem 0.75rem',
                borderRadius: '14px',
                background: 'rgba(255,255,255,0.03)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
            >
              <GlassIcon icon={stat.icon} color={stat.color} size={36} />
              <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{stat.label}</div>
            </Link>
          ))}
        </div>
      </GlassPanel>

      {/* Quick Add Maintenance Modal */}
      {showQuickAdd && (
        <GlassModal title="Log Maintenance" onClose={() => setShowQuickAdd(false)}>
          <MaintenanceForm
            vehicles={vehiclesList}
            maintenanceItems={maintenanceItems}
            onSubmit={async (data) => {
              await vehicles.maintenance.create(data.vehicle_id, data)
              setShowQuickAdd(false)
              loadDashboard()
            }}
            onCancel={() => setShowQuickAdd(false)}
          />
        </GlassModal>
      )}

      {/* Quick Add Fuel Modal */}
      {showQuickAddFuel && (
        <GlassModal title="Log Fuel" onClose={() => setShowQuickAddFuel(false)}>
          <FuelForm
            vehicles={vehiclesList}
            onSubmit={async (data) => {
              await vehicles.fuel.create(data.vehicle_id, data)
              setShowQuickAddFuel(false)
              loadDashboard()
            }}
            onCancel={() => setShowQuickAddFuel(false)}
          />
        </GlassModal>
      )}
    </div>
  )
}
