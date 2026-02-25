/**
 * LCARSInfraPrinter.jsx - K2 Plus Fabrication Console (LCARS Theme)
 *
 * Authentic LCARS-styled printer dashboard with visual telemetry (camera),
 * thermal monitoring, control interface, material system (CFS), positional
 * telemetry, and fabrication log. SSE-powered real-time updates.
 */
import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, Printer, Thermometer, Clock,
  CheckCircle, Lightbulb, Wind, Home as HomeIcon,
  Pause, Play, Square, Activity, Droplets,
} from 'lucide-react'
import { infrastructure } from '../../api/client'
import { formatDate } from '../../utils/formatDate'
import LCARSPanel, { LCARSDataRow, LCARSStat, LCARSGauge } from './LCARSPanel'
import useIsMobile from '../../hooks/useIsMobile'


// LCARS status colors
const STATUS_COLORS = {
  printing: 'var(--lcars-ice)',
  completed: 'var(--lcars-green)',
  failed: 'var(--lcars-tomato)',
  cancelled: 'var(--lcars-sunflower)',
  paused: 'var(--lcars-butterscotch)',
  idle: 'var(--lcars-gray)',
  standby: 'var(--lcars-gray)',
  ready: 'var(--lcars-green)',
  operational: 'var(--lcars-green)',
  offline: 'var(--lcars-gray)',
  error: 'var(--lcars-red-alert)',
}

const STATUS_LABELS = {
  printing: 'IN PROGRESS',
  completed: 'COMPLETE',
  failed: 'FAILED',
  cancelled: 'CANCELLED',
  paused: 'SUSPENDED',
  idle: 'STANDBY',
  standby: 'STANDBY',
  ready: 'OPERATIONAL',
  operational: 'OPERATIONAL',
  offline: 'OFFLINE',
  error: 'MALFUNCTION',
}

// LCARS pill button style generator
const pillStyle = (bg, opts = {}) => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
  padding: '0.4rem 0.75rem', borderRadius: '999px',
  border: 'none', cursor: 'pointer',
  background: bg, color: 'var(--lcars-text-on-color)',
  fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
  opacity: 0.9, transition: 'opacity 0.15s',
  ...opts,
})


