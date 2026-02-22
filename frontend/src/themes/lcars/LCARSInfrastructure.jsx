/**
 * LCARSInfrastructure.jsx - LCARS Engineering Status Dashboard
 *
 * Main infrastructure overview in LCARS visual language.
 * Panels: Host status, container grid, service health, recent incidents.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Server, Box, Globe, AlertTriangle, Plus, X, ChevronRight,
  Wifi, Settings, RefreshCw, Thermometer, Printer,
} from 'lucide-react'
import { infrastructure } from '../../api/client'
import { formatDate } from '../../utils/formatDate'
import LCARSPanel, { LCARSDataRow, LCARSStat } from './LCARSPanel'
import InfraHostForm from '../../components/InfraHostForm'

// Status color mapping (LCARS canonical colors)
const STATUS_COLORS = {
  online: 'var(--lcars-green)',
  up: 'var(--lcars-green)',
  running: 'var(--lcars-green)',
  offline: 'var(--lcars-tomato)',
  down: 'var(--lcars-tomato)',
  stopped: 'var(--lcars-tomato)',
  exited: 'var(--lcars-tomato)',
  degraded: 'var(--lcars-sunflower)',
  restarting: 'var(--lcars-butterscotch)',
  unknown: 'var(--lcars-gray)',
  active: 'var(--lcars-tomato)',
  investigating: 'var(--lcars-sunflower)',
  resolved: 'var(--lcars-green)',
}

const SEVERITY_COLORS = {
  critical: 'var(--lcars-red-alert)',
  high: 'var(--lcars-tomato)',
  medium: 'var(--lcars-sunflower)',
  low: 'var(--lcars-ice)',
}

export default function LCARSInfrastructure() {
  const [dash, setDash] = useState(null)
  const [hosts, setHosts] = useState([])
  const [containers, setContainers] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddHost, setShowAddHost] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const intervalRef = useRef(null)

  async function loadData() {
    try {
      const [d, h, c, s] = await Promise.all([
        infrastructure.dashboard(),
        infrastructure.hosts.list(),
        infrastructure.containers.list(),
        infrastructure.services.list(),
      ])
      setDash(d)
      setHosts(h)
      setContainers(c)
      setServices(s)
    } catch (err) {
      console.error('Failed to load infrastructure:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Auto-refresh: start/stop a 30-second polling interval
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadData()
      }, 30000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    // Clean up on unmount or when autoRefresh changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefresh])

  // Feedback message shown after host creation (Docker setup result)
  const [hostFeedback, setHostFeedback] = useState(null)

  async function handleAddHost(data) {
    try {
      const result = await infrastructure.hosts.create(data)
      await loadData()
      setShowAddHost(false)

      // Show Docker setup feedback if applicable
      if (result.docker_setup) {
        const ds = result.docker_setup
        if (ds.connection_ok && ds.sync_result) {
          const count = ds.sync_result.total_containers || ds.sync_result.created || 0
          setHostFeedback({ type: 'success', message: `HOST CREATED. DOCKER CONNECTED — ${count} CONTAINER${count !== 1 ? 'S' : ''} FOUND.` })
        } else if (ds.connection_ok) {
          setHostFeedback({ type: 'success', message: 'HOST CREATED. DOCKER CONNECTION ESTABLISHED.' })
        } else {
          setHostFeedback({ type: 'warning', message: `HOST CREATED. DOCKER CONNECTION FAILED: ${(ds.error || 'Unknown error').toUpperCase()}` })
        }
        // Auto-clear feedback after 8 seconds
        setTimeout(() => setHostFeedback(null), 8000)
      }
    } catch (err) {
      alert('Failed to add host: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-ice)',
          fontSize: '0.9rem',
        }}>
          SCANNING INFRASTRUCTURE...
        </div>
      </div>
    )
  }

  const activeIncidents = dash?.incidents?.active || 0
  const recentIncidents = dash?.incidents?.recent || []

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Scan pulse animation for auto-refresh mode */}
      {autoRefresh && (
        <style>{`
          @keyframes lcars-scan-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          .lcars-scan-active {
            animation: lcars-scan-pulse 2s ease-in-out infinite;
          }
        `}</style>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '1.5rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--lcars-space-white)',
          }}>
            Engineering Status
          </h1>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem', color: 'var(--lcars-tanoi)', marginTop: '0.25rem',
          }}>
            {hosts.length} host{hosts.length !== 1 ? 's' : ''} / {containers.length} container{containers.length !== 1 ? 's' : ''} / {services.length} service{services.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.75rem', borderRadius: '999px',
              border: 'none', cursor: 'pointer',
              background: autoRefresh ? 'var(--lcars-green)' : 'var(--lcars-tanoi)',
              color: '#000',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              transition: 'background 0.2s, opacity 0.15s',
              opacity: 0.9,
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <RefreshCw size={14} />
            {autoRefresh ? 'Auto: On' : 'Auto: Off'}
          </button>
          {/* LIVE indicator when auto-refresh is active */}
          {autoRefresh && (
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.8rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--lcars-green)',
            }}>
              LIVE
            </span>
          )}
          <button
            onClick={loadData}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.75rem', borderRadius: '999px',
              border: 'none', cursor: 'pointer',
              background: 'var(--lcars-ice)',
              color: '#000',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              opacity: 0.9, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={() => setShowAddHost(!showAddHost)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.75rem', borderRadius: '999px',
              border: 'none', cursor: 'pointer',
              background: 'var(--lcars-butterscotch)',
              color: '#000',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              opacity: 0.9, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            {showAddHost ? <X size={14} /> : <Plus size={14} />}
            {showAddHost ? 'Cancel' : 'Register Host'}
          </button>
        </div>
      </div>

      {/* Add Host Form */}
      {showAddHost && (
        <LCARSPanel title="New Host Registration" color="var(--lcars-butterscotch)" style={{ marginBottom: '1.5rem' }}>
          <InfraHostForm onSubmit={handleAddHost} onCancel={() => setShowAddHost(false)} />
        </LCARSPanel>
      )}

      {/* Docker Setup Feedback */}
      {hostFeedback && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.625rem 0.75rem',
          borderLeft: `3px solid ${hostFeedback.type === 'success' ? 'var(--lcars-green)' : 'var(--lcars-sunflower)'}`,
          background: 'rgba(0, 0, 0, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem',
            color: hostFeedback.type === 'success' ? 'var(--lcars-green)' : 'var(--lcars-sunflower)',
          }}>
            {hostFeedback.message}
          </span>
          <button
            onClick={() => setHostFeedback(null)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--lcars-gray)', padding: '2px',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Summary Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <LCARSPanel title="Hosts" color="var(--lcars-ice)">
          <LCARSStat label="Total Hosts" value={dash?.hosts?.total || 0} color="var(--lcars-ice)" icon={<Server size={20} />} />
        </LCARSPanel>
        <LCARSPanel title="Containers" color="var(--lcars-green)">
          <LCARSStat label="Total Containers" value={dash?.containers?.total || 0} color="var(--lcars-green)" icon={<Box size={20} />} />
        </LCARSPanel>
        <LCARSPanel title="Services" color="var(--lcars-tanoi)">
          <LCARSStat label="Monitored" value={dash?.services?.total || 0} color="var(--lcars-tanoi)" icon={<Globe size={20} />} />
        </LCARSPanel>
        <LCARSPanel title="Alerts" color={activeIncidents > 0 ? 'var(--lcars-tomato)' : 'var(--lcars-green)'}>
          <LCARSStat label="Active Incidents" value={activeIncidents} color={activeIncidents > 0 ? 'var(--lcars-tomato)' : 'var(--lcars-green)'} icon={<AlertTriangle size={20} />} />
        </LCARSPanel>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { to: '/infrastructure/network', label: 'Network', icon: Wifi, color: 'var(--lcars-lilac)' },
          { to: '/infrastructure/services', label: 'Services', icon: Globe, color: 'var(--lcars-tanoi)' },
          { to: '/infrastructure/incidents', label: 'Incidents', icon: AlertTriangle, color: 'var(--lcars-butterscotch)' },
          { to: '/infrastructure/integrations', label: 'Integrations', icon: Settings, color: 'var(--lcars-ice)' },
          { to: '/infrastructure/smarthome', label: 'Smart Home', icon: Thermometer, color: 'var(--lcars-gold)' },
          { to: '/infrastructure/printer', label: 'Fabrication', icon: Printer, color: 'var(--lcars-african-violet)' },
        ].map(nav => (
          <Link key={nav.to} to={nav.to} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.4rem 0.75rem', borderRadius: '999px',
            background: nav.color, color: '#000',
            textDecoration: 'none',
            fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            opacity: 0.85, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.85'}
          >
            <nav.icon size={14} /> {nav.label}
          </Link>
        ))}
      </div>

      {/* Host Registry */}
      <LCARSPanel title="Host Registry" color="var(--lcars-ice)" style={{ marginBottom: '1.5rem' }}>
        {hosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Server size={28} style={{ color: 'var(--lcars-gray)', marginBottom: '0.5rem' }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: 'var(--lcars-gray)' }}>
              No hosts registered
            </div>
          </div>
        ) : (
          hosts.map(h => (
            <Link key={h.id} to={`/infrastructure/hosts/${h.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.625rem 0.75rem',
                borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
                cursor: 'pointer', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(102, 102, 136, 0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {/* Status dot */}
                <div
                  className={autoRefresh ? 'lcars-status-dot' : ''}
                  style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: STATUS_COLORS[h.status] || STATUS_COLORS.unknown,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    fontFamily: "'Antonio', sans-serif", fontSize: '0.9rem',
                    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: 'var(--lcars-space-white)',
                  }}>
                    {h.name}
                  </span>
                </div>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                  color: 'var(--lcars-gray)',
                }}>
                  {h.host_type}
                </span>
                {h.ip_address && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                    color: 'var(--lcars-ice)',
                  }}>
                    {h.ip_address}
                  </span>
                )}
                <span
                  className={autoRefresh ? 'lcars-scan-active' : ''}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                    color: STATUS_COLORS[h.status] || STATUS_COLORS.unknown,
                    textTransform: 'uppercase',
                  }}
                >
                  {h.status}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                  color: 'var(--lcars-gray)',
                }}>
                  {h.container_count} ct
                </span>
                <ChevronRight size={14} style={{ color: 'var(--lcars-gray)', flexShrink: 0 }} />
              </div>
            </Link>
          ))
        )}
      </LCARSPanel>

      {/* Container Grid */}
      {containers.length > 0 && (
        <LCARSPanel title={`Container Status — ${containers.length} Total`} color="var(--lcars-green)" style={{ marginBottom: '1.5rem' }}>
          <div className={autoRefresh ? 'lcars-scan-stripe' : ''} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
            {containers.slice(0, 18).map(c => (
              <div key={c.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.5rem 0.625rem',
                border: '1px solid rgba(102, 102, 136, 0.2)',
                borderLeft: `3px solid ${STATUS_COLORS[c.status] || STATUS_COLORS.unknown}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
                    color: 'var(--lcars-space-white)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {c.name}
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem',
                    color: 'var(--lcars-gray)', marginTop: '2px',
                  }}>
                    {c.image?.split(':')[0]?.split('/').pop() || '—'}
                  </div>
                </div>
                <span
                  className={autoRefresh ? 'lcars-scan-active' : ''}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem',
                    color: STATUS_COLORS[c.status] || STATUS_COLORS.unknown,
                    textTransform: 'uppercase', flexShrink: 0,
                  }}
                >
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </LCARSPanel>
      )}

      {/* Services Health */}
      {services.length > 0 && (
        <LCARSPanel title="Service Health" color="var(--lcars-tanoi)" style={{ marginBottom: '1.5rem' }}>
          {services.slice(0, 10).map(s => (
            <LCARSDataRow
              key={s.id}
              label={s.name}
              value={s.last_response_time_ms != null ? `${s.last_response_time_ms}ms` : s.status}
              color={STATUS_COLORS[s.status] || STATUS_COLORS.unknown}
              icon={<Globe size={14} />}
            />
          ))}
        </LCARSPanel>
      )}

      {/* Recent Incidents */}
      {recentIncidents.length > 0 && (
        <LCARSPanel title="Recent Incidents" color="var(--lcars-butterscotch)">
          {recentIncidents.map(i => (
            <div key={i.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.5rem 0.75rem',
              borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
            }}>
              <div
                className={autoRefresh ? 'lcars-scan-active' : ''}
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: SEVERITY_COLORS[i.severity] || 'var(--lcars-gray)',
                  flexShrink: 0,
                }}
              />
              <span style={{
                fontFamily: "'Antonio', sans-serif", fontSize: '0.85rem',
                color: 'var(--lcars-space-white)', flex: 1,
                textTransform: 'uppercase', letterSpacing: '0.03em',
              }}>
                {i.title}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
                color: STATUS_COLORS[i.status] || 'var(--lcars-gray)',
                textTransform: 'uppercase',
              }}>
                {i.status}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
                color: 'var(--lcars-gray)',
              }}>
                {formatDate(i.started_at)}
              </span>
            </div>
          ))}
        </LCARSPanel>
      )}
    </div>
  )
}
