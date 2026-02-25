/**
 * LCARSVehicleDetail.jsx - LCARS-native Vehicle Detail Page
 *
 * Replaces the default VehicleDetail when LCARS theme is active.
 * LCARS treatment on the header, tabs, maintenance/fuel log cards,
 * and modal overlays. Reuses existing child components (LCARSComponentCard,
 * LCARSTireSetCard, ServiceIntervalsTab, forms) which get LCARS styling
 * via CSS overrides.
 *
 * Route: /vehicles/:id
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Wrench, Trash2, X, Box, Archive, Fuel, Settings, Gauge, Calendar, Hash, Car, AlertTriangle } from 'lucide-react'
import { vehicles } from '../../api/client'
import ComponentForm from '../../components/ComponentForm'
import ComponentLogForm from '../../components/ComponentLogForm'
import MaintenanceForm from '../../components/MaintenanceForm'
import LCARSServiceIntervalsTab from './LCARSServiceIntervalsTab'
import TireSetForm from '../../components/TireSetForm'
import FuelForm from '../../components/FuelForm'
import { formatDate } from '../../utils/formatDate'
import { getComponentType } from '../../constants/componentTypes'
import LCARSPanel, { LCARSDataRow, LCARSStat } from './LCARSPanel'
import LCARSComponentCard from './LCARSComponentCard'
import LCARSTireSetCard from './LCARSTireSetCard'

export default function LCARSVehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [vehicle, setVehicle] = useState(null)
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)

  const activeComponents = components.filter(c => c.is_active)

  const [activeTab, setActiveTab] = useState('components')
  const [showArchived, setShowArchived] = useState(false)
  const [showComponentForm, setShowComponentForm] = useState(false)
  const [selectedComponent, setSelectedComponent] = useState(null)
  const [selectedComponentForLogs, setSelectedComponentForLogs] = useState(null)
  const [tireSets, setTireSets] = useState([])
  const [showTireSetForm, setShowTireSetForm] = useState(false)
  const [editingTireSet, setEditingTireSet] = useState(null)
  const [fuelLogs, setFuelLogs] = useState([])
  const [showFuelForm, setShowFuelForm] = useState(false)
  const [editingFuelLog, setEditingFuelLog] = useState(null)
  const [maintenanceItems, setMaintenanceItems] = useState([])
  const [intervalsRefreshKey, setIntervalsRefreshKey] = useState(0)
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // ── Data Loading ──────────────────────────────────────────────
  async function loadVehicle() {
    try {
      const data = await vehicles.get(id)
      setVehicle(data)
      setComponents(data.components || [])
    } catch (err) {
      console.error('Failed to load vehicle:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadComponents() {
    try {
      const data = await vehicles.components.list(id)
      setComponents(data)
    } catch (err) {
      console.error('Failed to load components:', err)
    }
  }

  async function loadTireSets() {
    try { setTireSets(await vehicles.tireSets.list(id)) }
    catch (err) { console.error('Failed to load tire sets:', err) }
  }

  async function loadFuelLogs() {
    try { setFuelLogs(await vehicles.fuelLogs.list(id)) }
    catch (err) { console.error('Failed to load fuel logs:', err) }
  }

  async function loadMaintenanceItems() {
    try { setMaintenanceItems(await vehicles.maintenanceItems.list()) }
    catch (err) { console.error('Failed to load maintenance items:', err) }
  }

  useEffect(() => {
    loadVehicle()
    loadComponents()
    loadTireSets()
    loadFuelLogs()
    loadMaintenanceItems()
  }, [id])

  // ── Handlers ──────────────────────────────────────────────────
  async function handleAddMaintenance(data) {
    try {
      await vehicles.addMaintenance(id, data)
      const updated = await vehicles.get(id)
      setVehicle(updated)
      setShowMaintenanceForm(false)
      setIntervalsRefreshKey(prev => prev + 1)
    } catch (err) { alert('Failed to add maintenance: ' + err.message) }
  }

  async function handleDeleteMaintenance(logId) {
    try {
      await vehicles.deleteMaintenance(logId)
      setVehicle(await vehicles.get(id))
    } catch (err) { alert('Failed to delete maintenance: ' + err.message) }
  }

  async function handleAddComponent(data) {
    try {
      await vehicles.components.create(id, data)
      await loadComponents()
      await loadTireSets()
      setShowComponentForm(false)
    } catch (err) { alert('Failed to save component: ' + err.message) }
  }

  async function handleUpdateComponent(data) {
    try {
      await vehicles.components.update(selectedComponent.id, data)
      await loadComponents()
      await loadTireSets()
      setSelectedComponent(null)
    } catch (err) { alert('Failed to save component: ' + err.message) }
  }

  async function handleDeleteComponent(componentId) {
    try {
      await vehicles.components.delete(componentId)
      await loadComponents()
      await loadTireSets()
    } catch (err) { alert('Failed to delete component: ' + err.message) }
  }

  async function handleAddComponentLog(data) {
    try {
      await vehicles.components.addLog(selectedComponentForLogs.id, data)
      await loadComponents()
    } catch (err) { alert('Failed to add log: ' + err.message) }
  }

  async function handleAddFuelLog(data) {
    try {
      await vehicles.fuelLogs.create(id, data)
      await loadFuelLogs()
      setShowFuelForm(false)
    } catch (err) { alert('Failed to save fuel log: ' + err.message) }
  }

  async function handleUpdateFuelLog(data) {
    try {
      await vehicles.fuelLogs.update(editingFuelLog.id, data)
      await loadFuelLogs()
      setEditingFuelLog(null)
    } catch (err) { alert('Failed to save fuel log: ' + err.message) }
  }

  async function handleDeleteFuelLog(logId) {
    try {
      await vehicles.fuelLogs.delete(logId)
      await loadFuelLogs()
    } catch (err) { alert('Failed to delete fuel log: ' + err.message) }
  }

  async function handleDeleteVehicle() {
    try {
      await vehicles.delete(id)
      navigate('/vehicles')
    } catch (err) { alert('Failed to delete vehicle: ' + err.message) }
  }

  function confirmDeleteVehicle() {
    setShowDeleteConfirm(true)
  }

  async function handleAddTireSet(data) {
    try {
      await vehicles.tireSets.create(id, data)
      await loadTireSets()
      setShowTireSetForm(false)
    } catch (err) { alert('Failed to save tire set: ' + err.message) }
  }

  async function handleUpdateTireSet(data) {
    try {
      await vehicles.tireSets.update(editingTireSet.id, data)
      await loadTireSets()
      setEditingTireSet(null)
    } catch (err) { alert('Failed to save tire set: ' + err.message) }
  }

  async function handleDeleteTireSet(setId) {
    try {
      await vehicles.tireSets.delete(setId)
      await loadTireSets()
    } catch (err) { alert('Failed to delete tire set: ' + err.message) }
  }

  async function handleSwapTireSet(setId) {
    try {
      await vehicles.tireSets.swap(setId)
      await loadTireSets()
      await loadComponents()
    } catch (err) { alert('Failed to swap tire set: ' + err.message) }
  }

  if (loading) return <LCARSLoadingSkeleton />

  // ── Render ────────────────────────────────────────────────────
  const tabs = [
    { key: 'components', label: 'Components' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'fuel', label: 'Fuel Logs' },
    { key: 'intervals', label: 'Intervals' },
  ]

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={() => navigate('/vehicles')}
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
          Fleet Registry
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h1 style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--lcars-space-white)',
            }}>
              {vehicle?.year} {vehicle?.make} {vehicle?.model}
              {vehicle?.trim && (
                <span style={{
                  fontWeight: 400,
                  color: 'var(--lcars-sunflower)',
                  fontSize: '0.85em',
                  marginLeft: '0.5rem',
                }}>
                  // {vehicle.trim}
                </span>
              )}
            </h1>

            {/* Vehicle info row */}
            <div style={{
              display: 'flex',
              gap: '1.25rem',
              marginTop: '0.375rem',
              flexWrap: 'wrap',
            }}>
              <VehicleInfoField label="ID" value={String(vehicle?.id).padStart(3, '0')} icon={<Hash size={11} />} />
              {vehicle?.license_plate && <VehicleInfoField label="Plate" value={vehicle.license_plate} />}
              {vehicle?.current_mileage && <VehicleInfoField label="Odometer" value={`${vehicle.current_mileage.toLocaleString()} mi`} icon={<Gauge size={11} />} />}
              <VehicleInfoField label="Service Logs" value={vehicle?.maintenance_logs?.length || 0} icon={<Wrench size={11} />} />
            </div>
          </div>

          <button
            onClick={confirmDeleteVehicle}
            className="btn btn-danger"
            style={{ fontSize: '0.78rem', flexShrink: 0 }}
            title="Delete vehicle"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Delete vehicle confirmation dialog */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            width: '100%',
            maxWidth: 'min(420px, calc(100vw - 2rem))',
            padding: '1.5rem',
            background: '#000',
            border: '2px solid var(--lcars-tomato)',
            textAlign: 'center',
          }}>
            <AlertTriangle size={28} style={{ color: 'var(--lcars-tomato)', marginBottom: '0.75rem' }} />
            <div style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '1.1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--lcars-space-white)',
              marginBottom: '0.75rem',
            }}>
              Delete Vehicle?
            </div>
            <p style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.8rem',
              color: 'var(--lcars-gray)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '1.25rem',
              lineHeight: 1.5,
            }}>
              This will permanently delete {vehicle?.year} {vehicle?.make} {vehicle?.model} and all associated data.
            </p>
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  height: '30px', padding: '0 1rem', borderRadius: '15px',
                  background: 'var(--lcars-gray)', border: 'none', color: '#000',
                  cursor: 'pointer', fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVehicle}
                style={{
                  height: '30px', padding: '0 1rem', borderRadius: '15px',
                  background: 'var(--lcars-tomato)', border: 'none', color: '#000',
                  cursor: 'pointer', fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Delete Vehicle
              </button>
            </div>
          </div>
        </div>
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

      {/* ── Maintenance Tab ──────────────────────────────────────── */}
      {activeTab === 'maintenance' && (
        <>
          {!showMaintenanceForm && (
            <div style={{ marginBottom: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setShowMaintenanceForm(true)}>
                <Plus size={14} /> Log Service
              </button>
            </div>
          )}

          {showMaintenanceForm && (
            <LCARSPanel title="New Service Record" color="var(--lcars-butterscotch)" style={{ marginBottom: '1.5rem' }}>
              <MaintenanceForm vehicleId={vehicle.id} maintenanceItems={maintenanceItems} onSubmit={handleAddMaintenance} onCancel={() => setShowMaintenanceForm(false)} />
            </LCARSPanel>
          )}

          {vehicle?.maintenance_logs?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {vehicle.maintenance_logs.map((log, i) => (
                <LCARSMaintenanceRow key={log.id} log={log} index={i} onDelete={() => handleDeleteMaintenance(log.id)} />
              ))}
            </div>
          ) : (
            <LCARSPanel title="No Records" color="var(--lcars-gray)">
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--lcars-gray)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                No maintenance logs recorded
              </div>
            </LCARSPanel>
          )}
        </>
      )}

      {/* ── Components Tab ───────────────────────────────────────── */}
      {activeTab === 'components' && (
        <>
          {/* Tire Sets Section */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--lcars-ice)',
              }}>
                Tire Sets
              </span>
              <button className="btn btn-primary" style={{ fontSize: '0.78rem' }} onClick={() => setShowTireSetForm(true)}>
                <Plus size={14} /> Add Tire Set
              </button>
            </div>

            {tireSets.length > 0 && (
              <LCARSPanel title="Active Configuration" color="var(--lcars-ice)" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    color: 'var(--lcars-gray)',
                  }}>
                    Currently Equipped:
                  </span>
                  <select
                    value={String(tireSets.find(ts => ts.is_current)?.id || '')}
                    onChange={(e) => { if (e.target.value) handleSwapTireSet(parseInt(e.target.value)) }}
                    style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    <option value="">None equipped</option>
                    {tireSets.map(ts => (
                      <option key={ts.id} value={String(ts.id)}>
                        {ts.name} {ts.is_current && '\u2713'}
                      </option>
                    ))}
                  </select>
                </div>
              </LCARSPanel>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tireSets.map(ts => (
                <LCARSTireSetCard
                  key={ts.id}
                  tireSet={ts}
                  vehicleMileage={vehicle?.current_mileage}
                  onEdit={() => { setEditingTireSet(ts); setShowTireSetForm(true) }}
                  onDelete={() => handleDeleteTireSet(ts.id)}
                  onSwap={() => handleSwapTireSet(ts.id)}
                />
              ))}
            </div>

            {showTireSetForm && (
              <LCARSModalOverlay title={editingTireSet ? 'Edit Tire Set' : 'Add Tire Set'} onClose={() => { setShowTireSetForm(false); setEditingTireSet(null) }}>
                <TireSetForm
                  vehicleId={vehicle.id}
                  vehicleMileage={vehicle?.current_mileage}
                  tireSet={editingTireSet}
                  onSubmit={editingTireSet ? handleUpdateTireSet : handleAddTireSet}
                  onCancel={() => { setShowTireSetForm(false); setEditingTireSet(null) }}
                />
              </LCARSModalOverlay>
            )}
          </div>

          {showComponentForm && (
            <LCARSModalOverlay title={selectedComponent ? 'Edit Component' : 'Add Component'} onClose={() => { setShowComponentForm(false); setSelectedComponent(null) }}>
              <ComponentForm
                vehicleId={vehicle.id}
                component={selectedComponent}
                onSubmit={selectedComponent ? handleUpdateComponent : handleAddComponent}
                onCancel={() => { setShowComponentForm(false); setSelectedComponent(null) }}
              />
            </LCARSModalOverlay>
          )}

          {selectedComponentForLogs && (
            <LCARSModalOverlay title="Add Component Log" onClose={() => setSelectedComponentForLogs(null)}>
              <ComponentLogForm
                componentId={selectedComponentForLogs.id}
                onSubmit={handleAddComponentLog}
                onCancel={() => setSelectedComponentForLogs(null)}
              />
            </LCARSModalOverlay>
          )}

          {/* Components Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '1rem' }}>
            <button
              onClick={() => setShowArchived(false)}
              style={{
                padding: '0.3rem 0.75rem',
                border: 'none',
                background: !showArchived ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)',
                color: !showArchived ? '#000000' : 'var(--lcars-gray)',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.75rem',
                fontWeight: !showArchived ? 600 : 400,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              Active ({activeComponents.length})
            </button>
            <button
              onClick={() => setShowArchived(true)}
              style={{
                padding: '0.3rem 0.75rem',
                border: 'none',
                background: showArchived ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)',
                color: showArchived ? '#000000' : 'var(--lcars-gray)',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.75rem',
                fontWeight: showArchived ? 600 : 400,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              Archived ({components.length - activeComponents.length})
            </button>
            <button className="btn btn-primary" onClick={() => setShowComponentForm(true)} style={{ fontSize: '0.78rem', marginLeft: '0.5rem' }}>
              <Plus size={14} /> Add Component
            </button>
          </div>

          {/* Components Grouped by Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(() => {
              const grouped = {}
              for (const comp of components) {
                const type = comp.component_type
                if (!grouped[type]) grouped[type] = { active: [], archived: [] }
                if (comp.is_active) grouped[type].active.push(comp)
                else grouped[type].archived.push(comp)
              }
              const sortedTypes = Object.keys(grouped).sort()

              return sortedTypes.map(type => {
                const typeConfig = getComponentType(type)
                const group = grouped[type]
                if (group.active.length === 0 && group.archived.length === 0) return null

                return (
                  <div key={type}>
                    {group.active.length > 0 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          {typeConfig.icon}
                          <span style={{
                            fontFamily: "'Antonio', sans-serif",
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--lcars-sunflower)',
                          }}>
                            {typeConfig.label}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--lcars-gray)' }}>
                            ({group.active.length})
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                          {group.active.map(comp => (
                            <LCARSComponentCard
                              key={comp.id}
                              component={comp}
                              onEdit={() => { setSelectedComponent(comp); setShowComponentForm(true) }}
                              onDelete={() => handleDeleteComponent(comp.id)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {showArchived && group.archived.length > 0 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <Archive size={16} style={{ color: 'var(--lcars-gray)' }} />
                          <span style={{
                            fontFamily: "'Antonio', sans-serif",
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            color: 'var(--lcars-gray)',
                          }}>
                            {typeConfig.label} (Archived)
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--lcars-gray)' }}>
                            ({group.archived.length})
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                          {group.archived.map(comp => (
                            <LCARSComponentCard
                              key={comp.id}
                              component={comp}
                              onEdit={() => { setSelectedComponent(comp); setShowComponentForm(true) }}
                              onDelete={() => handleDeleteComponent(comp.id)}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </>
      )}

      {/* ── Fuel Logs Tab ────────────────────────────────────────── */}
      {activeTab === 'fuel' && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowFuelForm(true)}>
              <Fuel size={14} /> Add Fuel Log
            </button>
            <Link to={`/vehicles/${id}/fuel`} className="btn btn-ghost" style={{ textDecoration: 'none' }}>
              Fuel Economy
            </Link>
          </div>

          {fuelLogs.length > 0 ? (
            <LCARSPanel
              title={`Fuel Records // ${fuelLogs.length} Entries`}
              color="var(--lcars-green)"
              noPadding
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <LTh>Date</LTh>
                      <LTh align="right">Odometer</LTh>
                      <LTh align="right">Gallons</LTh>
                      <LTh align="right">$/Gal</LTh>
                      <LTh align="right">Total</LTh>
                      <LTh align="right">MPG</LTh>
                      <LTh align="center" style={{ width: '40px' }}></LTh>
                    </tr>
                  </thead>
                  <tbody>
                    {fuelLogs.map((log, i) => {
                      const rowBg = i % 2 !== 0 ? 'rgba(255, 255, 255, 0.03)' : 'transparent'
                      return (
                      <tr
                        key={log.id}
                        style={{ transition: 'background 0.1s', background: rowBg }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(153, 153, 51, 0.06)'}
                        onMouseLeave={e => e.currentTarget.style.background = rowBg}
                      >
                        <LTd>{formatDate(log.date)}</LTd>
                        <LTd align="right">{log.mileage?.toLocaleString()}</LTd>
                        <LTd align="right">{log.gallons_added?.toFixed(2)}</LTd>
                        <LTd align="right">${log.cost_per_gallon?.toFixed(3)}</LTd>
                        <LTd align="right" style={{ fontWeight: 600 }}>${log.total_cost?.toFixed(2)}</LTd>
                        <LTd align="right">
                          {log.mpg ? (
                            <span style={{
                              padding: '0.1rem 0.4rem',
                              fontWeight: 600,
                              fontSize: '0.78rem',
                              background: 'rgba(153, 153, 51, 0.2)',
                              color: 'var(--lcars-green)',
                              border: '1px solid rgba(153, 153, 51, 0.4)',
                            }}>
                              {log.mpg.toFixed(1)}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--lcars-gray)' }}>{'\u2014'}</span>
                          )}
                        </LTd>
                        <LTd align="center">
                          <button
                            onClick={() => handleDeleteFuelLog(log.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--lcars-gray)', padding: '0.25rem', display: 'flex', alignItems: 'center',
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-tomato)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </LTd>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </LCARSPanel>
          ) : (
            <LCARSPanel title="No Data" color="var(--lcars-gray)">
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--lcars-gray)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
                No fuel logs recorded
              </div>
            </LCARSPanel>
          )}

          {showFuelForm && (
            <LCARSModalOverlay title={editingFuelLog ? 'Edit Fuel Log' : 'Add Fuel Log'} onClose={() => { setShowFuelForm(false); setEditingFuelLog(null) }}>
              <FuelForm
                vehicleId={vehicle.id}
                vehicleMileage={vehicle?.current_mileage}
                fuelLog={editingFuelLog}
                onSubmit={editingFuelLog ? handleUpdateFuelLog : handleAddFuelLog}
                onCancel={() => { setShowFuelForm(false); setEditingFuelLog(null) }}
              />
            </LCARSModalOverlay>
          )}
        </>
      )}

      {/* ── Service Intervals Tab ────────────────────────────────── */}
      {activeTab === 'intervals' && (
        <LCARSServiceIntervalsTab key={intervalsRefreshKey} vehicleId={id} vehicle={vehicle} />
      )}
    </div>
  )
}