export default function LCARSInfraPrinter() {
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
      setTimeout(loadK2Data, 1500)
    } catch (err) {
      alert('Control failed: ' + err.message)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-ice)', fontSize: '0.9rem',
        }}>
          SCANNING FABRICATION SYSTEMS...
        </div>
      </div>
    )
  }

  const printStatus = k2Data?.print_status || {}
  const printerState = printStatus.status || 'offline'
  const stateColor = STATUS_COLORS[printerState] || 'var(--lcars-gray)'
  const stateLabel = STATUS_LABELS[printerState] || printerState.toUpperCase()
  const temps = k2Data?.temperatures || {}
  const controls = k2Data?.controls || {}
  const filament = k2Data?.filament || {}
  const position = k2Data?.position || {}
  const layers = k2Data?.layers || {}
  const camera = k2Data?.camera
  const completedJobs = jobs.filter(j => j.status === 'completed')
  const totalHours = jobs.reduce((sum, j) => sum + (j.duration_seconds || 0), 0) / 3600
  const successRate = jobs.length > 0 ? Math.round((completedJobs.length / jobs.length) * 100) : 0

  return (
    <div style={{ maxWidth: '1200px' }}>
      {autoRefresh && (
        <style>{`
          @keyframes lcars-scan-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/infrastructure" style={{ color: 'var(--lcars-tanoi)', display: 'flex' }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '1.5rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              color: 'var(--lcars-space-white)',
            }}>
              Fabrication Console
            </h1>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.8rem', color: stateColor, marginTop: '0.25rem',
            }}>
              STATUS: {stateLabel}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setAutoRefresh(prev => !prev)}
            style={pillStyle(autoRefresh ? 'var(--lcars-green)' : 'var(--lcars-tanoi)')}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
          >
            <RefreshCw size={14} />
            {autoRefresh ? 'Auto: On' : 'Auto: Off'}
          </button>
        </div>
      </div>

      {/* Printer Selector */}
      {printers.length > 1 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {printers.map(p => (
            <button key={p.id} onClick={() => setSelectedPrinter(p.id)}
              style={pillStyle(selectedPrinter === p.id ? 'var(--lcars-african-violet)' : 'var(--lcars-gray)')}>
              <Printer size={14} /> {(p.friendly_name || p.entity_id).toUpperCase()}
            </button>
          ))}
        </div>
      )}

      {/* No printers */}
      {printers.length === 0 && (
        <LCARSPanel title="Fabrication Unit" color="var(--lcars-gray)">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Printer size={32} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem', color: 'var(--lcars-gray)' }}>
              NO FABRICATION UNITS DETECTED
            </div>
          </div>
        </LCARSPanel>
      )}

      {k2Data && (
        <>
          {/* Row 1: Camera + Fabrication Status */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr',
            gap: '1rem', marginBottom: '1.5rem',
          }}>
            {/* Visual Telemetry */}
            <LCARSPanel title="Visual Telemetry" color="var(--lcars-gold)">
              {camera ? (
                <div style={{ margin: '-0.5rem -0.75rem -0.75rem -0.75rem', overflow: 'hidden' }}>
                  <img
                    src={infrastructure.printer.cameraStreamUrl(camera.id)}
                    alt="Fabrication Feed"
                    style={{ width: '100%', display: 'block', background: '#000' }}
                  />
                </div>
              ) : (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: '200px',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.8rem', color: 'var(--lcars-gray)',
                }}>
                  NO VISUAL FEED AVAILABLE
                </div>
              )}
            </LCARSPanel>

            {/* Fabrication Status */}
            <LCARSPanel title="Fabrication Status" color="var(--lcars-ice)">
              <LCARSDataRow label="Unit" value={(k2Data.device?.friendly_name || 'FABRICATION UNIT').toUpperCase()} color={stateColor} />
              <LCARSDataRow label="Status" value={stateLabel} color={stateColor} />

              {printStatus.filename && (
                <>
                  <LCARSDataRow label="File" value={printStatus.filename.toUpperCase()} color="var(--lcars-ice)" />
                  <div style={{ padding: '0.5rem 0.75rem' }}>
                    <LCARSGauge label="Progress" value={<LCARSRollingText value={`${(printStatus.progress || 0).toFixed(1)}%`} />}
                      percent={printStatus.progress || 0} color="var(--lcars-ice)" />
                  </div>
                </>
              )}

              <LCARSDataRow label="Speed" value={<LCARSRollingText value={`${printStatus.speed || 100}%`} />} color="var(--lcars-tanoi)" />
              <LCARSDataRow label="Flow" value={<LCARSRollingText value={`${printStatus.flow_rate || 100}%`} />} color="var(--lcars-tanoi)" />
              {printStatus.time_left > 0 && (
                <LCARSDataRow label="ETA" value={<LCARSRollingText value={formatDuration(printStatus.time_left * 60)} />} color="var(--lcars-sunflower)" />
              )}

              {/* Stats */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem', padding: '0.5rem 0', marginTop: '0.25rem',
              }}>
                <LCARSStat label="Total Jobs" value={jobs.length} color="var(--lcars-ice)" icon={<Printer size={16} />} />
                <LCARSStat label="Success" value={`${successRate}%`}
                  color={successRate >= 80 ? 'var(--lcars-green)' : 'var(--lcars-sunflower)'}
                  icon={<CheckCircle size={16} />} />
                <LCARSStat label="Completed" value={completedJobs.length} color="var(--lcars-green)" icon={<CheckCircle size={16} />} />
                <LCARSStat label="Hours" value={totalHours.toFixed(1)} color="var(--lcars-tanoi)" icon={<Clock size={16} />} />
              </div>
            </LCARSPanel>
          </div>

          {/* Row 2: Thermal Monitoring */}
          <LCARSPanel title="Thermal Monitoring" color="var(--lcars-butterscotch)" style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
              gap: '0.75rem',
            }}>
              <LCARSTempGauge label="Nozzle" temp={temps.nozzle} color="var(--lcars-tomato)"
                targetControl={controls.numbers?.find(n => n.role === 'nozzle_target')}
                onSetTarget={handleControl} unit={k2Data.temp_unit} />
              <LCARSTempGauge label="Hot Bed" temp={temps.bed} color="var(--lcars-butterscotch)"
                targetControl={controls.numbers?.find(n => n.role === 'bed_target')}
                onSetTarget={handleControl} unit={k2Data.temp_unit} />
              <LCARSTempGauge label="Chamber" temp={temps.chamber} color="var(--lcars-ice)"
                targetControl={controls.numbers?.find(n => n.role === 'chamber_target')}
                onSetTarget={handleControl} unit={k2Data.temp_unit} />
            </div>
          </LCARSPanel>

          {/* Row 3: Control Interface */}
          <LCARSPanel title="Control Interface" color="var(--lcars-tanoi)" style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.25rem 0',
              alignItems: 'center',
            }}>
              {/* Light */}
              {controls.light && (
                <button onClick={() => handleControl(controls.light.id, { action: 'toggle' })}
                  style={pillStyle(controls.light.state === 'on' ? 'var(--lcars-gold)' : 'var(--lcars-gray)')}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
                >
                  <Lightbulb size={14} /> Light: {controls.light.state === 'on' ? 'On' : 'Off'}
                </button>
              )}

              {/* Fans */}
              {(controls.fans || []).map(fan => (
                <LCARSFanControl key={fan.id} fan={fan} onControl={handleControl} />
              ))}

              {/* Separator */}
              <div style={{ width: '2px', height: '24px', background: 'var(--lcars-tanoi)', opacity: 0.3, margin: '0 0.25rem' }} />

              {/* Print buttons */}
              {(controls.buttons || []).map(btn => {
                const cfg = {
                  home: { bg: 'var(--lcars-tanoi)', icon: <HomeIcon size={14} />, label: 'Home' },
                  pause: { bg: 'var(--lcars-sunflower)', icon: <Pause size={14} />, label: 'Pause' },
                  resume: { bg: 'var(--lcars-green)', icon: <Play size={14} />, label: 'Resume' },
                  stop: { bg: 'var(--lcars-tomato)', icon: <Square size={14} />, label: 'Stop' },
                }[btn.role] || { bg: 'var(--lcars-gray)', icon: <Activity size={14} />, label: btn.role }

                return (
                  <button key={btn.id}
                    onClick={() => handleControl(btn.id, { action: 'press' })}
                    style={pillStyle(cfg.bg)}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0.9'}
                  >
                    {cfg.icon} {cfg.label}
                  </button>
                )
              })}
            </div>
          </LCARSPanel>

          {/* Row 4: Material System + Positional Telemetry + Layer Progress */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: '1rem', marginBottom: '1.5rem',
          }}>
            {/* Material System */}
            <LCARSPanel title="Material System" color="var(--lcars-lilac)">
              {filament.slots?.map(slot => (
                <LCARSFilamentSlot key={slot.slot} slot={slot} />
              ))}
              {filament.external && filament.external.name !== 'Empty' && (
                <LCARSFilamentSlot slot={{ ...filament.external, slot: 'EXT' }} />
              )}
              <div style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: '1rem' }}>
                {filament.humidity != null && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                    color: 'var(--lcars-gray)', display: 'flex', alignItems: 'center', gap: '0.25rem',
                  }}>
                    <Droplets size={11} /> {filament.humidity}%
                  </span>
                )}
                {filament.temp != null && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                    color: 'var(--lcars-gray)', display: 'flex', alignItems: 'center', gap: '0.25rem',
                  }}>
                    <Thermometer size={11} /> {filament.temp}{k2Data.temp_unit}
                  </span>
                )}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                  color: 'var(--lcars-gray)',
                }}>
                  {filament.status}
                </span>
              </div>
            </LCARSPanel>

            {/* Positional Telemetry */}
            <LCARSPanel title="Positional Telemetry" color="var(--lcars-african-violet)">
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: '0.5rem', padding: '0.5rem 0.75rem',
              }}>
                <LCARSPositionAxis label="X" value={position.x} color="var(--lcars-tomato)" />
                <LCARSPositionAxis label="Y" value={position.y} color="var(--lcars-green)" />
                <LCARSPositionAxis label="Z" value={position.z} color="var(--lcars-ice)" />
              </div>
              <LCARSDataRow label="Real-time Flow" value={<LCARSRollingText value={`${printStatus.real_time_flow || 0} MM/S`} />} color="var(--lcars-tanoi)" />
              <LCARSDataRow label="Material Used" value={<LCARSRollingText value={`${(layers.material_used || 0).toFixed(1)} G`} />} color="var(--lcars-tanoi)" />
              {printStatus.current_object && printStatus.current_object !== 'not printing' && (
                <LCARSDataRow label="Object" value={printStatus.current_object.toUpperCase()} color="var(--lcars-ice)" />
              )}
              <LCARSDataRow label="Object Count" value={<LCARSRollingText value={`${printStatus.object_count || 0}`} />} color="var(--lcars-gray)" />
            </LCARSPanel>

            {/* Layer Progress */}
            <LCARSPanel title="Layer Analysis" color="var(--lcars-ice)">
              <div style={{ textAlign: 'center', padding: '0.75rem 0 0.5rem' }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '2.5rem', fontWeight: 700,
                  color: 'var(--lcars-ice)',
                  lineHeight: 1,
                }}>
                  <LCARSRollingText value={`${layers.working || 0}`} />
                </div>
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.75rem', color: 'var(--lcars-gray)',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginTop: '0.25rem',
                }}>
                  of <LCARSRollingText value={`${layers.total || 0}`} /> Layers
                </div>
              </div>
              {layers.total > 0 && (
                <div style={{ padding: '0 0.75rem 0.5rem' }}>
                  <LCARSGauge label="Layer Progress" value={<LCARSRollingText value={`${((layers.working / layers.total) * 100).toFixed(1)}%`} />}
                    percent={(layers.working / layers.total) * 100} color="var(--lcars-ice)" />
                </div>
              )}
              <LCARSDataRow label="Material" value={<LCARSRollingText value={`${(layers.material_used || 0).toFixed(1)} G`} />} color="var(--lcars-tanoi)" />
            </LCARSPanel>
          </div>

          {/* Fabrication Log */}
          <LCARSPanel title="Fabrication Log" color="var(--lcars-african-violet)" style={{ marginBottom: '1.5rem' }}>
            {jobs.length === 0 ? (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8rem',
                color: 'var(--lcars-gray)', padding: '1rem', textAlign: 'center',
              }}>
                NO FABRICATION RECORDS
              </div>
            ) : (
              jobs.map(job => {
                const jobColor = STATUS_COLORS[job.status] || 'var(--lcars-gray)'
                const jobLabel = STATUS_LABELS[job.status] || job.status.toUpperCase()
                return (
                  <div key={job.id} style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
                  }}>
                    <div style={{ width: '4px', height: '28px', background: jobColor, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: 'var(--lcars-space-white)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {(job.file_name || 'Unknown').toUpperCase()}
                      </div>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
                        color: 'var(--lcars-gray)', marginTop: '0.1rem',
                      }}>
                        {job.started_at ? formatDate(job.started_at) : '—'}
                        {job.duration_seconds ? ` / ${formatDuration(job.duration_seconds)}` : ''}
                      </div>
                    </div>
                    <span style={{
                      fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      padding: '0.15rem 0.45rem', borderRadius: '999px',
                      background: jobColor, color: 'var(--lcars-text-on-color)', fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {jobLabel}
                    </span>
                    <div style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem',
                      color: 'var(--lcars-gray)', flexShrink: 0, whiteSpace: 'nowrap',
                    }}>
                      {[
                        job.nozzle_temp_avg && `N:${job.nozzle_temp_avg.toFixed(0)}`,
                        job.bed_temp_avg && `B:${job.bed_temp_avg.toFixed(0)}`,
                      ].filter(Boolean).join(' ') || ''}
                    </div>
                  </div>
                )
              })
            )}
          </LCARSPanel>
        </>
      )}
    </div>
  )
}


// ── LCARS Sub-Components ─────────────────────────────────────────

/** LCARS temperature gauge with large readout and editable target */
function LCARSTempGauge({ label, temp, color, targetControl, onSetTarget, unit = '\u00b0C' }) {
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
    <div style={{ padding: '0.5rem 0' }}>
      {/* Label */}
      <div style={{
        fontFamily: "'Antonio', sans-serif", fontSize: '0.75rem',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--lcars-gray)', marginBottom: '0.25rem', paddingLeft: '0.75rem',
      }}>
        {label}
      </div>

      {/* Current temp - large */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: '0.25rem',
        paddingLeft: '0.75rem', marginBottom: '0.25rem',
      }}>
        <div style={{ width: '4px', height: '32px', background: color, flexShrink: 0, alignSelf: 'center' }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '1.75rem', fontWeight: 700,
          color: current != null ? color : 'var(--lcars-gray)',
          marginLeft: '0.5rem',
        }}>
          {current != null ? <LCARSRollingText value={current.toFixed(1)} /> : '—'}
        </span>
        <span style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.9rem', color: 'var(--lcars-gray)',
        }}>
          {unit}
        </span>
      </div>

      {/* Target */}
      <div style={{
        paddingLeft: '0.75rem', fontSize: '0.7rem',
        fontFamily: "'JetBrains Mono', monospace", color: 'var(--lcars-gray)',
        marginBottom: '0.35rem',
      }}>
        TARGET:{' '}
        {editing ? (
          <form onSubmit={handleSubmit} style={{ display: 'inline' }}>
            <input type="number" value={editValue}
              onChange={e => setEditValue(e.target.value)}
              min={targetControl?.min || 0} max={targetControl?.max || max}
              step={targetControl?.step || 1}
              autoFocus onBlur={() => setEditing(false)}
              style={{
                width: '55px', padding: '0.1rem 0.25rem',
                background: '#000', border: `1px solid ${color}`,
                borderRadius: 0, color: 'var(--lcars-space-white)',
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
              }}
            />
          </form>
        ) : (
          <span
            onClick={() => { if (targetControl) { setEditValue(target != null ? String(target) : '0'); setEditing(true) }}}
            style={{
              cursor: targetControl ? 'pointer' : 'default',
              color: target && target > 0 ? color : 'var(--lcars-gray)',
              borderBottom: targetControl ? `1px dashed ${color}` : 'none',
            }}
          >
            {target != null ? <LCARSRollingText value={`${target}`} /> : '—'}
          </span>
        )}
        <span style={{ opacity: 0.5, marginLeft: '0.5rem' }}>MAX {max}</span>
      </div>

      {/* Gauge bar */}
      <div style={{ padding: '0 0.75rem' }}>
        <div style={{
          width: '100%', height: '4px', background: 'rgba(102, 102, 136, 0.2)',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${Math.min(ratio, 100)}%`, height: '100%',
            background: color, transition: 'width 0.5s ease',
          }} />
        </div>
      </div>
    </div>
  )
}


