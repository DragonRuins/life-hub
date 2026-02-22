/**
 * InfraPrinter.jsx - K2 Plus 3D Printer Dashboard (Catppuccin Theme)
 *
 * Full-featured printer dashboard with camera feed, temperature gauges
 * with editable targets, print controls, CFS filament visualization,
 * position telemetry, and SSE-powered real-time updates.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Printer, Thermometer, Clock, CheckCircle,
  XCircle, Lightbulb, Wind, Home as HomeIcon, Pause, Play, Square,
  ChevronDown, Activity, Layers, Box, Droplets, Gauge,
} from 'lucide-react'
import { infrastructure } from '../api/client'
import { formatDate } from '../utils/formatDate'
import useIsMobile from '../hooks/useIsMobile'


// Status badge colors
const STATUS_COLORS = {
  printing: 'var(--color-blue)',
  completed: 'var(--color-green)',
  failed: 'var(--color-red)',
  cancelled: 'var(--color-yellow)',
  paused: 'var(--color-peach)',
  idle: 'var(--color-overlay-0)',
  standby: 'var(--color-overlay-0)',
  ready: 'var(--color-green)',
  operational: 'var(--color-green)',
  offline: 'var(--color-overlay-0)',
  error: 'var(--color-red)',
}


export default function InfraPrinter() {
  const [printers, setPrinters] = useState([])
  const [selectedPrinter, setSelectedPrinter] = useState(null)
  const [k2Data, setK2Data] = useState(null)
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef(null)
  const sseRef = useRef(null)
  const isMobile = useIsMobile()

  async function loadPrinters() {
    try {
      const data = await infrastructure.printer.status()
      setPrinters(data)
      if (data.length > 0 && !selectedPrinter) {
        setSelectedPrinter(data[0].id)
      }
    } catch (err) {
      console.error('Failed to load printers:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadK2Data() {
    if (!selectedPrinter) return
    try {
      const [k2, jobHistory] = await Promise.all([
        infrastructure.printer.k2plus(selectedPrinter),
        infrastructure.printer.jobs(selectedPrinter, { limit: 20 }),
      ])
      setK2Data(k2)
      setJobs(jobHistory)
    } catch (err) {
      console.error('Failed to load K2 Plus data:', err)
    }
  }

  useEffect(() => { loadPrinters() }, [])

  useEffect(() => {
    if (selectedPrinter) loadK2Data()
  }, [selectedPrinter])

  // Fallback poll every 60s
  useEffect(() => {
    if (autoRefresh && selectedPrinter) {
      intervalRef.current = setInterval(loadK2Data, 60000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRefresh, selectedPrinter])

  // SSE: real-time state updates
  useEffect(() => {
    sseRef.current = infrastructure.smarthome.stream.connect(
      (event) => {
        if (event.type !== 'state_changed') return
        // Patch matching entities in k2Data in-place
        setK2Data(prev => {
          if (!prev) return prev
          return patchK2Data(prev, event)
        })
      },
      () => {}
    )
    return () => sseRef.current?.close()
  }, [])

  async function handleControl(deviceId, data) {
    try {
      await infrastructure.smarthome.devices.control(deviceId, data)
      // SSE will update the state; do a refresh as backup
      setTimeout(loadK2Data, 1500)
    } catch (err) {
      alert('Control failed: ' + err.message)
    }
  }

  if (loading) return <p style={{ color: 'var(--color-subtext-0)' }}>Loading printer status...</p>

  if (printers.length === 0) {
    return (
      <div style={{ maxWidth: '1200px' }}>
        <Header printers={printers} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh}
          onRefresh={() => { loadPrinters(); loadK2Data() }} />
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <Printer size={40} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            No 3D printers registered
          </p>
          <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.8rem' }}>
            Register a smart home device with category "printer" in the Smart Home page.
          </p>
        </div>
      </div>
    )
  }

  const temps = k2Data?.temperatures || {}
  const controls = k2Data?.controls || {}
  const filament = k2Data?.filament || {}
  const printStatus = k2Data?.print_status || {}
  const position = k2Data?.position || {}
  const layers = k2Data?.layers || {}
  const camera = k2Data?.camera
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const totalHours = jobs.reduce((sum, j) => sum + (j.duration_seconds || 0), 0) / 3600
  const successRate = jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0

  return (
    <div style={{ maxWidth: '1200px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes live-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes progress-pulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
      `}</style>

      <Header printers={printers} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh}
        onRefresh={() => { loadPrinters(); loadK2Data() }} />

      {/* Printer Selector */}
      {printers.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {printers.map(p => (
            <button key={p.id}
              className={`btn ${selectedPrinter === p.id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSelectedPrinter(p.id)}
            >
              <Printer size={16} /> {p.friendly_name || p.entity_id}
            </button>
          ))}
        </div>
      )}

      {k2Data && (
        <>
          {/* Row 1: Camera + Print Status */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr',
            gap: '1rem', marginBottom: '1rem',
          }}>
            {/* Camera Feed */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
              {camera ? (
                <img
                  src={infrastructure.printer.cameraStreamUrl(camera.id)}
                  alt="Camera Feed"
                  style={{ width: '100%', display: 'block', background: '#000' }}
                />
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '240px', background: 'var(--color-crust)',
                  color: 'var(--color-overlay-0)', fontSize: '0.85rem',
                }}>
                  No camera feed available
                </div>
              )}
            </div>

            {/* Print Status */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <SectionHeader label="Print Status" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                <Printer size={24} style={{ color: STATUS_COLORS[printStatus.status] || 'var(--color-overlay-0)' }} />
                <div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                    {k2Data.device?.friendly_name || 'K2 Plus'}
                  </div>
                  <StatusBadge status={printStatus.status} />
                </div>
              </div>

              {printStatus.filename && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <DataRow label="File" value={printStatus.filename} />
                  <div style={{ marginTop: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                      <span style={{ color: 'var(--color-subtext-0)' }}>Progress</span>
                      <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                        {printStatus.progress?.toFixed(1) || 0}%
                      </span>
                    </div>
                    <ProgressBar percent={printStatus.progress || 0} color="var(--color-blue)" />
                  </div>
                </div>
              )}

              <DataRow label="Speed" value={`${printStatus.speed || 100}%`} />
              <DataRow label="Flow Rate" value={`${printStatus.flow_rate || 100}%`} />
              <DataRow label="Real-time Flow" value={`${printStatus.real_time_flow || 0} mm/s`} />
              {printStatus.time_left > 0 && (
                <DataRow label="Time Left" value={formatDuration(printStatus.time_left * 60)} />
              )}

              {/* Quick Stats */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem', marginTop: '0.75rem',
                padding: '0.5rem', background: 'var(--color-crust)', borderRadius: '6px',
              }}>
                <MiniStat label="Total Prints" value={jobs.length} />
                <MiniStat label="Success" value={`${successRate}%`} color={successRate >= 80 ? 'var(--color-green)' : 'var(--color-yellow)'} />
                <MiniStat label="Completed" value={completedJobs.length} color="var(--color-green)" />
                <MiniStat label="Hours" value={totalHours.toFixed(1)} />
              </div>
            </div>
          </div>

          {/* Row 2: Temperature Gauges */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: '1rem', marginBottom: '1rem',
          }}>
            <TempGauge label="Nozzle" temp={temps.nozzle} color="var(--color-red)"
              targetControl={controls.numbers?.find(n => n.role === 'nozzle_target')}
              onSetTarget={handleControl} unit={k2Data.temp_unit} />
            <TempGauge label="Bed" temp={temps.bed} color="var(--color-peach)"
              targetControl={controls.numbers?.find(n => n.role === 'bed_target')}
              onSetTarget={handleControl} unit={k2Data.temp_unit} />
            <TempGauge label="Chamber" temp={temps.chamber} color="var(--color-blue)"
              targetControl={controls.numbers?.find(n => n.role === 'chamber_target')}
              onSetTarget={handleControl} unit={k2Data.temp_unit} />
          </div>

          {/* Row 3: Controls Bar */}
          <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
            <SectionHeader label="Controls" />
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.5rem',
              alignItems: 'center',
            }}>
              {/* Light toggle */}
              {controls.light && (
                <ControlButton
                  icon={<Lightbulb size={16} />}
                  label="Light"
                  active={controls.light.state === 'on'}
                  onClick={() => handleControl(controls.light.id, { action: 'toggle' })}
                  color="var(--color-yellow)"
                />
              )}

              {/* Fans */}
              {(controls.fans || []).map(fan => (
                <FanControl key={fan.id} fan={fan} onControl={handleControl} />
              ))}

              <div style={{ width: '1px', height: '28px', background: 'var(--color-surface-0)', margin: '0 0.25rem' }} />

              {/* Print control buttons */}
              {(controls.buttons || []).map(btn => {
                const btnConfig = {
                  home: { icon: <HomeIcon size={16} />, color: 'var(--color-blue)', label: 'Home' },
                  pause: { icon: <Pause size={16} />, color: 'var(--color-yellow)', label: 'Pause' },
                  resume: { icon: <Play size={16} />, color: 'var(--color-green)', label: 'Resume' },
                  stop: { icon: <Square size={16} />, color: 'var(--color-red)', label: 'Stop' },
                }[btn.role] || { icon: <Activity size={16} />, color: 'var(--color-blue)', label: btn.role }

                return (
                  <ControlButton key={btn.id}
                    icon={btnConfig.icon} label={btnConfig.label} color={btnConfig.color}
                    onClick={() => handleControl(btn.id, { action: 'press' })}
                    danger={btn.role === 'stop'}
                  />
                )
              })}
            </div>
          </div>

          {/* Row 4: CFS Filament + Position + Layers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: '1rem', marginBottom: '1rem',
          }}>
            {/* CFS Filament */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <SectionHeader label="CFS Filament" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filament.slots?.map(slot => (
                  <FilamentSlot key={slot.slot} slot={slot} />
                ))}
                {filament.external && filament.external.name !== 'Empty' && (
                  <FilamentSlot slot={{ ...filament.external, slot: 'Ext' }} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                {filament.humidity != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Droplets size={12} /> {filament.humidity}%
                  </span>
                )}
                {filament.temp != null && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Thermometer size={12} /> {filament.temp}{k2Data.temp_unit}
                  </span>
                )}
                <span>Status: {filament.status}</span>
              </div>
            </div>

            {/* Position + Flow */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <SectionHeader label="Position & Flow" />
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0.5rem', marginBottom: '0.75rem',
              }}>
                <PositionAxis label="X" value={position.x} color="var(--color-red)" />
                <PositionAxis label="Y" value={position.y} color="var(--color-green)" />
                <PositionAxis label="Z" value={position.z} color="var(--color-blue)" />
              </div>
              <DataRow label="Real-time Flow" value={`${printStatus.real_time_flow || 0} mm/s`} />
              <DataRow label="Material Used" value={`${(layers.material_used || 0).toFixed(1)} g`} />
              {printStatus.current_object && printStatus.current_object !== 'not printing' && (
                <DataRow label="Current Object" value={printStatus.current_object} />
              )}
            </div>

            {/* Layers */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <SectionHeader label="Layer Progress" />
              <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                <div style={{
                  fontSize: '2rem', fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--color-blue)',
                }}>
                  {layers.working || 0}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                  of {layers.total || 0} layers
                </div>
              </div>
              {layers.total > 0 && (
                <ProgressBar percent={(layers.working / layers.total) * 100} color="var(--color-blue)" />
              )}
              <div style={{ marginTop: '0.75rem' }}>
                <DataRow label="Material Used" value={`${(layers.material_used || 0).toFixed(1)} g`} />
                <DataRow label="Objects" value={`${printStatus.object_count || 0}`} />
              </div>
            </div>
          </div>

          {/* Row 5: Job History */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--color-surface-0)',
            }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Print History</h2>
            </div>
            <div style={{ padding: '0.5rem' }}>
              {jobs.length === 0 ? (
                <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>
                  No print jobs recorded yet
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-subtext-0)', fontWeight: 600 }}>File</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-subtext-0)', fontWeight: 600 }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-subtext-0)', fontWeight: 600 }}>Started</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-subtext-0)', fontWeight: 600 }}>Duration</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', color: 'var(--color-subtext-0)', fontWeight: 600 }}>Temps (avg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map(job => (
                        <tr key={job.id} style={{ borderBottom: '1px solid var(--color-surface-0)' }}>
                          <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {job.file_name || '—'}
                          </td>
                          <td style={{ padding: '0.5rem' }}><StatusBadge status={job.status} /></td>
                          <td style={{ padding: '0.5rem', color: 'var(--color-subtext-0)' }}>
                            {job.started_at ? formatDate(job.started_at) : '—'}
                          </td>
                          <td style={{ padding: '0.5rem', fontFamily: "'JetBrains Mono', monospace" }}>
                            {job.duration_seconds ? formatDuration(job.duration_seconds) : '—'}
                          </td>
                          <td style={{ padding: '0.5rem', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace" }}>
                            {[
                              job.nozzle_temp_avg && `N:${job.nozzle_temp_avg.toFixed(0)}°`,
                              job.bed_temp_avg && `B:${job.bed_temp_avg.toFixed(0)}°`,
                              job.chamber_temp_avg && `C:${job.chamber_temp_avg.toFixed(0)}°`,
                            ].filter(Boolean).join(' ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}


// ── Sub-Components ────────────────────────────────────────────────

function Header({ printers, autoRefresh, setAutoRefresh, onRefresh }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link to="/infrastructure" style={{ color: 'var(--color-subtext-0)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>3D Printer</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {printers.length} printer{printers.length !== 1 ? 's' : ''} registered
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {autoRefresh && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
            color: 'var(--color-green)', background: 'rgba(166, 227, 161, 0.1)',
            padding: '0.2rem 0.55rem', borderRadius: '4px',
          }}>
            <span style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--color-green)', animation: 'live-pulse 1.5s ease-in-out infinite',
            }} />
            LIVE
          </span>
        )}
        <button className="btn btn-ghost" onClick={() => setAutoRefresh(prev => !prev)}
          style={autoRefresh ? { background: 'rgba(166, 227, 161, 0.12)', borderColor: 'var(--color-green)' } : {}}>
          <RefreshCw size={16} style={autoRefresh ? { color: 'var(--color-green)', animation: 'spin 2s linear infinite' } : {}} />
          Auto
        </button>
        <button className="btn btn-ghost" onClick={onRefresh}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
    </div>
  )
}


function SectionHeader({ label }) {
  return (
    <h3 style={{
      fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-subtext-0)',
      textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem',
    }}>
      {label}
    </h3>
  )
}


function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || 'var(--color-overlay-0)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
      padding: '0.15rem 0.45rem', borderRadius: '4px',
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      color,
    }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
      {status}
    </span>
  )
}


function DataRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '0.2rem 0', fontSize: '0.8rem',
    }}>
      <span style={{ color: 'var(--color-subtext-0)' }}>{label}</span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>{value}</span>
    </div>
  )
}


function MiniStat({ label, value, color = 'var(--color-text)' }) {
  return (
    <div style={{ textAlign: 'center', padding: '0.25rem' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color }}>
        {value}
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}


function ProgressBar({ percent, color }) {
  return (
    <div style={{
      width: '100%', height: '8px', background: 'var(--color-surface-0)',
      borderRadius: '4px', overflow: 'hidden',
    }}>
      <div style={{
        width: `${Math.min(percent, 100)}%`, height: '100%',
        background: color, borderRadius: '4px',
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}


/** Temperature gauge card with editable target */
function TempGauge({ label, temp, color, targetControl, onSetTarget, unit = '\u00b0C' }) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const current = temp?.current
  const target = temp?.target
  const max = temp?.max || 350
  const ratio = current != null ? (current / max) * 100 : 0

  function handleSubmit(e) {
    e.preventDefault()
    const val = parseFloat(editValue)
    if (targetControl && !isNaN(val)) {
      onSetTarget(targetControl.id, { action: 'set_value', value: val })
    }
    setEditing(false)
  }

  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <Thermometer size={14} style={{ color }} />
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-subtext-0)', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>

      {/* Current temp - large */}
      <div style={{
        fontSize: '1.75rem', fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        color: current != null ? color : 'var(--color-overlay-0)',
        marginBottom: '0.25rem',
      }}>
        {current != null ? `${current.toFixed(1)}${unit}` : '—'}
      </div>

      {/* Target - click to edit */}
      <div style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', marginBottom: '0.5rem' }}>
        Target:{' '}
        {editing ? (
          <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
            <input
              type="number"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              min={targetControl?.min || 0}
              max={targetControl?.max || max}
              step={targetControl?.step || 1}
              autoFocus
              onBlur={() => setEditing(false)}
              style={{
                width: '60px', padding: '0.15rem 0.3rem',
                background: 'var(--color-surface-0)', border: `1px solid ${color}`,
                borderRadius: '4px', color: 'var(--color-text)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
              }}
            />
          </form>
        ) : (
          <span
            onClick={() => { if (targetControl) { setEditValue(target != null ? String(target) : '0'); setEditing(true) }}}
            style={{
              cursor: targetControl ? 'pointer' : 'default',
              fontFamily: "'JetBrains Mono', monospace",
              borderBottom: targetControl ? `1px dashed ${color}` : 'none',
            }}
          >
            {target != null ? `${target}${unit}` : '—'}
          </span>
        )}
        <span style={{ marginLeft: '0.5rem', opacity: 0.5 }}>max {max}{unit}</span>
      </div>

      {/* Bar gauge */}
      <div style={{
        width: '100%', height: '6px', background: 'var(--color-surface-0)',
        borderRadius: '3px', overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(ratio, 100)}%`, height: '100%',
          background: color, borderRadius: '3px', transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}


/** Control button with optional active state */
function ControlButton({ icon, label, active, onClick, color, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.4rem 0.75rem', borderRadius: '6px',
        border: `1px solid ${active ? color : 'var(--color-surface-1)'}`,
        background: active ? `color-mix(in srgb, ${color} 15%, transparent)` : 'transparent',
        color: active ? color : danger ? 'var(--color-red)' : 'var(--color-text)',
        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
    </button>
  )
}


/** Fan control — pill IS the slider. Click toggles 0/100%, drag adjusts percentage. */
function FanControl({ fan, onControl }) {
  const pillRef = useRef(null)
  const startXRef = useRef(0)
  const isDraggingRef = useRef(false)
  const currentPctRef = useRef(fan.percentage || 0)
  const [displayPct, setDisplayPct] = useState(Math.round(fan.percentage || 0))
  const label = fan.role.replace('_fan', '').replace('_', ' ')

  // Keep display in sync with prop when not dragging
  useEffect(() => {
    if (!isDraggingRef.current) setDisplayPct(Math.round(fan.percentage || 0))
  }, [fan.percentage])

  function calcPercent(clientX) {
    const rect = pillRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return Math.round(ratio * 10) * 10 // snap to 10% increments
  }

  function handleStart(clientX) {
    startXRef.current = clientX
    isDraggingRef.current = false
    currentPctRef.current = fan.percentage || 0
  }

  function handleMove(clientX) {
    if (Math.abs(clientX - startXRef.current) > 5) {
      isDraggingRef.current = true
      const pct = calcPercent(clientX)
      currentPctRef.current = pct
      setDisplayPct(pct)
    }
  }

  function handleEnd() {
    if (!isDraggingRef.current) {
      // Single click: toggle 0% / 100%
      const newPct = (fan.percentage || 0) > 0 ? 0 : 100
      setDisplayPct(newPct)
      onControl(fan.id, { action: 'set_percentage', percentage: newPct })
    } else {
      // Drag complete: commit dragged percentage
      onControl(fan.id, { action: 'set_percentage', percentage: currentPctRef.current })
    }
    isDraggingRef.current = false
  }

  // Mouse events
  function onMouseDown(e) {
    e.preventDefault()
    handleStart(e.clientX)
    const onMM = (ev) => handleMove(ev.clientX)
    const onMU = () => { handleEnd(); window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU) }
    window.addEventListener('mousemove', onMM)
    window.addEventListener('mouseup', onMU)
  }

  // Touch events
  function onTouchStart(e) {
    handleStart(e.touches[0].clientX)
  }
  function onTouchMove(e) {
    handleMove(e.touches[0].clientX)
  }
  function onTouchEnd() {
    handleEnd()
  }

  const isOn = displayPct > 0

  return (
    <div
      ref={pillRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        position: 'relative', overflow: 'hidden', userSelect: 'none', touchAction: 'none',
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.4rem 0.75rem', borderRadius: '6px',
        border: `1px solid ${isOn ? 'var(--color-teal)' : 'var(--color-surface-1)'}`,
        background: 'transparent',
        color: isOn ? 'var(--color-teal)' : 'var(--color-text)',
        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
        transition: 'border-color 0.15s, color 0.15s',
        minWidth: '120px',
      }}
    >
      {/* Fill bar showing current percentage */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: `${displayPct}%`,
        background: isOn ? 'color-mix(in srgb, var(--color-teal) 25%, transparent)' : 'transparent',
        transition: isDraggingRef.current ? 'none' : 'width 0.15s ease',
      }} />
      {/* Light text layer (visible over unfilled area) */}
      <span style={{
        position: 'relative', zIndex: 1,
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        color: isOn ? 'var(--color-teal)' : 'var(--color-text)',
      }}>
        <Wind size={16} /> {label} {displayPct}%
      </span>
      {/* Bright text layer (clipped to fill width, visible over filled area) */}
      <span style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
        zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.4rem 0.75rem',
        color: 'var(--color-text)',
        fontWeight: 600,
        clipPath: `inset(0 ${100 - displayPct}% 0 0)`,
        transition: isDraggingRef.current ? 'none' : 'clip-path 0.15s ease',
      }}>
        <Wind size={16} /> {label} {displayPct}%
      </span>
    </div>
  )
}