// ── Sub-components ────────────────────────────────────────────────

/**
 * Vehicle info field used in the header.
 */
function VehicleInfoField({ label, value, icon }) {
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
        color: 'var(--lcars-space-white)',
      }}>
        {value}
      </span>
    </div>
  )
}


/**
 * LCARS-styled maintenance log row.
 */
function LCARSMaintenanceRow({ log, index = 0, onDelete }) {
  return (
    <div style={{
      display: 'flex',
      background: index % 2 !== 0 ? '#0a0a0a' : '#000000',
      border: '1px solid rgba(102, 102, 136, 0.3)',
      overflow: 'hidden',
    }}>
      {/* Left accent */}
      <div style={{ width: '5px', background: 'var(--lcars-butterscotch)', flexShrink: 0 }} />

      <div style={{ flex: 1, padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.9rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--lcars-space-white)',
            }}>
              {log.service_type}
            </div>
            <div style={{
              display: 'flex',
              gap: '1rem',
              marginTop: '0.25rem',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.75rem',
            }}>
              <span style={{ color: 'var(--lcars-sunflower)' }}>{formatDate(log.date)}</span>
              {log.mileage && <span style={{ color: 'var(--lcars-gray)' }}>{log.mileage.toLocaleString()} mi</span>}
            </div>
            {log.description && (
              <div style={{
                marginTop: '0.5rem',
                fontSize: '0.82rem',
                color: 'var(--lcars-gray)',
                lineHeight: 1.4,
              }}>
                {log.description}
              </div>
            )}
          </div>

          <button
            onClick={onDelete}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--lcars-gray)', padding: '0.25rem', display: 'flex', alignItems: 'center',
              transition: 'color 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-tomato)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}