/** LCARS fan control — pill IS the slider. Click toggles 0/100%, drag adjusts percentage. */
function LCARSFanControl({ fan, onControl }) {
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
  const bgColor = isOn ? 'var(--lcars-ice)' : 'var(--lcars-gray)'

  return (
    <div
      ref={pillRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{
        ...pillStyle('transparent', { position: 'relative', overflow: 'hidden', userSelect: 'none', touchAction: 'none' }),
        border: `2px solid ${bgColor}`,
        minWidth: '120px',
      }}
    >
      {/* Fill bar showing current percentage */}
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: `${displayPct}%`,
        background: bgColor,
        transition: isDraggingRef.current ? 'none' : 'width 0.15s ease',
      }} />
      {/* Light text layer (visible over unfilled area) */}
      <span style={{
        position: 'relative', zIndex: 1,
        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        color: 'var(--lcars-space-white)',
      }}>
        <Wind size={14} /> {label} {displayPct}%
      </span>
      {/* Dark text layer (clipped to fill width, visible over filled area) */}
      <span style={{
        position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
        zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.4rem 0.75rem',
        color: 'var(--lcars-text-on-color)',
        clipPath: `inset(0 ${100 - displayPct}% 0 0)`,
        transition: isDraggingRef.current ? 'none' : 'clip-path 0.15s ease',
      }}>
        <Wind size={14} /> {label} {displayPct}%
      </span>
    </div>
  )
}


