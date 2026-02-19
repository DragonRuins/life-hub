/**
 * Infrastructure Page - Main Landing Dashboard
 *
 * Shows an overview of all infrastructure:
 *   - Summary stats (hosts, containers, services, incidents)
 *   - Host overview cards
 *   - Container status grid
 *   - Services health
 *   - Recent incidents
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Server, Box, Globe, AlertTriangle, Plus, X, ChevronRight,
  Wifi, Settings, RefreshCw,
} from 'lucide-react'
import { infrastructure } from '../api/client'
import InfraHostForm from '../components/InfraHostForm'
import InfraContainerCard from '../components/InfraContainerCard'
import InfraServiceCard from '../components/InfraServiceCard'

export default function Infrastructure() {
  const [dash, setDash] = useState(null)
  const [hosts, setHosts] = useState([])
  const [containers, setContainers] = useState([])
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddHost, setShowAddHost] = useState(false)
  const [error, setError] = useState(null)
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
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // Auto-refresh: set up / tear down 30-second interval
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadData()
      }, 30000)
    } else {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // Clean up on unmount or when autoRefresh changes
    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
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
          setHostFeedback({ type: 'success', message: `Host created. Docker connected — found ${count} container${count !== 1 ? 's' : ''}.` })
        } else if (ds.connection_ok) {
          setHostFeedback({ type: 'success', message: 'Host created. Docker connected successfully.' })
        } else {
          setHostFeedback({ type: 'warning', message: `Host created. Docker connection failed: ${ds.error || 'Unknown error'}` })
        }
        // Auto-clear feedback after 8 seconds
        setTimeout(() => setHostFeedback(null), 8000)
      }
    } catch (err) {
      alert('Failed to add host: ' + err.message)
    }
  }

  if (loading) return <p style={{ color: 'var(--color-subtext-0)' }}>Loading infrastructure...</p>
  if (error) return <p style={{ color: 'var(--color-red)' }}>Error: {error}</p>

  const activeIncidents = dash?.incidents?.active || 0
  const recentIncidents = dash?.incidents?.recent || []

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Keyframe animations for auto-refresh indicator */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Infrastructure</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Monitor your homelab servers, containers, and services
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* LIVE indicator — only visible when auto-refresh is active */}
          {autoRefresh && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
              color: 'var(--color-green)',
              background: 'rgba(166, 227, 161, 0.1)',
              padding: '0.2rem 0.55rem', borderRadius: '4px',
              userSelect: 'none',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: 'var(--color-green)',
                animation: 'live-pulse 1.5s ease-in-out infinite',
              }} />
              LIVE
            </span>
          )}
          {/* Auto-refresh toggle */}
          <button
            className="btn btn-ghost"
            onClick={() => setAutoRefresh(prev => !prev)}
            title={autoRefresh ? 'Disable auto-refresh (30s)' : 'Enable auto-refresh (30s)'}
            style={{
              background: autoRefresh ? 'rgba(166, 227, 161, 0.12)' : undefined,
              borderColor: autoRefresh ? 'var(--color-green)' : undefined,
            }}
          >
            <RefreshCw
              size={16}
              style={autoRefresh ? { color: 'var(--color-green)', animation: 'spin 2s linear infinite' } : {}}
            />
            {autoRefresh ? 'Auto' : 'Auto'}
          </button>
          <button className="btn btn-ghost" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddHost(!showAddHost)}>
            {showAddHost ? <X size={16} /> : <Plus size={16} />}
            {showAddHost ? 'Cancel' : 'Add Host'}
          </button>
        </div>
      </div>

      {/* Add Host Form */}
      {showAddHost && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <InfraHostForm onSubmit={handleAddHost} onCancel={() => setShowAddHost(false)} />
        </div>
      )}

      {/* Docker Setup Feedback */}
      {hostFeedback && (
        <div className="card" style={{
          marginBottom: '1rem',
          padding: '0.75rem 1rem',
          borderLeft: `3px solid ${hostFeedback.type === 'success' ? 'var(--color-green)' : 'var(--color-yellow)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <span style={{
            fontSize: '0.875rem',
            color: hostFeedback.type === 'success' ? 'var(--color-green)' : 'var(--color-yellow)',
          }}>
            {hostFeedback.message}
          </span>
          <button
            onClick={() => setHostFeedback(null)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--color-subtext-0)', padding: '2px',
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
        <SummaryCard
          icon={<Server size={20} />}
          label="Hosts"
          value={dash?.hosts?.total || 0}
          color="var(--color-blue)"
          to="/infrastructure/network"
          sub={Object.entries(dash?.hosts?.by_status || {}).map(([k, v]) => `${v} ${k}`).join(', ')}
        />
        <SummaryCard
          icon={<Box size={20} />}
          label="Containers"
          value={dash?.containers?.total || 0}
          color="var(--color-green)"
          sub={`${dash?.containers?.by_status?.running || 0} running`}
        />
        <SummaryCard
          icon={<Globe size={20} />}
          label="Services"
          value={dash?.services?.total || 0}
          color="var(--color-teal)"
          to="/infrastructure/services"
          sub={`${dash?.services?.by_status?.up || 0} up`}
        />
        <SummaryCard
          icon={<AlertTriangle size={20} />}
          label="Active Incidents"
          value={activeIncidents}
          color={activeIncidents > 0 ? 'var(--color-red)' : 'var(--color-green)'}
          to="/infrastructure/incidents"
        />
      </div>

      {/* Navigation Links */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <Link to="/infrastructure/network" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          <Wifi size={16} /> Network Devices
        </Link>
        <Link to="/infrastructure/services" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          <Globe size={16} /> Services
        </Link>
        <Link to="/infrastructure/incidents" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          <AlertTriangle size={16} /> Incidents
        </Link>
        <Link to="/infrastructure/integrations" className="btn btn-ghost" style={{ textDecoration: 'none' }}>
          <Settings size={16} /> Integrations
        </Link>
      </div>

      {/* Hosts */}
      <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>Hosts</h2>
      {hosts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <Server size={32} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
            No hosts yet. Add your first server above.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {hosts.map(h => (
            <Link key={h.id} to={`/infrastructure/hosts/${h.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  background: 'rgba(137, 180, 250, 0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Server size={18} style={{ color: 'var(--color-blue)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{h.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                    {h.host_type}{h.ip_address ? ` / ${h.ip_address}` : ''}{h.os_name ? ` / ${h.os_name}` : ''}
                  </div>
                </div>
                <StatusBadge status={h.status} />
                <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                  {h.container_count} containers
                </div>
                <ChevronRight size={16} style={{ color: 'var(--color-overlay-0)' }} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Containers (top 10) */}
      {containers.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Containers
            <span style={{ fontWeight: 400, fontSize: '0.85rem', color: 'var(--color-subtext-0)', marginLeft: '0.5rem' }}>
              ({containers.length} total)
            </span>
          </h2>
          <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
            {containers.slice(0, 12).map(c => (
              <InfraContainerCard key={c.id} container={c} />
            ))}
          </div>
        </>
      )}

      {/* Services */}
      {services.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Monitored Services
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {services.slice(0, 8).map(s => (
              <InfraServiceCard key={s.id} service={s} />
            ))}
          </div>
        </>
      )}

      {/* Recent Incidents */}
      {recentIncidents.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.75rem' }}>Recent Incidents</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentIncidents.map(i => (
              <div key={i.id} className="card" style={{ padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <SeverityDot severity={i.severity} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{i.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                    {i.status} &middot; {new Date(i.started_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}


function SummaryCard({ icon, label, value, color, sub, to }) {
  const content = (
    <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', height: '100%' }}>
      <div style={{
        width: '42px', height: '42px', borderRadius: '10px',
        background: `${color}15`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: 'var(--color-overlay-0)', marginTop: '2px' }}>{sub}</div>}
      </div>
    </div>
  )

  if (to) return <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>{content}</Link>
  return content
}


function StatusBadge({ status }) {
  const colors = {
    online: 'var(--color-green)',
    up: 'var(--color-green)',
    running: 'var(--color-green)',
    offline: 'var(--color-red)',
    down: 'var(--color-red)',
    degraded: 'var(--color-yellow)',
    unknown: 'var(--color-overlay-0)',
  }
  const c = colors[status] || colors.unknown

  return (
    <div style={{
      fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.05em', color: c, background: `${c}12`,
      padding: '0.2rem 0.5rem', borderRadius: '4px', flexShrink: 0,
    }}>
      {status}
    </div>
  )
}


function SeverityDot({ severity }) {
  const colors = {
    critical: 'var(--color-red)',
    high: 'var(--color-peach)',
    medium: 'var(--color-yellow)',
    low: 'var(--color-blue)',
  }
  return (
    <div style={{
      width: '8px', height: '8px', borderRadius: '50%',
      background: colors[severity] || 'var(--color-overlay-0)',
      flexShrink: 0,
    }} />
  )
}