/** Filament slot card */
function FilamentSlot({ slot }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.4rem 0',
      borderBottom: '1px solid var(--color-surface-0)',
    }}>
      {/* Color swatch */}
      <div style={{
        width: '16px', height: '16px', borderRadius: '4px',
        background: slot.color || '#333', flexShrink: 0,
        border: '1px solid var(--color-surface-1)',
      }} />
      {/* Slot number */}
      <span style={{
        fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-subtext-0)',
        width: '24px', flexShrink: 0,
      }}>
        {typeof slot.slot === 'number' ? `S${slot.slot}` : slot.slot}
      </span>
      {/* Material name */}
      <span style={{ flex: 1, fontSize: '0.8rem', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {slot.name}
      </span>
      {/* Remaining bar */}
      <div style={{ width: '60px', flexShrink: 0 }}>
        <ProgressBar percent={slot.percent || 0} color={slot.color || 'var(--color-blue)'} />
      </div>
      <span style={{
        fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace",
        color: 'var(--color-subtext-0)', width: '32px', textAlign: 'right', flexShrink: 0,
      }}>
        {Math.round(slot.percent || 0)}%
      </span>
    </div>
  )
}


/** Position axis display — converts inches to mm */
function PositionAxis({ label, value, color }) {
  const mm = ((value || 0) * 25.4).toFixed(1)
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.65rem', fontWeight: 600, color, textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        fontSize: '1.1rem', fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {mm}
      </div>
      <div style={{ fontSize: '0.6rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase' }}>
        mm
      </div>
    </div>
  )
}


