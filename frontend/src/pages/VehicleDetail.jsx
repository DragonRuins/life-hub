/**
 * Vehicle Detail Page
 *
 * Shows a single vehicle's info, maintenance history, component tracking, and tire set management.
 * You can add and delete maintenance logs and manage components (tires, battery, etc.) here.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Wrench, Trash2, X, Box, Archive, Fuel, Settings } from 'lucide-react'
import { vehicles } from '../api/client'
import { formatDate } from '../utils/formatDate'
import ComponentCard from '../components/ComponentCard'
import ComponentForm from '../components/ComponentForm'
import ComponentLogForm from '../components/ComponentLogForm'
import MaintenanceForm from '../components/MaintenanceForm'
import ServiceIntervalsTab from '../components/ServiceIntervalsTab'
import TireSetCard from '../components/TireSetCard'
import TireSetForm from '../components/TireSetForm'
import FuelForm from '../components/FuelForm'
import { getComponentType } from '../constants/componentTypes'

export default function VehicleDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [vehicle, setVehicle] = useState(null)
  const [components, setComponents] = useState([])
  const [loading, setLoading] = useState(true)

  // Derived state: active (non-archived) components
  const activeComponents = components.filter(c => c.is_active)

  // Tab state: 'maintenance' or 'components'
  const [activeTab, setActiveTab] = useState('components')

  // Components state
  const [showArchived, setShowArchived] = useState(false)

  // Component form state
  const [showComponentForm, setShowComponentForm] = useState(false)
  const [selectedComponent, setSelectedComponent] = useState(null)

  // Component log state
  const [selectedComponentForLogs, setSelectedComponentForLogs] = useState(null)

  // Tire Sets state
  const [tireSets, setTireSets] = useState([])
  const [showTireSetForm, setShowTireSetForm] = useState(false)
  const [editingTireSet, setEditingTireSet] = useState(null)

  // Fuel Logs state
  const [fuelLogs, setFuelLogs] = useState([])
  const [showFuelForm, setShowFuelForm] = useState(false)
  const [editingFuelLog, setEditingFuelLog] = useState(null)

  // Maintenance Items (global catalog, used by MaintenanceForm checkbox picker)
  const [maintenanceItems, setMaintenanceItems] = useState([])

  // Counter to force ServiceIntervalsTab to reload when maintenance is added
  const [intervalsRefreshKey, setIntervalsRefreshKey] = useState(0)

  // Maintenance form state
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false)

  async function loadVehicle() {
    try {
      const data = await vehicles.get(id)
      setVehicle(data)
      // Components are included in vehicle response
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
    try {
      const data = await vehicles.tireSets.list(id)
      setTireSets(data)
    } catch (err) {
      console.error('Failed to load tire sets:', err)
    }
  }

  async function loadFuelLogs() {
    try {
      const data = await vehicles.fuelLogs.list(id)
      setFuelLogs(data)
    } catch (err) {
      console.error('Failed to load fuel logs:', err)
    }
  }

  async function loadMaintenanceItems() {
    try {
      const data = await vehicles.maintenanceItems.list()
      setMaintenanceItems(data)
    } catch (err) {
      console.error('Failed to load maintenance items:', err)
    }
  }

  useEffect(() => {
    loadVehicle()
    loadComponents()
    loadTireSets()
    loadFuelLogs()
    loadMaintenanceItems()
  }, [id])

  async function handleAddMaintenance(data) {
    try {
      await vehicles.addMaintenance(id, data)
      // Reload vehicle to get updated maintenance count
      const updated = await vehicles.get(id)
      setVehicle(updated)
      setShowMaintenanceForm(false)
      // Bump refresh key so ServiceIntervalsTab reloads (maintenance may update interval statuses)
      setIntervalsRefreshKey(prev => prev + 1)
    } catch (err) {
      alert('Failed to add maintenance: ' + err.message)
    }
  }

  async function handleDeleteMaintenance(logId) {
    try {
      await vehicles.deleteMaintenance(logId)
      // Reload vehicle
      const updated = await vehicles.get(id)
      setVehicle(updated)
    } catch (err) {
      alert('Failed to delete maintenance: ' + err.message)
    }
  }

  async function handleAddComponent(data) {
    try {
      await vehicles.components.create(id, data)
      await loadComponents()
      await loadTireSets()
      setShowComponentForm(false)
    } catch (err) {
      alert('Failed to save component: ' + err.message)
    }
  }

  async function handleUpdateComponent(data) {
    try {
      await vehicles.components.update(selectedComponent.id, data)
      await loadComponents()
      await loadTireSets()
      setSelectedComponent(null)
    } catch (err) {
      alert('Failed to save component: ' + err.message)
    }
  }

  async function handleDeleteComponent(componentId) {
    try {
      await vehicles.components.delete(componentId)
      await loadComponents()
      await loadTireSets()
    } catch (err) {
      alert('Failed to delete component: ' + err.message)
    }
  }

  async function handleAddComponentLog(data) {
    try {
      await vehicles.components.addLog(selectedComponentForLogs.id, data)
      await loadComponents()
    } catch (err) {
      alert('Failed to add log: ' + err.message)
    }
  }

  // Fuel Logs handlers
  async function handleAddFuelLog(data) {
    try {
      await vehicles.fuelLogs.create(id, data)
      await loadFuelLogs()
      setShowFuelForm(false)
    } catch (err) {
      alert('Failed to save fuel log: ' + err.message)
    }
  }

  async function handleUpdateFuelLog(data) {
    try {
      await vehicles.fuelLogs.update(editingFuelLog.id, data)
      await loadFuelLogs()
      setEditingFuelLog(null)
    } catch (err) {
      alert('Failed to save fuel log: ' + err.message)
    }
  }

  async function handleDeleteFuelLog(logId) {
    try {
      await vehicles.fuelLogs.delete(logId)
      await loadFuelLogs()
    } catch (err) {
      alert('Failed to delete fuel log: ' + err.message)
    }
  }

  async function handleDeleteVehicle() {
    try {
      await vehicles.delete(id)
      navigate('/vehicles')
    } catch (err) {
      alert('Failed to delete vehicle: ' + err.message)
    }
  }

  // Tire Set handlers
  async function handleAddTireSet(data) {
    try {
      await vehicles.tireSets.create(id, data)
      await loadTireSets()
      setShowTireSetForm(false)
    } catch (err) {
      alert('Failed to save tire set: ' + err.message)
    }
  }

  async function handleUpdateTireSet(data) {
    try {
      await vehicles.tireSets.update(editingTireSet.id, data)
      await loadTireSets()
      setEditingTireSet(null)
    } catch (err) {
      alert('Failed to save tire set: ' + err.message)
    }
  }

  async function handleDeleteTireSet(setId) {
    try {
      await vehicles.tireSets.delete(setId)
      await loadTireSets()
    } catch (err) {
      alert('Failed to delete tire set: ' + err.message)
    }
  }

  async function handleSwapTireSet(setId) {
    try {
      await vehicles.tireSets.swap(setId)
      await loadTireSets()
      await loadComponents() // Components may have changed status
    } catch (err) {
      alert('Failed to swap tire set: ' + err.message)
    }
  }

  if (loading) return <LoadingSkeleton />

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <button onClick={() => navigate('/vehicles')} style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-subtext-0)', fontSize: '0.875rem' }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {vehicle?.year} {vehicle?.make} {vehicle?.model}
            {vehicle?.trim && <span style={{ fontWeight: 400, color: 'var(--color-subtext-0)', fontSize: '0.9em', marginLeft: '0.25rem' }}> ({vehicle.trim})</span>}
          </h1>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-subtext-0)', marginTop: '0.25rem' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-overlay-0)' }}>ID: {vehicle?.id}</span>
            {vehicle?.license_plate && <span> • {vehicle.license_plate}</span>}
            {' '} • {vehicle?.current_mileage?.toLocaleString()} mi
          </div>
        </div>
        <button
          onClick={handleDeleteVehicle}
          className="btn btn-danger"
          style={{ fontSize: '0.8rem' }}
          title="Delete vehicle"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          className={`btn ${activeTab === 'maintenance' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('maintenance')}
        >
          Maintenance History
        </button>
        <button
          className={`btn ${activeTab === 'components' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('components')}
        >
          Components
        </button>
        <button
          className={`btn ${activeTab === 'fuel' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('fuel')}
        >
          Fuel Logs
        </button>
        <button
          className={`btn ${activeTab === 'intervals' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('intervals')}
        >
          Service Intervals
        </button>
      </div>

      {/* Maintenance History Tab */}
      {activeTab === 'maintenance' && (
        <>
          {/* Add Maintenance Button */}
          {!showMaintenanceForm && (
            <div style={{ marginBottom: '1rem' }}>
              <button className="btn btn-primary" onClick={() => setShowMaintenanceForm(true)}>
                <Plus size={14} style={{ marginRight: '0.5rem' }} />
                Add Maintenance
              </button>
            </div>
          )}

          {/* Add Maintenance Form */}
          {showMaintenanceForm && (
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <MaintenanceForm vehicleId={vehicle.id} maintenanceItems={maintenanceItems} onSubmit={handleAddMaintenance} onCancel={() => setShowMaintenanceForm(false)} />
            </div>
          )}

          {/* Maintenance Logs List */}
          {vehicle?.maintenance_logs?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {vehicle.maintenance_logs.map((log) => (
                <div key={log.id} className="card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px',
                        background: 'rgba(250, 179, 135, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Wrench size={16} style={{ color: 'var(--color-peach)' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                          {log.service_type}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', display: 'flex', gap: '1rem', marginTop: '0.125rem' }}>
                          <span>{formatDate(log.date)}</span>
                          {log.mileage && <span> • {log.mileage.toLocaleString()} mi</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteMaintenance(log.id)}
                        style={{ padding: '0.375rem' }}
                        title="Delete maintenance log"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--color-subtext-0)' }}>
                    {log.description}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                No maintenance logs yet. Add a service record to track oil changes, repairs, etc.
              </p>
            </div>
          )}
        </>
      )}

      {/* Components Tab */}
      {activeTab === 'components' && (
        <>
          {/* Tire Sets Section */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Tire Sets</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => setShowTireSetForm(true)}>
                  <Plus size={14} /> Add Tire Set
                </button>
              </div>
            </div>

            {/* Current Set Selector */}
            {tireSets.length > 0 && (
              <div className="card" style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>Currently equipped:</span>
                  <select
                    value={String(tireSets.find(ts => ts.is_current)?.id || '')}
                    onChange={(e) => {
                      const setId = e.target.value
                      if (setId) {
                        handleSwapTireSet(parseInt(setId))
                      }
                    }}
                    style={{ padding: '0.5rem', fontSize: '0.9rem', borderRadius: '6px' }}
                  >
                    <option value="">None equipped</option>
                    {tireSets.map(ts => (
                      <option key={ts.id} value={String(ts.id)}>
                        {ts.name} {ts.is_current && '✓'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Tire Sets List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {tireSets.map(ts => (
                <TireSetCard
                  key={ts.id}
                  tireSet={ts}
                  vehicleMileage={vehicle?.current_mileage}
                  onEdit={() => {
                    setEditingTireSet(ts)
                    setShowTireSetForm(true)
                  }}
                  onDelete={() => handleDeleteTireSet(ts.id)}
                  onSwap={() => handleSwapTireSet(ts.id)}
                />
              ))}
            </div>

            {/* Add Tire Set Form Modal */}
            {showTireSetForm && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              }}>
                <div className="card" style={{ width: '100%', maxWidth: 'min(600px, calc(100vw - 2rem))', margin: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                      {editingTireSet ? 'Edit Tire Set' : 'Add Tire Set'}
                    </h2>
                    <button className="btn btn-ghost" onClick={() => setShowTireSetForm(false)}>
                      <X size={18} />
                    </button>
                  </div>
                  <TireSetForm
                    vehicleId={vehicle.id}
                    vehicleMileage={vehicle?.current_mileage}
                    tireSet={editingTireSet}
                    onSubmit={editingTireSet ? handleUpdateTireSet : handleAddTireSet}
                    onCancel={() => {
                      setShowTireSetForm(false)
                      setEditingTireSet(null)
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Component Form Modal */}
          {showComponentForm && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}>
              <div className="card" style={{ width: '100%', maxWidth: 'min(500px, calc(100vw - 2rem))', margin: '1rem' }}>
                <ComponentForm
                  vehicleId={vehicle.id}
                  component={selectedComponent}
                  onSubmit={selectedComponent ? handleUpdateComponent : handleAddComponent}
                  onCancel={() => {
                    setShowComponentForm(false)
                    setSelectedComponent(null)
                  }}
                />
              </div>
            </div>
          )}

          {/* Component Log Form Modal */}
          {selectedComponentForLogs && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            }}>
              <div className="card" style={{ width: '100%', maxWidth: '450px', margin: '1rem' }}>
                <ComponentLogForm
                  componentId={selectedComponentForLogs.id}
                  onSubmit={handleAddComponentLog}
                  onCancel={() => setSelectedComponentForLogs(null)}
                />
              </div>
            </div>
          )}

          {/* Components Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                className={`btn ${!showArchived ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setShowArchived(false)}
                style={{ fontSize: '0.8rem' }}
              >
                Active ({activeComponents.length})
              </button>

              <button
                className={`btn ${showArchived ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setShowArchived(true)}
                style={{ fontSize: '0.8rem' }}
              >
                Archived ({components.length - activeComponents.length})
              </button>

              <button
                className="btn btn-primary"
                onClick={() => setShowComponentForm(true)}
                style={{ fontSize: '0.8rem' }}
              >
                <Plus size={14} /> Add Component
              </button>
            </div>
          </div>

          {/* Components Grouped by Type */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(() => {
              // Group by component_type, separate active from archived
              const grouped = {}

              for (const comp of components) {
                const type = comp.component_type
                if (!grouped[type]) {
                  grouped[type] = { active: [], archived: [] }
                }
                if (comp.is_active) {
                  grouped[type].active.push(comp)
                } else {
                  grouped[type].archived.push(comp)
                }
              }

              // Sort types alphabetically
              const sortedTypes = Object.keys(grouped).sort()

              return sortedTypes.map(type => {
                const typeConfig = getComponentType(type)
                const group = grouped[type]

                // Skip if no components in either group
                if (group.active.length === 0 && group.archived.length === 0) {
                  return null
                }

                return (
                  <div key={type}>
                    {/* Active Group */}
                    {group.active.length > 0 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          {typeConfig.icon}
                          <div>
                            <span style={{ fontWeight: 600 }}>{typeConfig.label}</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginLeft: '0.5rem' }}>
                              ({group.active.length})
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                          {group.active.map(comp => (
                            <ComponentCard
                              key={comp.id}
                              component={comp}
                              onEdit={() => {
                                setSelectedComponent(comp)
                                setShowComponentForm(true)
                              }}
                              onDelete={() => handleDeleteComponent(comp.id)}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Archived Group */}
                    {group.archived.length > 0 && (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <Archive size={16} style={{ color: 'var(--color-subtext-0)' }} />
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--color-subtext-0)' }}>{typeConfig.label} (Archived)</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginLeft: '0.5rem' }}>
                              ({group.archived.length})
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                          {group.archived.map(comp => (
                            <ComponentCard
                              key={comp.id}
                              component={comp}
                              onEdit={() => {
                                setSelectedComponent(comp)
                                setShowComponentForm(true)
                              }}
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

      {/* Fuel Logs Tab */}
      {activeTab === 'fuel' && (
        <>
          {/* Add Fuel Log Button + Fuel Economy Link */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowFuelForm(true)}>
              <Fuel size={14} style={{ marginRight: '0.5rem' }} />
              Add Fuel Log
            </button>
            <Link to={`/vehicles/${id}/fuel`} className="btn btn-ghost">
              Fuel Economy
            </Link>
          </div>

          {/* Fuel Logs List */}
          {fuelLogs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {fuelLogs.map((log) => (
                <div key={log.id} className="card" style={{ padding: '1rem 1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {formatDate(log.date)}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)' }}>
                        {log.mileage?.toLocaleString()} mi
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {log.mpg && (
                        <div style={{
                          padding: '0.25rem 0.5rem',
                          background: 'var(--color-green)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'white'
                        }}>
                          {log.mpg.toFixed(1)} MPG
                        </div>
                      )}
                      <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => handleDeleteFuelLog(log.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: 'var(--color-subtext-0)' }}>Gallons:</span>
                      <span style={{ fontWeight: 600 }}>{log.gallons_added}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-subtext-0)' }}>Price/gal:</span>
                      <span>${log.cost_per_gallon?.toFixed(3)}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-subtext-0)' }}>Total:</span>
                      <span style={{ fontWeight: 600 }}>${log.total_cost?.toFixed(2)}</span>
                    </div>
                  </div>
                  {log.location && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-1)', marginTop: '0.5rem' }}>
                      at {log.location}
                    </div>
                  )}
                  {log.fuel_type && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-1)' }}>
                      {log.fuel_type}
                    </div>
                  )}
                  {log.payment_method && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-1)' }}>
                      Paid with {log.payment_method}
                    </div>
                  )}
                  {log.notes && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-1)', marginTop: '0.5rem' }}>
                      {log.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p>No fuel logs yet. Track your fill-ups to see MPG trends!</p>
            </div>
          )}

          {/* Fuel Log Form Modal */}
          {showFuelForm && (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              }}>
              <div className="card" style={{ width: '100%', maxWidth: 'min(500px, calc(100vw - 2rem))', margin: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                    {editingFuelLog ? 'Edit Fuel Log' : 'Add Fuel Log'}
                  </h2>
                  <button className="btn btn-ghost" onClick={() => setShowFuelForm(false)}>
                    <X size={18} />
                  </button>
                </div>
                <FuelForm
                  vehicleId={vehicle.id}
                  vehicleMileage={vehicle?.current_mileage}
                  fuelLog={editingFuelLog}
                  onSubmit={editingFuelLog ? handleUpdateFuelLog : handleAddFuelLog}
                  onCancel={() => {
                    setShowFuelForm(false)
                    setEditingFuelLog(null)
                  }}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Service Intervals Tab */}
      {activeTab === 'intervals' && (
        <ServiceIntervalsTab key={intervalsRefreshKey} vehicleId={id} vehicle={vehicle} />
      )}
    </div>
  )
}


/**
 * Form component for adding a new vehicle.
 */
function VehicleForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    year: '',
    make: '',
    model: '',
    trim: '',
    color: '',
    vin: '',
    license_plate: '',
    current_mileage: '',
    notes: '',
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      year: parseInt(form.year),
      current_mileage: form.current_mileage ? parseInt(form.current_mileage) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Add New Vehicle</h3>

      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Year *</label>
          <input name="year" type="number" placeholder="2021" value={form.year} onChange={handleChange} required />
        </div>
        <div>
          <label>Make *</label>
          <input name="make" placeholder="Ram" value={form.make} onChange={handleChange} required />
        </div>
        <div>
          <label>Model *</label>
          <input name="model" placeholder="1500" value={form.model} onChange={handleChange} required />
        </div>
      </div>

      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Trim</label>
          <input name="trim" placeholder="Night Edition" value={form.trim} onChange={handleChange} />
        </div>
        <div>
          <label>Color</label>
          <input name="color" placeholder="Black" value={form.color} onChange={handleChange} />
        </div>
        <div>
          <label>Current Mileage</label>
          <input name="current_mileage" type="number" placeholder="45000" value={form.current_mileage} onChange={handleChange} />
        </div>
      </div>

      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>VIN</label>
          <input name="vin" placeholder="1C6SRFFT..." maxLength={17} value={form.vin} onChange={handleChange} />
        </div>
        <div>
          <label>License Plate</label>
          <input name="license_plate" placeholder="ABC 1234" value={form.license_plate} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label>Notes</label>
        <textarea name="notes" rows={2} placeholder="Any additional notes..." value={form.notes} onChange={handleChange} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Add Vehicle</button>
      </div>
    </form>
  )
}


function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '2rem', width: '200px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '2rem' }} />
      <div style={{ height: '180px', background: 'var(--color-surface-0)', borderRadius: '12px', marginBottom: '1.5rem', opacity: 0.3 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div style={{ height: '200px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
        <div style={{ height: '200px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
      </div>
    </div>
  )
}
