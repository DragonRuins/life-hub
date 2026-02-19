/**
 * LCARSInfraHostDetail.jsx - LCARS-native Infrastructure Host Detail Page
 *
 * Replaces the default InfraHostDetail when LCARS theme is active.
 * LCARS treatment on the header, tabs, hardware readouts, container grid,
 * and service list. Reuses InfraHostForm (shared component) for editing.
 *
 * Route: /infrastructure/hosts/:id
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Edit3, Trash2, X, Cpu, HardDrive, MemoryStick,
  Server, Box, Globe, MapPin, Activity, Play, Square, RotateCw, RefreshCw,
  AlertTriangle, CheckCircle, XCircle,
} from 'lucide-react'
import { infrastructure } from '../../api/client'
import InfraHostForm from '../../components/InfraHostForm'
import LCARSPanel, { LCARSDataRow, LCARSStat } from './LCARSPanel'
import useIsMobile from '../../hooks/useIsMobile'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ── Status color mapping (LCARS canonical) ────────────────────
const STATUS_COLORS = {
  online:     'var(--lcars-green)',
  offline:    'var(--lcars-tomato)',
  degraded:   'var(--lcars-sunflower)',
  unknown:    'var(--lcars-gray)',
  // Container statuses
  running:    'var(--lcars-green)',
  stopped:    'var(--lcars-tomato)',
  exited:     'var(--lcars-tomato)',
  restarting: 'var(--lcars-butterscotch)',
  // Service statuses
  up:         'var(--lcars-green)',
  down:       'var(--lcars-tomato)',
}

// Container status icon mapping
const CONTAINER_ICONS = {
  running:    Play,
  stopped:    Square,
  exited:     Square,
  restarting: RotateCw,
  unknown:    AlertTriangle,
}

// Service status icon mapping
const SERVICE_ICONS = {
  up:       CheckCircle,
  down:     XCircle,
  degraded: AlertTriangle,
  unknown:  Activity,
}

// ── Metric display config (color + friendly label) ──────────
const METRIC_CONFIG = {
  cpu_percent:      { color: 'var(--lcars-ice)',   label: 'Processor Load',  unit: '%' },
  ram_percent:      { color: 'var(--lcars-tanoi)', label: 'Memory Usage',    unit: '%' },
  disk_percent:     { color: 'var(--lcars-green)', label: 'Storage Usage',   unit: '%' },
  ram_used_gb:      { color: 'var(--lcars-tanoi)', label: 'Memory Used',     unit: 'GB' },
  disk_used_gb:     { color: 'var(--lcars-green)', label: 'Storage Used',    unit: 'GB' },
  network_in_mbps:  { color: 'var(--lcars-lilac)', label: 'Network In',      unit: 'Mbps' },
  network_out_mbps: { color: 'var(--lcars-lilac)', label: 'Network Out',     unit: 'Mbps' },
  temperature_c:    { color: 'var(--lcars-tomato)',label: 'Temperature',     unit: '°C' },
  load_1m:          { color: 'var(--lcars-sunflower)', label: 'Load Avg 1m', unit: '' },
}

// Default fallback for unknown metrics
const DEFAULT_METRIC_CONFIG = { color: 'var(--lcars-gray)', label: 'Unknown', unit: '' }

// Time range presets
const TIME_RANGES = [
  { key: '1h',  label: '1H',  hours: 1 },
  { key: '6h',  label: '6H',  hours: 6 },
  { key: '24h', label: '24H', hours: 24 },
  { key: '7d',  label: '7D',  hours: 168 },
  { key: '30d', label: '30D', hours: 720 },
]

export default function LCARSInfraHostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [host, setHost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

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
  const [availableMetrics, setAvailableMetrics] = useState([])

  // ── Data Loading ──────────────────────────────────────────────
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

  // ── Load latest metrics (for gauge bars) when switching to metrics tab ──
  useEffect(() => {
    if (activeTab !== 'metrics') return
    async function loadLatest() {
      try {
        const data = await infrastructure.metrics.latest('host', id)
        setLatestMetrics(data || [])
        // Build list of available metrics from what's returned
        const names = [...new Set((data || []).map(m => m.metric_name))]
        setAvailableMetrics(names)
        // If the currently selected metric isn't available, pick the first one
        if (names.length > 0 && !names.includes(selectedMetric)) {
          setSelectedMetric(names[0])
        }
      } catch (err) {
        console.error('Failed to load latest metrics:', err)
      }
    }
    loadLatest()
  }, [id, activeTab])

  // ── Load time-series chart data when metric or time range changes ──
  useEffect(() => {
    if (activeTab !== 'metrics') return
    async function loadTimeSeries() {
      setMetricsLoading(true)
      try {
        const rangeConf = TIME_RANGES.find(r => r.key === timeRange)
        const now = new Date()
        const from = new Date(now.getTime() - rangeConf.hours * 3600000)
        const data = await infrastructure.metrics.query({
          source_type: 'host',
          source_id: id,
          metric_name: selectedMetric,
          from: from.toISOString(),
          to: now.toISOString(),
          resolution: 'auto',
        })
        // API returns DESC order — reverse for chronological chart display
        setChartData((data || []).slice().reverse())
      } catch (err) {
        console.error('Failed to load metrics time-series:', err)
        setChartData([])
      } finally {
        setMetricsLoading(false)
      }
    }
    loadTimeSeries()
  }, [id, activeTab, timeRange, selectedMetric])

  // ── Handlers ──────────────────────────────────────────────────
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
      setSyncMsg(`SYNCED: ${count} CONTAINER${count !== 1 ? 'S' : ''} FOUND`)
      await loadHost()
      setTimeout(() => setSyncMsg(''), 4000)
    } catch (err) {
      setSyncMsg('SYNC FAILED: ' + err.message)
      setTimeout(() => setSyncMsg(''), 5000)
    } finally {
      setSyncing(false)
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
        setDockerSetupMsg(`DOCKER CONNECTED — ${count} CONTAINER${count !== 1 ? 'S' : ''} FOUND`)
      } else if (result.connection_ok) {
        setDockerSetupMsg('DOCKER CONNECTION ESTABLISHED')
      } else {
        setDockerSetupMsg(`DOCKER CONNECTION FAILED: ${(result.error || 'Unknown error').toUpperCase()}`)
      }
      await loadHost()
      setShowDockerSetup(false)
    } catch (err) {
      setDockerSetupMsg('SETUP FAILED: ' + err.message.toUpperCase())
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
      const fields = [detected.cpu, detected.ram_gb && `${detected.ram_gb} GB RAM`, detected.cpu_cores && `${detected.cpu_cores} CORES`].filter(Boolean)
      setDetectMsg(`DETECTED: ${fields.join(', ') || 'NO NEW HARDWARE DATA'}`)
      await loadHost()
      setTimeout(() => setDetectMsg(''), 5000)
    } catch (err) {
      setDetectMsg('DETECTION FAILED: ' + err.message.toUpperCase())
      setTimeout(() => setDetectMsg(''), 6000)
    } finally {
      setDetectingHw(false)
    }
  }

  if (loading) return <LCARSLoadingSkeleton />
  if (!host) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-tomato)',
          fontSize: '0.9rem',
        }}>
          HOST NOT FOUND IN REGISTRY
        </div>
      </div>
    )
  }

  const hw = host.hardware || {}
  const containers = host.containers || []
  const services = host.services || []
  const statusColor = STATUS_COLORS[host.status] || STATUS_COLORS.unknown

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'containers', label: `Containers (${containers.length})` },
    { key: 'services', label: `Services (${services.length})` },
    { key: 'metrics', label: 'Metrics' },
  ]

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Back link */}
      <button
        onClick={() => navigate('/infrastructure')}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.25rem',
          color: 'var(--lcars-ice)',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.8rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}
      >
        <ArrowLeft size={14} />
        Engineering Status
      </button>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '1rem',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '1.5rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--lcars-space-white)',
          }}>
            {host.name}
          </h1>

          {/* Host info row */}
          <div style={{
            display: 'flex',
            gap: '1.25rem',
            marginTop: '0.375rem',
            flexWrap: 'wrap',
          }}>
            <HostInfoField label="ID" value={String(host.id).padStart(3, '0')} icon={<Server size={11} />} />
            <HostInfoField label="Type" value={host.host_type} />
            {host.ip_address && <HostInfoField label="IP" value={host.ip_address} />}
            <HostInfoField
              label="Status"
              value={host.status}
              valueColor={statusColor}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <button
            onClick={() => setEditing(!editing)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.75rem', borderRadius: '999px',
              border: 'none', cursor: 'pointer',
              background: 'var(--lcars-ice)',
              color: '#000',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.78rem',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              opacity: 0.9, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            {editing ? <X size={14} /> : <Edit3 size={14} />}
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={handleDelete}
            title="Delete host"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.4rem 0.75rem', borderRadius: '999px',
              border: 'none', cursor: 'pointer',
              background: 'var(--lcars-tomato)',
              color: '#000',
              fontFamily: "'Antonio', sans-serif", fontSize: '0.78rem',
              fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              opacity: 0.9, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <LCARSPanel title="Edit Host Configuration" color="var(--lcars-butterscotch)" style={{ marginBottom: '1.5rem' }}>
          <InfraHostForm initial={host} onSubmit={handleUpdate} onCancel={() => setEditing(false)} />
        </LCARSPanel>
      )}

      {/* LCARS Tab Bar */}
      <div style={{
        display: 'flex',
        gap: '3px',
        marginBottom: '1.5rem',
      }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.4rem 1rem',
                border: 'none',
                background: isActive ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)',
                color: isActive ? '#000000' : 'var(--lcars-gray)',
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 400,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(102, 102, 136, 0.4)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)' }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Overview Tab ───────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Docker Setup Prompt — shown when host has no Docker integration */}
          {!host.has_docker_integration && !showDockerSetup && (
            <div style={{
              padding: '0.75rem 1rem',
              borderLeft: '3px solid var(--lcars-ice)',
              background: 'rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              flexWrap: 'wrap',
            }}>
              <div>
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--lcars-ice)',
                }}>
                  No Docker Integration Configured
                </div>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.75rem',
                  color: 'var(--lcars-gray)',
                  marginTop: '0.25rem',
                }}>
                  Set up Docker monitoring to auto-discover containers
                </div>
              </div>
              <button
                onClick={() => setShowDockerSetup(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.4rem 0.75rem', borderRadius: '999px',
                  border: 'none', cursor: 'pointer',
                  background: 'var(--lcars-ice)',
                  color: '#000',
                  fontFamily: "'Antonio', sans-serif", fontSize: '0.78rem',
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                  opacity: 0.9, transition: 'opacity 0.15s',
                  flexShrink: 0,
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
              >
                Set Up Docker
              </button>
            </div>
          )}

          {/* Docker Setup Inline Form */}
          {showDockerSetup && (
            <LCARSPanel title="Docker Integration Setup" color="var(--lcars-ice)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Connection type */}
                <div>
                  <label style={{
                    fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--lcars-gray)',
                    display: 'block',
                    marginBottom: '0.375rem',
                  }}>Connection Type</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {['socket', 'tcp'].map(type => (
                      <button
                        key={type}
                        onClick={() => setDockerConnectionType(type)}
                        style={{
                          padding: '0.3rem 0.75rem',
                          borderRadius: '999px',
                          border: 'none',
                          background: dockerConnectionType === type ? 'var(--lcars-ice)' : 'rgba(102, 102, 136, 0.25)',
                          color: dockerConnectionType === type ? '#000' : 'var(--lcars-gray)',
                          fontFamily: "'Antonio', sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          cursor: 'pointer',
                        }}
                      >
                        {type === 'socket' ? 'Local Socket' : 'Remote TCP'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Path/URL input */}
                <div>
                  <label style={{
                    fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--lcars-gray)',
                    display: 'block',
                    marginBottom: '0.375rem',
                  }}>{dockerConnectionType === 'socket' ? 'Socket Path' : 'TCP URL'}</label>
                  <input
                    value={dockerConnectionType === 'socket' ? dockerSocketPath : dockerTcpUrl}
                    onChange={(e) => dockerConnectionType === 'socket'
                      ? setDockerSocketPath(e.target.value)
                      : setDockerTcpUrl(e.target.value)
                    }
                    placeholder={dockerConnectionType === 'socket' ? '/var/run/docker.sock' : 'tcp://192.168.1.50:2375'}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      background: '#000',
                      border: '1px solid rgba(102, 102, 136, 0.3)',
                      color: 'var(--lcars-space-white)',
                      fontSize: '0.85rem',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </div>

                {/* Collect stats toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={dockerCollectStats}
                    onChange={(e) => setDockerCollectStats(e.target.checked)}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--lcars-ice)' }}
                  />
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.8rem',
                    color: 'var(--lcars-space-white)',
                  }}>
                    Collect resource stats
                  </span>
                </label>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleDockerSetup}
                    disabled={dockerSetupLoading}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.4rem 0.75rem', borderRadius: '999px',
                      border: 'none', cursor: dockerSetupLoading ? 'not-allowed' : 'pointer',
                      background: dockerSetupLoading ? 'rgba(153, 204, 255, 0.4)' : 'var(--lcars-ice)',
                      color: '#000',
                      fontFamily: "'Antonio', sans-serif", fontSize: '0.78rem',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}
                  >
                    {dockerSetupLoading ? 'Connecting...' : 'Connect & Sync'}
                  </button>
                  <button
                    onClick={() => setShowDockerSetup(false)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.4rem 0.75rem', borderRadius: '999px',
                      border: 'none', cursor: 'pointer',
                      background: 'rgba(102, 102, 136, 0.25)',
                      color: 'var(--lcars-gray)',
                      fontFamily: "'Antonio', sans-serif", fontSize: '0.78rem',
                      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </LCARSPanel>
          )}

          {/* Docker Setup Feedback Message */}
          {dockerSetupMsg && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderLeft: `3px solid ${dockerSetupMsg.includes('FAILED') ? 'var(--lcars-sunflower)' : 'var(--lcars-green)'}`,
              background: 'rgba(0, 0, 0, 0.3)',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem',
              color: dockerSetupMsg.includes('FAILED') ? 'var(--lcars-sunflower)' : 'var(--lcars-green)',
            }}>
              {dockerSetupMsg}
            </div>
          )}

          {/* Hardware Specs */}
          <LCARSPanel
            title="Hardware Configuration"
            color="var(--lcars-ice)"
            headerRight={host.host_stats_available ? (
              <button
                onClick={handleDetectHardware}
                disabled={detectingHw}
                style={{
                  padding: '0.2rem 0.625rem',
                  borderRadius: '999px',
                  border: 'none',
                  background: detectingHw ? 'rgba(153, 204, 255, 0.4)' : 'var(--lcars-ice)',
                  color: '#000',
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  cursor: detectingHw ? 'not-allowed' : 'pointer',
                }}
              >
                {detectingHw ? 'Scanning...' : 'Auto-Detect'}
              </button>
            ) : null}
          >
            {detectMsg && (
              <div style={{
                padding: '0.375rem 0.5rem',
                marginBottom: '0.5rem',
                borderLeft: `3px solid ${detectMsg.includes('FAILED') ? 'var(--lcars-sunflower)' : 'var(--lcars-green)'}`,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem',
                color: detectMsg.includes('FAILED') ? 'var(--lcars-sunflower)' : 'var(--lcars-green)',
              }}>
                {detectMsg}
              </div>
            )}
            {Object.keys(hw).length > 0 ? (
              <>
                {hw.cpu && (
                  <LCARSDataRow
                    label="Processor"
                    value={hw.cpu}
                    color="var(--lcars-ice)"
                    icon={<Cpu size={14} />}
                  />
                )}
                {hw.cpu_cores && (
                  <LCARSDataRow
                    label="Cores"
                    value={`${hw.cpu_cores} Physical`}
                    color="var(--lcars-ice)"
                  />
                )}
                {hw.cpu_threads && (
                  <LCARSDataRow
                    label="Threads"
                    value={hw.cpu_threads}
                    color="var(--lcars-ice)"
                  />
                )}
                {hw.ram_gb && (
                  <LCARSDataRow
                    label="Memory"
                    value={`${hw.ram_gb} GB`}
                    color="var(--lcars-tanoi)"
                    icon={<MemoryStick size={14} />}
                  />
                )}
                {hw.disk_gb && (
                  <LCARSDataRow
                    label="Storage"
                    value={`${hw.disk_gb} GB`}
                    color="var(--lcars-green)"
                    icon={<HardDrive size={14} />}
                  />
                )}
                {hw.gpu && (
                  <LCARSDataRow
                    label="Graphics"
                    value={hw.gpu}
                    color="var(--lcars-sunflower)"
                  />
                )}
              </>
            ) : (
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                color: 'var(--lcars-gray)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
              }}>
                {host.host_stats_available
                  ? 'No hardware specifications on file — use Auto-Detect to scan'
                  : 'No hardware specifications on file. Mount /proc and /sys to enable auto-detection.'}
              </div>
            )}
          </LCARSPanel>

          {/* System Info */}
          <LCARSPanel title="System Configuration" color="var(--lcars-tanoi)">
            {host.hostname && (
              <LCARSDataRow label="Hostname" value={host.hostname} color="var(--lcars-tanoi)" />
            )}
            {host.os_name && (
              <LCARSDataRow
                label="Operating System"
                value={`${host.os_name}${host.os_version ? ' ' + host.os_version : ''}`}
                color="var(--lcars-tanoi)"
              />
            )}
            {host.ip_address && (
              <LCARSDataRow label="IP Address" value={host.ip_address} color="var(--lcars-ice)" />
            )}
            {host.mac_address && (
              <LCARSDataRow label="MAC Address" value={host.mac_address} color="var(--lcars-ice)" />
            )}
            {host.location && (
              <LCARSDataRow
                label="Location"
                value={host.location}
                color="var(--lcars-sunflower)"
                icon={<MapPin size={14} />}
              />
            )}
            <LCARSDataRow
              label="Status"
              value={host.status?.toUpperCase()}
              color={statusColor}
            />
            {host.last_seen_at && (
              <LCARSDataRow
                label="Last Contact"
                value={new Date(host.last_seen_at).toLocaleString()}
                color="var(--lcars-gray)"
              />
            )}
          </LCARSPanel>

          {/* Notes */}
          {host.notes && (
            <LCARSPanel title="Notes" color="var(--lcars-gray)">
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
                color: 'var(--lcars-space-white)',
                lineHeight: 1.6,
              }}>
                {host.notes}
              </div>
            </LCARSPanel>
          )}

          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)',
            gap: '0.75rem',
          }}>
            <LCARSPanel title="Containers" color="var(--lcars-green)">
              <LCARSStat
                label="Active"
                value={containers.filter(c => c.status === 'running').length}
                color="var(--lcars-green)"
                icon={<Box size={18} />}
              />
            </LCARSPanel>
            <LCARSPanel title="Services" color="var(--lcars-tanoi)">
              <LCARSStat
                label="Monitored"
                value={services.length}
                color="var(--lcars-tanoi)"
                icon={<Globe size={18} />}
              />
            </LCARSPanel>
            <LCARSPanel title="Health" color={statusColor}>
              <LCARSStat
                label="System Status"
                value={host.status?.toUpperCase()}
                color={statusColor}
                icon={<Activity size={18} />}
              />
            </LCARSPanel>
          </div>
        </div>
      )}

      {/* ── Containers Tab ─────────────────────────────────────────── */}
      {activeTab === 'containers' && (
        <>
          {/* Sync button + result message */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                padding: '0.375rem 1.25rem',
                border: 'none',
                borderRadius: '999px',
                background: syncing ? 'rgba(255, 153, 0, 0.4)' : 'var(--lcars-tanoi)',
                color: '#000',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: syncing ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                transition: 'background 0.15s ease',
                opacity: syncing ? 0.8 : 1,
              }}
            >
              <RefreshCw size={13} style={syncing ? { animation: 'lcars-spin 1s linear infinite' } : {}} />
              {syncing ? 'Syncing...' : 'Sync Containers'}
            </button>
            {syncMsg && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem',
                color: syncMsg.startsWith('SYNC FAILED') ? 'var(--lcars-tomato)' : 'var(--lcars-green)',
              }}>
                {syncMsg}
              </span>
            )}
          </div>

          {containers.length === 0 ? (
            <LCARSPanel title="No Containers" color="var(--lcars-gray)">
              <div style={{
                textAlign: 'center',
                padding: '2rem',
              }}>
                <Box size={28} style={{ color: 'var(--lcars-gray)', marginBottom: '0.5rem' }} />
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.85rem',
                  color: 'var(--lcars-gray)',
                }}>
                  No containers registered on this host
                </div>
              </div>
            </LCARSPanel>
          ) : (
            <LCARSPanel
              title={`Container Registry — ${containers.length} Total`}
              color="var(--lcars-green)"
              headerRight={
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.7rem',
                  color: '#000',
                }}>
                  {containers.filter(c => c.status === 'running').length} running
                </span>
              }
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile
                  ? '1fr'
                  : 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '0.5rem',
              }}>
                {containers.map(c => (
                  <LCARSContainerCard key={c.id} container={c} />
                ))}
              </div>
            </LCARSPanel>
          )}
        </>
      )}

      {/* ── Services Tab ───────────────────────────────────────────── */}
      {activeTab === 'services' && (
        <>
          {services.length === 0 ? (
            <LCARSPanel title="No Services" color="var(--lcars-gray)">
              <div style={{
                textAlign: 'center',
                padding: '2rem',
              }}>
                <Globe size={28} style={{ color: 'var(--lcars-gray)', marginBottom: '0.5rem' }} />
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.85rem',
                  color: 'var(--lcars-gray)',
                }}>
                  No services linked to this host
                </div>
              </div>
            </LCARSPanel>
          ) : (
            <LCARSPanel title="Service Health Monitor" color="var(--lcars-tanoi)">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {services.map(s => (
                  <LCARSServiceRow key={s.id} service={s} />
                ))}
              </div>
            </LCARSPanel>
          )}
        </>
      )}

      {/* ── Metrics Tab ─────────────────────────────────────────── */}
      {activeTab === 'metrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Time Range + Metric Selector pills */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '0.75rem',
            alignItems: isMobile ? 'stretch' : 'center',
          }}>
            {/* Time range pills */}
            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
              {TIME_RANGES.map(tr => {
                const isActive = timeRange === tr.key
                return (
                  <button
                    key={tr.key}
                    onClick={() => setTimeRange(tr.key)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      border: 'none',
                      background: isActive ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)',
                      color: isActive ? '#000000' : 'var(--lcars-gray)',
                      fontFamily: "'Antonio', sans-serif",
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 600 : 400,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tr.label}
                  </button>
                )
              })}
            </div>

            {/* Metric selector pills */}
            <div style={{
              display: 'flex',
              gap: '3px',
              flexWrap: 'wrap',
              borderLeft: isMobile ? 'none' : '1px solid rgba(102, 102, 136, 0.25)',
              paddingLeft: isMobile ? 0 : '0.75rem',
            }}>
              {availableMetrics.map(name => {
                const isActive = selectedMetric === name
                const conf = METRIC_CONFIG[name] || DEFAULT_METRIC_CONFIG
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedMetric(name)}
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: '999px',
                      border: 'none',
                      background: isActive ? conf.color : 'rgba(102, 102, 136, 0.25)',
                      color: isActive ? '#000000' : 'var(--lcars-gray)',
                      fontFamily: "'Antonio', sans-serif",
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 600 : 400,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {conf.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Current Readings — Gauge Bars */}
          <LCARSPanel title="Current Readings" color="var(--lcars-tanoi)">
            {latestMetrics.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '1.5rem',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
                color: 'var(--lcars-gray)',
              }}>
                NO TELEMETRY DATA AVAILABLE
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {latestMetrics.map((m, i) => {
                  const conf = METRIC_CONFIG[m.metric_name] || DEFAULT_METRIC_CONFIG
                  // For percentage-based metrics, cap gauge at 100
                  const isPercent = (m.unit === '%' || conf.unit === '%')
                  const maxVal = isPercent ? 100 : null
                  const fillPct = maxVal ? Math.min((m.value / maxVal) * 100, 100) : 50
                  const displayUnit = m.unit || conf.unit
                  return (
                    <div key={`${m.metric_name}-${i}`}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}>
                        <span style={{
                          fontFamily: "'Antonio', sans-serif",
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: conf.color,
                        }}>
                          {conf.label}
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          color: 'var(--lcars-space-white)',
                        }}>
                          {typeof m.value === 'number' ? m.value.toFixed(1) : m.value}{displayUnit}
                        </span>
                      </div>
                      {/* Gauge bar track */}
                      <div style={{
                        width: '100%',
                        height: '8px',
                        background: 'rgba(102, 102, 136, 0.15)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${fillPct}%`,
                          height: '100%',
                          background: conf.color,
                          borderRadius: '4px',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </LCARSPanel>

          {/* Sensor Telemetry — Time-series Chart */}
          <LCARSPanel title="Sensor Telemetry" color="var(--lcars-ice)">
            {metricsLoading ? (
              <div style={{
                height: isMobile ? '200px' : '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
                color: 'var(--lcars-gray)',
              }}>
                LOADING TELEMETRY...
              </div>
            ) : chartData.length === 0 ? (
              <div style={{
                height: isMobile ? '200px' : '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem',
                color: 'var(--lcars-gray)',
              }}>
                NO TELEMETRY DATA AVAILABLE
              </div>
            ) : (
              <div style={{ background: '#000000', padding: '0.5rem 0' }}>
                <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lcarsAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={(METRIC_CONFIG[selectedMetric] || DEFAULT_METRIC_CONFIG).color}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={(METRIC_CONFIG[selectedMetric] || DEFAULT_METRIC_CONFIG).color}
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(102, 102, 136, 0.15)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="recorded_at"
                      tickFormatter={(val) => {
                        const d = new Date(val)
                        const rangeConf = TIME_RANGES.find(r => r.key === timeRange)
                        // Short ranges (<=24h) show HH:MM, longer ranges show MM/DD
                        if (rangeConf && rangeConf.hours <= 24) {
                          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
                      }}
                      tick={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        fill: 'var(--lcars-gray)',
                      }}
                      axisLine={{ stroke: 'rgba(102, 102, 136, 0.25)' }}
                      tickLine={{ stroke: 'rgba(102, 102, 136, 0.25)' }}
                    />
                    <YAxis
                      tick={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10,
                        fill: 'var(--lcars-gray)',
                      }}
                      axisLine={{ stroke: 'rgba(102, 102, 136, 0.25)' }}
                      tickLine={{ stroke: 'rgba(102, 102, 136, 0.25)' }}
                      width={45}
                    />
                    <Tooltip content={<LCARSChartTooltip metricName={selectedMetric} />} />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={(METRIC_CONFIG[selectedMetric] || DEFAULT_METRIC_CONFIG).color}
                      strokeWidth={2}
                      fill="url(#lcarsAreaFill)"
                      dot={false}
                      activeDot={{
                        r: 4,
                        stroke: (METRIC_CONFIG[selectedMetric] || DEFAULT_METRIC_CONFIG).color,
                        strokeWidth: 2,
                        fill: '#000000',
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </LCARSPanel>
        </div>
      )}

      {/* Spin animation for sync button */}
      <style>{`@keyframes lcars-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


// ── Sub-components ────────────────────────────────────────────────

/**
 * Host info field used in the header (same pattern as VehicleInfoField).
 */
function HostInfoField({ label, value, icon, valueColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
      {icon && <span style={{ color: 'var(--lcars-gray)', display: 'flex' }}>{icon}</span>}
      <span style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--lcars-gray)',
      }}>
        {label}:
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.8rem',
        fontWeight: 600,
        color: valueColor || 'var(--lcars-space-white)',
        textTransform: valueColor ? 'uppercase' : 'none',
      }}>
        {value}
      </span>
    </div>
  )
}


/**
 * LCARS-styled container card for the containers grid.
 * Shows container name, image, status with LCARS color accents.
 */
function LCARSContainerCard({ container }) {
  const statusColor = STATUS_COLORS[container.status] || STATUS_COLORS.unknown
  const StatusIcon = CONTAINER_ICONS[container.status] || CONTAINER_ICONS.unknown

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.625rem',
      padding: '0.625rem 0.75rem',
      background: '#000000',
      border: '1px solid rgba(102, 102, 136, 0.2)',
      borderLeft: `3px solid ${statusColor}`,
    }}>
      {/* Status icon */}
      <div style={{
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <StatusIcon size={14} style={{ color: statusColor }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--lcars-space-white)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {container.name}
        </div>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.65rem',
          color: 'var(--lcars-gray)',
          marginTop: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {container.image?.split(':')[0]?.split('/').pop() || '\u2014'}
          {container.compose_project && (
            <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
              ({container.compose_project})
            </span>
          )}
        </div>
      </div>

      {/* Status badge */}
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.65rem',
        fontWeight: 600,
        color: statusColor,
        textTransform: 'uppercase',
        flexShrink: 0,
      }}>
        {container.status}
      </span>
    </div>
  )
}


/**
 * LCARS-styled service row for the services list.
 * Shows service name, URL, response time, and status.
 */
function LCARSServiceRow({ service }) {
  const statusColor = STATUS_COLORS[service.status] || STATUS_COLORS.unknown
  const StatusIcon = SERVICE_ICONS[service.status] || SERVICE_ICONS.unknown

  return (
    <div style={{
      display: 'flex',
      background: '#000000',
      border: '1px solid rgba(102, 102, 136, 0.3)',
      overflow: 'hidden',
    }}>
      {/* Left accent */}
      <div style={{ width: '4px', background: statusColor, flexShrink: 0 }} />

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.625rem 0.75rem',
      }}>
        {/* Status icon */}
        <StatusIcon size={14} style={{ color: statusColor, flexShrink: 0 }} />

        {/* Name + URL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--lcars-space-white)',
          }}>
            {service.name}
          </div>
          {service.url && (
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem',
              color: 'var(--lcars-ice)',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {service.url}
            </div>
          )}
        </div>

        {/* Response time */}
        {service.last_response_time_ms != null && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            color: 'var(--lcars-gray)',
            flexShrink: 0,
          }}>
            {service.last_response_time_ms}ms
          </span>
        )}

        {/* Status text */}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.7rem',
          fontWeight: 600,
          color: statusColor,
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
          {service.status}
        </span>
      </div>
    </div>
  )
}


/**
 * Custom LCARS-styled tooltip for the metrics AreaChart.
 * Black background with colored left border matching the active metric.
 */
function LCARSChartTooltip({ active, payload, label, metricName }) {
  if (!active || !payload || payload.length === 0) return null
  const conf = METRIC_CONFIG[metricName] || DEFAULT_METRIC_CONFIG
  const d = new Date(label)
  const formattedTime = d.toLocaleString([], {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div style={{
      background: '#000000',
      border: `1px solid ${conf.color}`,
      borderLeft: `3px solid ${conf.color}`,
      padding: '0.5rem 0.75rem',
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.7rem',
        color: 'var(--lcars-gray)',
        marginBottom: '0.25rem',
      }}>
        {formattedTime}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.85rem',
        fontWeight: 600,
        color: conf.color,
      }}>
        {typeof payload[0].value === 'number' ? payload[0].value.toFixed(2) : payload[0].value}
        {conf.unit}
      </div>
    </div>
  )
}


/**
 * Loading skeleton matching the LCARS visual language.
 */
function LCARSLoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '1rem', width: '120px', background: 'rgba(102, 102, 136, 0.15)', marginBottom: '0.5rem' }} />
      <div style={{ height: '1.5rem', width: '350px', background: 'rgba(102, 102, 136, 0.2)', marginBottom: '0.375rem' }} />
      <div style={{ height: '0.8rem', width: '250px', background: 'rgba(102, 102, 136, 0.1)', marginBottom: '1.5rem' }} />
      <div style={{ display: 'flex', gap: '3px', marginBottom: '1.5rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '32px', width: '120px', background: 'rgba(102, 102, 136, 0.15)' }} />
        ))}
      </div>
      <div style={{ height: '200px', background: 'rgba(102, 102, 136, 0.06)', border: '1px solid rgba(102, 102, 136, 0.15)' }} />
    </div>
  )
}