/**
 * LCARS modal overlay for forms.
 */
function LCARSModalOverlay({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        width: '100%', maxWidth: '600px', margin: '1rem',
        maxHeight: 'calc(100dvh - 2rem)',
        display: 'flex', flexDirection: 'column',
        background: '#000000',
        border: '2px solid var(--lcars-butterscotch)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.5rem 1rem',
          background: 'var(--lcars-butterscotch)',
          flexShrink: 0,
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.2)', border: 'none',
              color: '#000000', cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '1.25rem', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}


/** LCARS table header cell */
function LTh({ children, align = 'left', style = {} }) {
  return (
    <th style={{
      padding: '0.625rem 1rem', textAlign: align, fontWeight: 600,
      fontSize: '0.72rem',
      fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
      textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--lcars-sunflower)',
      borderBottom: '2px solid var(--lcars-sunflower)',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  )
}

/** LCARS table data cell */
function LTd({ children, align = 'left', style = {} }) {
  return (
    <td style={{
      padding: '0.5rem 1rem', textAlign: align,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.8rem',
      color: 'var(--lcars-space-white)',
      borderBottom: '1px solid rgba(102, 102, 136, 0.2)',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </td>
  )
}


function LCARSLoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '1rem', width: '120px', background: 'rgba(102, 102, 136, 0.15)', marginBottom: '0.5rem' }} />
      <div style={{ height: '1.5rem', width: '350px', background: 'rgba(102, 102, 136, 0.2)', marginBottom: '0.375rem' }} />
      <div style={{ height: '0.8rem', width: '250px', background: 'rgba(102, 102, 136, 0.1)', marginBottom: '1.5rem' }} />
      <div style={{ display: 'flex', gap: '3px', marginBottom: '1.5rem' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: '32px', width: '100px', background: 'rgba(102, 102, 136, 0.15)' }} />
        ))}
      </div>
      <div style={{ height: '200px', background: 'rgba(102, 102, 136, 0.06)', border: '1px solid rgba(102, 102, 136, 0.15)' }} />
    </div>
  )
}