/** LCARS filament slot row */
function LCARSFilamentSlot({ slot }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.4rem 0.75rem',
      borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
    }}>
      {/* Color swatch */}
      <div style={{
        width: '14px', height: '14px',
        background: slot.color || '#333', flexShrink: 0,
      }} />
      {/* Slot */}
      <span style={{
        fontFamily: "'Antonio', sans-serif", fontSize: '0.7rem',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'var(--lcars-gray)', width: '28px', flexShrink: 0,
      }}>
        {typeof slot.slot === 'number' ? `S${slot.slot}` : slot.slot}
      </span>
      {/* Name */}
      <span style={{
        flex: 1, minWidth: 0,
        fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
        textTransform: 'uppercase', letterSpacing: '0.03em',
        color: 'var(--lcars-space-white)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {slot.name}
      </span>
      {/* Gauge bar */}
      <div style={{ width: '50px', height: '4px', background: 'rgba(102, 102, 136, 0.2)', flexShrink: 0 }}>
        <div style={{
          width: `${Math.min(slot.percent || 0, 100)}%`, height: '100%',
          background: slot.color || 'var(--lcars-lilac)',
        }} />
      </div>
      {/* Percentage */}
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem',
        color: 'var(--lcars-gray)', width: '28px', textAlign: 'right', flexShrink: 0,
      }}>
        <LCARSRollingText value={`${Math.round(slot.percent || 0)}%`} />
      </span>
    </div>
  )
}


