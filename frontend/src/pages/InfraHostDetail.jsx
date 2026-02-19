/**
 * InfraHostDetail.jsx - Host Detail Page
 *
 * Shows detailed info about a host:
 *   - Hardware specs
 *   - Containers running on this host
 *   - Services linked to this host
 *   - Edit host info
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Server, Box, Globe, ArrowLeft, Edit3, Trash2, X, Cpu,
  HardDrive, MemoryStick, MapPin, RefreshCw, Activity, Plus,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { infrastructure } from '../api/client'
import InfraHostForm from '../components/InfraHostForm'
import InfraServiceForm from '../components/InfraServiceForm'
import InfraContainerCard from '../components/InfraContainerCard'
import InfraServiceCard from '../components/InfraServiceCard'
import useIsMobile from '../hooks/useIsMobile'

export default function InfraHostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [host, setHost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [showAddService, setShowAddService] = useState(false)

  // Hardware auto-detect state
  const [detectingHw, setDetectingHw] = useState(false)
  const [detectMsg, setDetectMsg] = useState('')

  // Docker setup state (for hosts without Docker integration)
  const [showDockerSetup, setShowDockerSetup] = useState(false)
  const [dockerSetupLoading, setDockerSetupLoading] = useState(false)
  const [dockerSetupMsg, setDockerSetupMsg] = useState('')
  const [dockerConnectionType, setDockerConnectionType] = useState('socket')
  const [dockerSocketPath, setDockerSocketPath] = useState('/var/run/docker.sock')
  const [dockerTcpUrl, setDockerTcpUrl] = useState('')
  const [dockerCollectStats, setDockerCollectStats] = useState(true)

  // Metrics tab state
  const [timeRange, setTimeRange] = useState('24h')
  const [selectedMetric, setSelectedMetric] = useState('cpu_percent')
  const [latestMetrics, setLatestMetrics] = useState([])
  const [chartData, setChartData] = useState([])
  const [metricsLoading, setMetricsLoading] = useState(false)

  async function loadHost() {
    try {
      const data = await infrastructure.hosts.get(id)
      setHost(data)
    } catch (err) {
      console.error('Failed to load host:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadHost() }, [id])

  /**
   * Calculate the ISO 'from' datetime string based on a time range key.
   * Used to scope the metrics query to the selected window.
   */
  function calcFrom(range) {
    const now = new Date()
    const offsets = { '1h': 1, '6h': 6, '24h': 24, '7d': 168, '30d': 720 }
    const hoursAgo = offsets[range] || 24
    return new Date(now.getTime() - hoursAgo * 3600_000).toISOString()
  }

  /** Fetch latest metric snapshot + time-series for the selected metric */
  useEffect(() => {
    if (activeTab !== 'metrics') return
    let cancelled = false

    async function fetchMetrics() {
      setMetricsLoading(true)
      try {
        // Fetch latest gauges and time-series in parallel
        const [latest, series] = await Promise.all([
          infrastructure.metrics.latest('host', id),
          infrastructure.metrics.query({
            source_type: 'host',
            source_id: id,
            metric_name: selectedMetric,
            from: calcFrom(timeRange),
            to: new Date().toISOString(),
            resolution: 'auto',
          }),
        ])
        if (cancelled) return
        setLatestMetrics(latest || [])
        // API returns DESC order — reverse so the chart reads left-to-right
        setChartData((series || []).slice().reverse())
      } catch (err) {
        console.error('Failed to load metrics:', err)
        if (!cancelled) {
          setLatestMetrics([])
          setChartData([])
        }
      } finally {
        if (!cancelled) setMetricsLoading(false)
      }
    }

    fetchMetrics()
    return () => { cancelled = true }
  }, [id, activeTab, timeRange, selectedMetric])

  async function handleUpdate(data) {
    try {
      await infrastructure.hosts.update(id, data)
      await loadHost()
      setEditing(false)
    } catch (err) {
      alert('Failed to update host: ' + err.message)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${host.name}" and all its containers? This cannot be undone.`)) return
    try {
      await infrastructure.hosts.delete(id)
      navigate('/infrastructure')
    } catch (err) {
      alert('Failed to delete host: ' + err.message)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const result = await infrastructure.containers.sync(id)
      const count = result.containers?.length ?? 0
      setSyncMsg(`Synced: ${count} container${count !== 1 ? 's' : ''} found`)
      await loadHost()
      // Clear the message after a few seconds
      setTimeout(() => setSyncMsg(''), 4000)
    } catch (err) {
      setSyncMsg('Sync failed: ' + err.message)
      setTimeout(() => setSyncMsg(''), 5000)
    } finally {
      setSyncing(false)
    }
  }

  async function handleAddService(data) {
    try {
      await infrastructure.services.create({ ...data, host_id: Number(id) })
      await loadHost()
      setShowAddService(false)
    } catch (err) {
      alert('Failed to add service: ' + err.message)
    }
  }

  async function handleDockerSetup() {
    setDockerSetupLoading(true)
    setDockerSetupMsg('')
    try {
      const setupData = {
        connection_type: dockerConnectionType,
        socket_path: dockerConnectionType === 'socket' ? dockerSocketPath : undefined,
        tcp_url: dockerConnectionType === 'tcp' ? dockerTcpUrl : undefined,
        collect_stats: dockerCollectStats,
      }
      const result = await infrastructure.hosts.setupDocker(id, setupData)
      if (result.connection_ok && result.sync_result) {
        const count = result.sync_result.total_containers || result.sync_result.created || 0
        setDockerSetupMsg(`Docker connected — found ${count} container${count !== 1 ? 's' : ''}.`)
      } else if (result.connection_ok) {
        setDockerSetupMsg('Docker connected successfully.')
      } else {
        setDockerSetupMsg(`Docker connection failed: ${result.error || 'Unknown error'}`)
      }
      await loadHost()
      setShowDockerSetup(false)
    } catch (err) {
      setDockerSetupMsg('Setup failed: ' + err.message)
    } finally {
      setDockerSetupLoading(false)
      setTimeout(() => setDockerSetupMsg(''), 6000)
    }
  }

  async function handleDetectHardware() {
    setDetectingHw(true)
    setDetectMsg('')
    try {
      const result = await infrastructure.hosts.detectHardware(id)
      const detected = result.detected || {}
      const fields = [detected.cpu, detected.ram_gb && `${detected.ram_gb} GB RAM`, detected.cpu_cores && `${detected.cpu_cores} cores`].filter(Boolean)
      setDetectMsg(`Detected: ${fields.join(', ') || 'no new hardware info'}`)
      await loadHost()
      setTimeout(() => setDetectMsg(''), 5000)
    } catch (err) {
      setDetectMsg('Detection failed: ' + err.message)
      setTimeout(() => setDetectMsg(''), 6000)
    } finally {
      setDetectingHw(false)
    }
  }

  if (loading) return <p style={{ color: 'var(--color-subtext-0)' }}>Loading host...</p>
  if (!host) return <p style={{ color: 'var(--color-red)' }}>Host not found.</p>

  const hw = host.hardware || {}
  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'containers', label: `Containers (${host.containers?.length || 0})` },
    { key: 'services', label: `Services (${host.services?.length || 0})` },
    { key: 'metrics', label: 'Metrics' },
  ]

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Back + Header */}
      <Link to="/infrastructure" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', color: 'var(--color-subtext-0)', fontSize: '0.85rem', textDecoration: 'none', marginBottom: '1rem' }}>
        <ArrowLeft size={16} /> Back to Infrastructure
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(137, 180, 250, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Server size={22} style={{ color: 'var(--color-blue)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{host.name}</h1>
            <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
              {host.host_type}{host.ip_address ? ` / ${host.ip_address}` : ''}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-ghost" onClick={() => setEditing(!editing)}>
            {editing ? <X size={16} /> : <Edit3 size={16} />}
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={16} /> Delete
          </button>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <InfraHostForm initial={host} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-surface-0)' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '0.625rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.key ? '2px solid var(--color-blue)' : '2px solid transparent',
              color: activeTab === t.key ? 'var(--color-blue)' : 'var(--color-subtext-0)',
              fontWeight: activeTab === t.key ? 600 : 400,
              fontSize: '0.875rem',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div>
          {/* Docker Setup Prompt — shown when host has no Docker integration */}
          {!host.has_docker_integration && !showDockerSetup && (
            <div className="card" style={{
              marginBottom: '1rem',
              padding: '1rem 1.25rem',
              borderLeft: '3px solid var(--color-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Box size={18} style={{ color: 'var(--color-blue)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>No Docker integration configured</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                    Set up Docker monitoring to auto-discover containers on this host.
                  </div>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setShowDockerSetup(true)} style={{ flexShrink: 0 }}>
                Set Up Docker
              </button>
            </div>
          )}

          {/* Docker Setup Inline Form */}
          {showDockerSetup && (
            <div className="card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Set Up Docker Integration</h4>
              <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-subtext-0)', marginBottom: '0.375rem' }}>Connection Type</label>
                  <select
                    value={dockerConnectionType}
                    onChange={(e) => setDockerConnectionType(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem 0.75rem',
                      background: 'var(--color-crust)', border: '1px solid var(--color-surface-0)',
                      borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.875rem', fontFamily: 'inherit',
                    }}
                  >
                    <option value="socket">Local Socket</option>
                    <option value="tcp">Remote TCP</option>
                  </select>
                </div>
                {dockerConnectionType === 'socket' ? (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-subtext-0)', marginBottom: '0.375rem' }}>Socket Path</label>
                    <input
                      value={dockerSocketPath}
                      onChange={(e) => setDockerSocketPath(e.target.value)}
                      placeholder="/var/run/docker.sock"
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem',
                        background: 'var(--color-crust)', border: '1px solid var(--color-surface-0)',
                        borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.875rem', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-subtext-0)', marginBottom: '0.375rem' }}>TCP URL</label>
                    <input
                      value={dockerTcpUrl}
                      onChange={(e) => setDockerTcpUrl(e.target.value)}
                      placeholder="tcp://192.168.1.50:2375"
                      style={{
                        width: '100%', padding: '0.5rem 0.75rem',
                        background: 'var(--color-crust)', border: '1px solid var(--color-surface-0)',
                        borderRadius: '6px', color: 'var(--color-text)', fontSize: '0.875rem', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                )}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={dockerCollectStats}
                  onChange={(e) => setDockerCollectStats(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--color-blue)' }}
                />
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>Collect resource stats</span>
              </label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary" onClick={handleDockerSetup} disabled={dockerSetupLoading}>
                  {dockerSetupLoading ? 'Setting up...' : 'Connect & Sync'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowDockerSetup(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Docker Setup Feedback Message */}
          {dockerSetupMsg && (
            <div className="card" style={{
              marginBottom: '1rem',
              padding: '0.625rem 1rem',
              borderLeft: `3px solid ${dockerSetupMsg.includes('failed') || dockerSetupMsg.includes('Failed') ? 'var(--color-yellow)' : 'var(--color-green)'}`,
              fontSize: '0.85rem',
              color: dockerSetupMsg.includes('failed') || dockerSetupMsg.includes('Failed') ? 'var(--color-yellow)' : 'var(--color-green)',
            }}>
              {dockerSetupMsg}
            </div>
          )}

          {/* Hardware Specs */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Hardware</h3>
              <button
                className="btn btn-ghost"
                onClick={handleDetectHardware}
                disabled={detectingHw}
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.625rem' }}
              >
                <Cpu size={14} />
                {detectingHw ? 'Detecting...' : 'Auto-Detect'}
              </button>
            </div>
            {detectMsg && (
              <p style={{
                fontSize: '0.8rem',
                marginBottom: '0.5rem',
                color: detectMsg.startsWith('Detection failed') ? 'var(--color-red)' : 'var(--color-green)',
              }}>
                {detectMsg}
              </p>
            )}
            <div className="form-grid-2col">
              {hw.cpu && <InfoRow icon={<Cpu size={14} />} label="CPU" value={hw.cpu} />}
              {hw.cpu_cores && <InfoRow label="Cores" value={`${hw.cpu_cores} physical`} />}
              {hw.cpu_threads && <InfoRow label="Threads" value={hw.cpu_threads} />}
              {hw.ram_gb && <InfoRow icon={<MemoryStick size={14} />} label="RAM" value={`${hw.ram_gb} GB`} />}
              {hw.disk_gb && <InfoRow icon={<HardDrive size={14} />} label="Disk" value={`${hw.disk_gb} GB`} />}
              {hw.gpu && <InfoRow label="GPU" value={hw.gpu} />}
            </div>
            {Object.keys(hw).length === 0 && (
              <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
                No hardware specs yet. Click "Auto-Detect" to scan this host.
              </p>
            )}
          </div>

          {/* System Info */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>System Info</h3>
            <div className="form-grid-2col">
              {host.hostname && <InfoRow label="Hostname" value={host.hostname} />}
              {host.os_name && <InfoRow label="OS" value={`${host.os_name} ${host.os_version || ''}`} />}
              {host.mac_address && <InfoRow label="MAC" value={host.mac_address} />}
              {host.location && <InfoRow icon={<MapPin size={14} />} label="Location" value={host.location} />}
              <InfoRow label="Status" value={host.status} />
              {host.last_seen_at && <InfoRow label="Last Seen" value={new Date(host.last_seen_at).toLocaleString()} />}
            </div>
            {host.notes && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--color-crust)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--color-subtext-0)' }}>
                {host.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'containers' && (
        <div>
          {/* Sync button + result message */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <button className="btn" onClick={handleSync} disabled={syncing} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              <RefreshCw size={14} style={syncing ? { animation: 'spin 1s linear infinite' } : {}} />
              {syncing ? 'Syncing...' : 'Sync Containers'}
            </button>
            {syncMsg && (
              <span style={{ fontSize: '0.8rem', color: syncMsg.startsWith('Sync failed') ? 'var(--color-red)' : 'var(--color-green)' }}>
                {syncMsg}
              </span>
            )}
          </div>

          {(host.containers || []).length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <Box size={32} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
                No containers on this host yet.
              </p>
            </div>
          ) : (
            <div className="card-grid">
              {host.containers.map(c => (
                <InfraContainerCard key={c.id} container={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'services' && (
        <div>
          {/* Add Service button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <button className="btn" onClick={() => setShowAddService(!showAddService)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
              {showAddService ? <X size={14} /> : <Plus size={14} />}
              {showAddService ? 'Cancel' : 'Add Service'}
            </button>
          </div>

          {/* Inline add service form */}
          {showAddService && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <InfraServiceForm
                onSubmit={handleAddService}
                onCancel={() => setShowAddService(false)}
              />
            </div>
          )}

          {(host.services || []).length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
              <Globe size={32} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.5rem' }} />
              <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
                No services linked to this host.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {host.services.map(s => (
                <InfraServiceCard key={s.id} service={s} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Metrics Tab ──────────────────────────────────────────── */}
      {activeTab === 'metrics' && (
        <MetricsTabContent
          hostId={id}
          latestMetrics={latestMetrics}
          chartData={chartData}
          metricsLoading={metricsLoading}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          selectedMetric={selectedMetric}
          setSelectedMetric={setSelectedMetric}
          isMobile={isMobile}
        />
      )}

      {/* Spin animation for sync button */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.375rem 0' }}>
      {icon && <span style={{ color: 'var(--color-overlay-0)', flexShrink: 0 }}>{icon}</span>}
      <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', minWidth: '80px' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{value}</span>
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
 * Metrics Tab Content
 *
 * Self-contained section that renders:
 *   1. Latest metric gauges (CPU, RAM, Disk progress bars)
 *   2. Time-range selector (1h / 6h / 24h / 7d / 30d)
 *   3. Metric selector pills
 *   4. Recharts AreaChart for the selected metric over time
 * ────────────────────────────────────────────────────────────── */

/** Map of selectable metric definitions: label, unit, color, icon */
const METRIC_DEFS = {
  cpu_percent:    { label: 'CPU',        unit: '%', color: 'var(--color-blue)',  icon: Cpu },
  ram_percent:    { label: 'RAM',        unit: '%', color: 'var(--color-green)', icon: MemoryStick },
  disk_percent:   { label: 'Disk',       unit: '%', color: 'var(--color-peach)', icon: HardDrive },
  load_1m:        { label: 'Load (1m)',  unit: '',  color: 'var(--color-mauve)', icon: Activity },
  net_in_bytes:   { label: 'Net In',     unit: 'B', color: 'var(--color-teal)',  icon: Activity },
  net_out_bytes:  { label: 'Net Out',    unit: 'B', color: 'var(--color-yellow)', icon: Activity },
}

const TIME_RANGES = ['1h', '6h', '24h', '7d', '30d']

/** Gauge metrics — these get progress-bar style display */
const GAUGE_KEYS = ['cpu_percent', 'ram_percent', 'disk_percent']

/**
 * Format a value for display based on unit type.
 * Large byte values are converted to KB/MB/GB.
 */
function formatValue(val, unit) {
  if (unit === 'B') {
    if (val >= 1e9) return `${(val / 1e9).toFixed(1)} GB`
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)} MB`
    if (val >= 1e3) return `${(val / 1e3).toFixed(1)} KB`
    return `${Math.round(val)} B`
  }
  if (unit === '%') return `${Number(val).toFixed(1)}%`
  return Number(val).toFixed(2)
}

/**
 * Custom Recharts tooltip that matches the Catppuccin dark theme.
 */
function CatppuccinTooltip({ active, payload, label, metricDef, timeRange }) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  const ts = new Date(label)
  // Show full date+time for longer ranges, time-only for short
  const showDate = ['7d', '30d'].includes(timeRange)
  const formatted = showDate
    ? ts.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div style={{
      background: 'var(--color-surface-0)',
      border: '1px solid var(--color-surface-1)',
      borderRadius: '8px',
      padding: '0.5rem 0.75rem',
      fontSize: '0.8rem',
      fontFamily: 'inherit',
    }}>
      <p style={{ color: 'var(--color-subtext-0)', marginBottom: '0.25rem' }}>{formatted}</p>
      <p style={{ color: metricDef.color, fontWeight: 600 }}>
        {metricDef.label}: {formatValue(val, metricDef.unit)}
      </p>
    </div>
  )
}

/**
 * Format XAxis tick labels — time-only for short ranges, date for longer.
 */
function formatXTick(isoStr, timeRange) {
  const d = new Date(isoStr)
  if (['7d', '30d'].includes(timeRange)) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}


function MetricsTabContent({
  hostId, latestMetrics, chartData, metricsLoading,
  timeRange, setTimeRange, selectedMetric, setSelectedMetric,
  isMobile,
}) {
  const metricDef = METRIC_DEFS[selectedMetric] || METRIC_DEFS.cpu_percent

  // Build a lookup of latest values keyed by metric_name
  const latestByName = useMemo(() => {
    const map = {}
    for (const m of latestMetrics) {
      map[m.metric_name] = m
    }
    return map
  }, [latestMetrics])

  // Determine which metric pills to show — always include the predefined ones,
  // plus any extra metrics the API returned that we don't already have a definition for
  const availableMetrics = useMemo(() => {
    const keys = new Set(Object.keys(METRIC_DEFS))
    for (const m of latestMetrics) {
      if (!keys.has(m.metric_name)) keys.add(m.metric_name)
    }
    return [...keys]
  }, [latestMetrics])

  return (
    <div>
      {/* ── Latest Gauges ────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Current Utilization</h3>
        <div className={isMobile ? '' : 'form-grid-3col'} style={isMobile ? { display: 'flex', flexDirection: 'column', gap: '0.75rem' } : { gap: '1rem' }}>
          {GAUGE_KEYS.map(key => {
            const def = METRIC_DEFS[key]
            const latest = latestByName[key]
            const value = latest ? Number(latest.value) : null
            const Icon = def.icon
            return (
              <div key={key} style={{
                background: 'var(--color-crust)',
                borderRadius: '8px',
                padding: '0.75rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Icon size={14} style={{ color: def.color }} />
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>{def.label}</span>
                  </div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: value != null ? 'var(--color-text)' : 'var(--color-subtext-0)' }}>
                    {value != null ? `${value.toFixed(1)}%` : '--'}
                  </span>
                </div>
                {/* Progress bar */}
                <div style={{
                  width: '100%',
                  height: '6px',
                  background: 'var(--color-surface-0)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: value != null ? `${Math.min(value, 100)}%` : '0%',
                    height: '100%',
                    background: def.color,
                    borderRadius: '3px',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                {latest?.recorded_at && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', marginTop: '0.375rem', textAlign: 'right' }}>
                    {new Date(latest.recorded_at).toLocaleTimeString()}
                  </p>
                )}
              </div>
            )
          })}
        </div>
        {latestMetrics.length === 0 && !metricsLoading && (
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
            No recent gauge data available.
          </p>
        )}
      </div>

      {/* ── Time-Series Chart ────────────────────────────────── */}
      <div className="card">
        {/* Controls row: time range + metric selector */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}>
          {/* Time range buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {TIME_RANGES.map(r => (
              <button
                key={r}
                className={r === timeRange ? 'btn btn-primary' : 'btn btn-ghost'}
                onClick={() => setTimeRange(r)}
                style={{ padding: '0.3rem 0.625rem', fontSize: '0.75rem', minWidth: 0 }}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Metric selector pills */}
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {availableMetrics.map(key => {
              const def = METRIC_DEFS[key]
              const label = def ? def.label : key.replace(/_/g, ' ')
              const isActive = key === selectedMetric
              return (
                <button
                  key={key}
                  onClick={() => setSelectedMetric(key)}
                  style={{
                    padding: '0.25rem 0.625rem',
                    fontSize: '0.7rem',
                    borderRadius: '999px',
                    border: isActive ? 'none' : '1px solid var(--color-surface-1)',
                    background: isActive ? (def?.color || 'var(--color-blue)') : 'transparent',
                    color: isActive ? 'var(--color-crust)' : 'var(--color-subtext-0)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: isActive ? 600 : 400,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Chart area */}
        {metricsLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
            Loading metrics...
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <Activity size={32} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.5rem' }} />
            <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
              No metrics data available for this time range.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`metricGrad-${selectedMetric}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricDef.color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={metricDef.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-0)" />
              <XAxis
                dataKey="recorded_at"
                tick={{ fill: 'var(--color-subtext-0)', fontSize: 11 }}
                tickFormatter={(v) => formatXTick(v, timeRange)}
                stroke="var(--color-surface-1)"
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: 'var(--color-subtext-0)', fontSize: 11 }}
                stroke="var(--color-surface-1)"
                tickFormatter={(v) => formatValue(v, metricDef.unit)}
                width={55}
              />
              <Tooltip
                content={<CatppuccinTooltip metricDef={metricDef} timeRange={timeRange} />}
                cursor={{ stroke: 'var(--color-surface-1)', strokeDasharray: '4 4' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={metricDef.color}
                strokeWidth={2}
                fill={`url(#metricGrad-${selectedMetric})`}
                dot={false}
                activeDot={{ r: 4, fill: metricDef.color, stroke: 'var(--color-crust)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