// ── SSE Patch Helper ──────────────────────────────────────────────

/**
 * Patches k2Data in-place when an SSE state_changed event arrives.
 * Matches entity_id against known roles and updates the corresponding field.
 */
function patchK2Data(prev, event) {
  const { entity_id, state, attributes } = event
  const next = { ...prev }

  // Patch device-level state
  if (prev.device?.entity_id === entity_id) {
    next.device = { ...prev.device, last_state: state, last_attributes: attributes }
  }

  // Patch camera
  if (prev.camera?.entity_id === entity_id) {
    next.camera = { ...prev.camera, state, attributes }
  }

  // Patch controls: light
  if (prev.controls?.light?.entity_id === entity_id) {
    next.controls = { ...prev.controls, light: { ...prev.controls.light, state, attributes } }
  }

  // Patch controls: buttons
  if (prev.controls?.buttons) {
    const idx = prev.controls.buttons.findIndex(b => b.entity_id === entity_id)
    if (idx !== -1) {
      const newBtns = [...prev.controls.buttons]
      newBtns[idx] = { ...newBtns[idx], state }
      next.controls = { ...next.controls, buttons: newBtns }
    }
  }

  // Patch controls: fans
  if (prev.controls?.fans) {
    const idx = prev.controls.fans.findIndex(f => f.entity_id === entity_id)
    if (idx !== -1) {
      const newFans = [...prev.controls.fans]
      newFans[idx] = { ...newFans[idx], state, percentage: attributes?.percentage ?? newFans[idx].percentage }
      next.controls = { ...next.controls, fans: newFans }
    }
  }

  // Patch controls: numbers (temp targets)
  if (prev.controls?.numbers) {
    const idx = prev.controls.numbers.findIndex(n => n.entity_id === entity_id)
    if (idx !== -1) {
      const newNums = [...prev.controls.numbers]
      newNums[idx] = { ...newNums[idx], last_state: state }
      next.controls = { ...next.controls, numbers: newNums }

      // Also patch temperature targets
      const role = newNums[idx].role
      if (role === 'nozzle_target' && next.temperatures?.nozzle) {
        next.temperatures = { ...next.temperatures, nozzle: { ...next.temperatures.nozzle, target: parseFloat(state) || null } }
      } else if (role === 'bed_target' && next.temperatures?.bed) {
        next.temperatures = { ...next.temperatures, bed: { ...next.temperatures.bed, target: parseFloat(state) || null } }
      } else if (role === 'chamber_target' && next.temperatures?.chamber) {
        next.temperatures = { ...next.temperatures, chamber: { ...next.temperatures.chamber, target: parseFloat(state) || null } }
      }
    }
  }

  // Patch temperatures (sensor entities)
  // We need to check entity_id suffix patterns
  if (entity_id.includes('_nozzle_temperature') && next.temperatures?.nozzle) {
    next.temperatures = { ...next.temperatures, nozzle: { ...next.temperatures.nozzle, current: parseFloat(state) || null } }
  } else if (entity_id.includes('_hotbed_temperature') && next.temperatures?.bed) {
    next.temperatures = { ...next.temperatures, bed: { ...next.temperatures.bed, current: parseFloat(state) || null } }
  } else if (entity_id.includes('_chamber_temperature') && next.temperatures?.chamber) {
    next.temperatures = { ...next.temperatures, chamber: { ...next.temperatures.chamber, current: parseFloat(state) || null } }
  }

  // Patch print status sensors
  if (entity_id.includes('_print_status')) {
    next.print_status = { ...next.print_status, status: state }
  } else if (entity_id.includes('_print_progress')) {
    next.print_status = { ...next.print_status, progress: parseFloat(state) || 0 }
  } else if (entity_id.includes('_printing_file_name')) {
    next.print_status = { ...next.print_status, filename: state }
  } else if (entity_id.includes('_remaining_time')) {
    next.print_status = { ...next.print_status, time_left: parseFloat(state) || 0 }
  } else if (entity_id.includes('_print_speed')) {
    next.print_status = { ...next.print_status, speed: parseFloat(state) || 100 }
  } else if (entity_id.includes('_real_time_flow')) {
    next.print_status = { ...next.print_status, real_time_flow: parseFloat(state) || 0 }
  }

  // Patch position
  if (entity_id.includes('_x_axis')) {
    next.position = { ...next.position, x: parseFloat(state) || 0 }
  } else if (entity_id.includes('_y_axis')) {
    next.position = { ...next.position, y: parseFloat(state) || 0 }
  } else if (entity_id.includes('_z_axis')) {
    next.position = { ...next.position, z: parseFloat(state) || 0 }
  }

  // Patch layers
  if (entity_id.includes('_working_layer')) {
    next.layers = { ...next.layers, working: parseFloat(state) || 0 }
  } else if (entity_id.includes('_total_layers')) {
    next.layers = { ...next.layers, total: parseFloat(state) || 0 }
  } else if (entity_id.includes('_material_used')) {
    next.layers = { ...next.layers, material_used: parseFloat(state) || 0 }
  }

  return next
}


/** Format seconds to human-readable duration */
function formatDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}