/** LCARS position axis with accent block — converts inches to mm */
function LCARSPositionAxis({ label, value, color }) {
  const mm = ((value || 0) * 25.4).toFixed(1)
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: '4px', height: '4px', background: color,
        margin: '0 auto 0.25rem',
      }} />
      <div style={{
        fontFamily: "'Antonio', sans-serif", fontSize: '0.65rem',
        textTransform: 'uppercase', letterSpacing: '0.08em', color,
      }}>
        {label}-AXIS
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '1.5rem', fontWeight: 700,
        color: 'var(--lcars-space-white)',
        lineHeight: 1.1,
      }}>
        <LCARSRollingText value={mm} />
      </div>
      <div style={{
        fontFamily: "'Antonio', sans-serif", fontSize: '0.55rem',
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--lcars-gray)', marginTop: '0.1rem',
      }}>
        MM
      </div>
    </div>
  )
}


// ── SSE Patch Helper ─────────────────────────────────────────────
// Reused from InfraPrinter.jsx — patches k2Data based on SSE events

function patchK2Data(prev, event) {
  const { entity_id, state, attributes } = event
  const next = { ...prev }

  if (prev.device?.entity_id === entity_id) {
    next.device = { ...prev.device, last_state: state, last_attributes: attributes }
  }
  if (prev.camera?.entity_id === entity_id) {
    next.camera = { ...prev.camera, state, attributes }
  }
  if (prev.controls?.light?.entity_id === entity_id) {
    next.controls = { ...prev.controls, light: { ...prev.controls.light, state, attributes } }
  }
  if (prev.controls?.buttons) {
    const idx = prev.controls.buttons.findIndex(b => b.entity_id === entity_id)
    if (idx !== -1) {
      const a = [...prev.controls.buttons]; a[idx] = { ...a[idx], state }
      next.controls = { ...next.controls, buttons: a }
    }
  }
  if (prev.controls?.fans) {
    const idx = prev.controls.fans.findIndex(f => f.entity_id === entity_id)
    if (idx !== -1) {
      const a = [...prev.controls.fans]
      a[idx] = { ...a[idx], state, percentage: attributes?.percentage ?? a[idx].percentage }
      next.controls = { ...next.controls, fans: a }
    }
  }
  if (prev.controls?.numbers) {
    const idx = prev.controls.numbers.findIndex(n => n.entity_id === entity_id)
    if (idx !== -1) {
      const a = [...prev.controls.numbers]; a[idx] = { ...a[idx], last_state: state }
      next.controls = { ...next.controls, numbers: a }
      const role = a[idx].role
      const tv = parseFloat(state) || null
      if (role === 'nozzle_target' && next.temperatures?.nozzle) next.temperatures = { ...next.temperatures, nozzle: { ...next.temperatures.nozzle, target: tv } }
      else if (role === 'bed_target' && next.temperatures?.bed) next.temperatures = { ...next.temperatures, bed: { ...next.temperatures.bed, target: tv } }
      else if (role === 'chamber_target' && next.temperatures?.chamber) next.temperatures = { ...next.temperatures, chamber: { ...next.temperatures.chamber, target: tv } }
    }
  }

  // Temperature sensors
  if (entity_id.includes('_nozzle_temperature') && next.temperatures?.nozzle) next.temperatures = { ...next.temperatures, nozzle: { ...next.temperatures.nozzle, current: parseFloat(state) || null } }
  else if (entity_id.includes('_hotbed_temperature') && next.temperatures?.bed) next.temperatures = { ...next.temperatures, bed: { ...next.temperatures.bed, current: parseFloat(state) || null } }
  else if (entity_id.includes('_chamber_temperature') && next.temperatures?.chamber) next.temperatures = { ...next.temperatures, chamber: { ...next.temperatures.chamber, current: parseFloat(state) || null } }

  // Print status
  if (entity_id.includes('_print_status')) next.print_status = { ...next.print_status, status: state }
  else if (entity_id.includes('_print_progress')) next.print_status = { ...next.print_status, progress: parseFloat(state) || 0 }
  else if (entity_id.includes('_printing_file_name')) next.print_status = { ...next.print_status, filename: state }
  else if (entity_id.includes('_remaining_time')) next.print_status = { ...next.print_status, time_left: parseFloat(state) || 0 }
  else if (entity_id.includes('_print_speed')) next.print_status = { ...next.print_status, speed: parseFloat(state) || 100 }
  else if (entity_id.includes('_real_time_flow')) next.print_status = { ...next.print_status, real_time_flow: parseFloat(state) || 0 }

  // Position
  if (entity_id.includes('_x_axis')) next.position = { ...next.position, x: parseFloat(state) || 0 }
  else if (entity_id.includes('_y_axis')) next.position = { ...next.position, y: parseFloat(state) || 0 }
  else if (entity_id.includes('_z_axis')) next.position = { ...next.position, z: parseFloat(state) || 0 }

  // Layers
  if (entity_id.includes('_working_layer')) next.layers = { ...next.layers, working: parseFloat(state) || 0 }
  else if (entity_id.includes('_total_layers')) next.layers = { ...next.layers, total: parseFloat(state) || 0 }
  else if (entity_id.includes('_material_used')) next.layers = { ...next.layers, material_used: parseFloat(state) || 0 }

  return next
}


/** Rolling digit animation for numeric values — reuses lcars-digit-roll from lcars-animations.css */
function LCARSRollingText({ value, style }) {
  const text = String(value ?? '')
  const prevRef = useRef(text)
  const [changed, setChanged] = useState(new Set())

  useEffect(() => {
    const prev = prevRef.current
    const next = text
    const diff = new Set()
    const len = Math.max(prev.length, next.length)
    for (let i = 0; i < len; i++) {
      if (prev[i] !== next[i]) diff.add(i)
    }
    if (diff.size > 0) setChanged(diff)
    prevRef.current = next
  }, [text])

  useEffect(() => {
    if (changed.size === 0) return
    const t = setTimeout(() => setChanged(new Set()), 250)
    return () => clearTimeout(t)
  }, [changed])

  return (
    <span style={{ ...style, display: 'inline-flex' }}>
      {text.split('').map((ch, i) => (
        <span key={`${i}-${ch}`}
          className={changed.has(i) ? 'lcars-digit-roll' : undefined}
          style={{ display: 'inline-block' }}>
          {ch}
        </span>
      ))}
    </span>
  )
}


function formatDuration(seconds) {
  if (!seconds) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}H ${m}M`
  return `${m}M`
}
