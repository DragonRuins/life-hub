/**
 * MaintenanceForm - Add a service/maintenance record.
 *
 * Reusable component that can work with or without a pre-selected vehicle.
 * When vehicles array is provided, shows a vehicle selector dropdown.
 * When maintenanceItems array is provided, shows a searchable multi-select
 * picker instead of a plain text input for service_type.
 *
 * Props:
 *   onSubmit(data) - Callback with form data; parent handles the API call
 *   onCancel - Callback to close/cancel the form
 *   vehicles - (optional) Array of vehicle objects for a vehicle selector
 *   vehicleId - (optional) Pre-selected vehicle ID (hides vehicle selector)
 *   maintenanceItems - (optional) Array of {id, name, category} for searchable picker
 */
import { useState, useRef, useEffect } from 'react'
import { X, Search, ChevronDown, ChevronUp } from 'lucide-react'

export default function MaintenanceForm({ onSubmit, onCancel, vehicles, vehicleId: preselectedVehicleId, maintenanceItems }) {
  const [form, setForm] = useState({
    vehicle_id: preselectedVehicleId || '',
    service_type: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    mileage: '',
    cost: '',
    shop_name: '',
  })

  // Track which maintenance items are selected (by item id)
  const [selectedItemIds, setSelectedItemIds] = useState(new Set())
  // Whether the "Other (custom)" checkbox is checked
  const [showOther, setShowOther] = useState(false)
  // Search/filter text for the item picker
  const [searchText, setSearchText] = useState('')
  // Whether the picker dropdown is expanded
  const [pickerOpen, setPickerOpen] = useState(false)

  const searchRef = useRef(null)
  const pickerRef = useRef(null)

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  /** Toggle a maintenance item on or off */
  function toggleItem(itemId) {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      return next
    })
  }

  /** Remove a selected item (from chip click) */
  function removeItem(itemId) {
    setSelectedItemIds(prev => {
      const next = new Set(prev)
      next.delete(itemId)
      return next
    })
  }

  /**
   * Derive the service_type string from selected items.
   * If items are selected, join their names with " + ".
   * If the user also typed custom text, append it.
   */
  function getDerivedServiceType() {
    const selectedNames = (maintenanceItems || [])
      .filter(item => selectedItemIds.has(item.id))
      .map(item => item.name)

    if (showOther && form.service_type.trim()) {
      selectedNames.push(form.service_type.trim())
    }

    return selectedNames.join(' + ')
  }

  function handleSubmit(e) {
    e.preventDefault()

    let serviceType = form.service_type
    if (hasItems) {
      serviceType = getDerivedServiceType()
    }

    const data = {
      ...form,
      service_type: serviceType,
      mileage: form.mileage ? parseInt(form.mileage) : null,
      cost: form.cost ? parseFloat(form.cost) : 0,
      item_ids: [...selectedItemIds],
    }

    onSubmit(data)
  }

  const showVehicleSelector = vehicles && vehicles.length > 0 && !preselectedVehicleId
  const hasItems = maintenanceItems && maintenanceItems.length > 0

  /**
   * Get items filtered by search text, grouped into sections.
   * Items with sort_order < 100 go into a "Common" section at top.
   * The rest are grouped by their category.
   * Returns an ordered array of { label, items } sections.
   */
  function getFilteredGroupedItems() {
    if (!maintenanceItems) return []
    const query = searchText.toLowerCase().trim()

    const filtered = query
      ? maintenanceItems.filter(item =>
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query))
      : maintenanceItems

    // Split into common (sort_order < 100) and rest
    const common = filtered.filter(item => (item.sort_order || 999) < 100)
    const rest = filtered.filter(item => (item.sort_order || 999) >= 100)

    // Group the rest by category
    const catGroups = {}
    for (const item of rest) {
      const cat = item.category || 'Other'
      if (!catGroups[cat]) catGroups[cat] = []
      catGroups[cat].push(item)
    }

    // Build ordered sections: Common first, then categories alphabetically
    const sections = []
    if (common.length > 0) {
      sections.push({ label: 'Common', items: common })
    }
    for (const key of Object.keys(catGroups).sort()) {
      sections.push({ label: key, items: catGroups[key] })
    }
    return sections
  }

  /** Get the selected item objects for chip display */
  function getSelectedItems() {
    if (!maintenanceItems) return []
    return maintenanceItems.filter(item => selectedItemIds.has(item.id))
  }

  // Validation: at least one item must be selected or custom text entered
  const hasServiceType = hasItems
    ? (selectedItemIds.size > 0 || (showOther && form.service_type.trim()))
    : form.service_type.trim()

  const filteredSections = getFilteredGroupedItems()
  const selectedItems = getSelectedItems()

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        Add Service Record
      </h3>

      {showVehicleSelector && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Vehicle *</label>
          <select
            name="vehicle_id"
            value={form.vehicle_id}
            onChange={handleChange}
            required
          >
            <option value="">Select a vehicle...</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.year} {v.make} {v.model} {v.trim && `(${v.trim})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Service Type: searchable multi-select (if maintenanceItems provided) or text input */}
      {hasItems ? (
        <div style={{ marginBottom: '1rem' }} ref={pickerRef}>
          <label>Service Type *</label>

          {/* Selected items as chips */}
          {selectedItems.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.375rem',
              marginBottom: '0.5rem',
            }}>
              {selectedItems.map(item => (
                <span
                  key={item.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.25rem 0.5rem 0.25rem 0.625rem',
                    background: 'rgba(137, 180, 250, 0.12)',
                    border: '1px solid rgba(137, 180, 250, 0.25)',
                    borderRadius: '6px', fontSize: '0.8rem', color: 'var(--color-blue)',
                    fontWeight: 500,
                  }}
                >
                  {item.name}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '0', display: 'flex', alignItems: 'center',
                      color: 'var(--color-blue)', opacity: 0.7,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '0.7' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Search input that opens the picker */}
          <div style={{ position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: 'var(--color-mantle)',
              border: '1px solid var(--color-surface-0)',
              borderRadius: '8px',
              transition: 'border-color 0.2s ease',
              borderColor: pickerOpen ? 'var(--color-blue)' : 'var(--color-surface-0)',
            }}>
              <Search size={14} style={{
                color: 'var(--color-overlay-0)', marginLeft: '0.75rem', flexShrink: 0,
              }} />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search maintenance items..."
                value={searchText}
                onChange={e => {
                  setSearchText(e.target.value)
                  if (!pickerOpen) setPickerOpen(true)
                }}
                onFocus={() => setPickerOpen(true)}
                style={{
                  border: 'none', background: 'transparent',
                  padding: '0.5rem 0.625rem',
                  fontSize: '0.85rem', width: '100%',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => setPickerOpen(!pickerOpen)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center',
                  color: 'var(--color-overlay-0)',
                }}
              >
                {pickerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Dropdown list */}
            {pickerOpen && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                marginTop: '4px', zIndex: 50,
                background: 'var(--color-mantle)',
                border: '1px solid var(--color-surface-1)',
                borderRadius: '8px',
                maxHeight: '220px', overflowY: 'auto',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
              }}>
                {filteredSections.length === 0 && !searchText && (
                  <div style={{ padding: '0.75rem 1rem', color: 'var(--color-overlay-0)', fontSize: '0.85rem' }}>
                    No maintenance items available.
                  </div>
                )}

                {filteredSections.length === 0 && searchText && (
                  <div style={{ padding: '0.75rem 1rem', color: 'var(--color-overlay-0)', fontSize: '0.85rem' }}>
                    No items match "{searchText}"
                  </div>
                )}

                {filteredSections.map(section => (
                  <div key={section.label}>
                    {/* Section header */}
                    <div style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.7rem', fontWeight: 600,
                      color: section.label === 'Common' ? 'var(--color-blue)' : 'var(--color-overlay-1)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      background: 'rgba(0, 0, 0, 0.15)',
                      borderBottom: '1px solid var(--color-surface-0)',
                      position: 'sticky', top: 0,
                    }}>
                      {section.label}
                    </div>
                    {section.items.map(item => {
                      const isSelected = selectedItemIds.has(item.id)
                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleItem(item.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.625rem',
                            padding: '0.5rem 0.75rem',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            color: isSelected ? 'var(--color-blue)' : 'var(--color-text)',
                            background: isSelected ? 'rgba(137, 180, 250, 0.06)' : 'transparent',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = isSelected ? 'rgba(137, 180, 250, 0.06)' : 'transparent'
                          }}
                        >
                          {/* Custom checkbox visual (avoids global input styles) */}
                          <div style={{
                            width: '16px', height: '16px', flexShrink: 0,
                            borderRadius: '4px',
                            border: isSelected
                              ? '2px solid var(--color-blue)'
                              : '2px solid var(--color-surface-2)',
                            background: isSelected ? 'var(--color-blue)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}>
                            {isSelected && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="var(--color-crust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span style={{ fontWeight: isSelected ? 500 : 400 }}>
                            {item.name}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* "Other (custom)" option at the bottom */}
                <div style={{ borderTop: '1px solid var(--color-surface-0)' }}>
                  <div
                    onClick={() => {
                      setShowOther(!showOther)
                      if (!showOther) {
                        // Focus the custom input after it renders
                        setTimeout(() => {
                          const el = document.getElementById('custom-service-type')
                          if (el) el.focus()
                        }, 50)
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: showOther ? 'var(--color-peach)' : 'var(--color-subtext-0)',
                      background: showOther ? 'rgba(250, 179, 135, 0.06)' : 'transparent',
                      fontStyle: 'italic',
                    }}
                  >
                    <div style={{
                      width: '16px', height: '16px', flexShrink: 0,
                      borderRadius: '4px',
                      border: showOther
                        ? '2px solid var(--color-peach)'
                        : '2px solid var(--color-surface-2)',
                      background: showOther ? 'var(--color-peach)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}>
                      {showOther && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="var(--color-crust)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    Other (custom)
                  </div>
                  {showOther && (
                    <div style={{ padding: '0.25rem 0.75rem 0.5rem' }}>
                      <input
                        id="custom-service-type"
                        name="service_type"
                        placeholder="Custom service type..."
                        value={form.service_type}
                        onChange={handleChange}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: '0.85rem' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Preview of derived service type */}
          {hasServiceType && !pickerOpen && (
            <div style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginTop: '0.375rem' }}>
              Will log as: <strong style={{ color: 'var(--color-text)' }}>{getDerivedServiceType()}</strong>
            </div>
          )}
        </div>
      ) : (
        <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
          <div>
            <label>Service Type *</label>
            <input name="service_type" placeholder="Oil Change" value={form.service_type} onChange={handleChange} required />
          </div>
          <div>
            <label>Date *</label>
            <input name="date" type="date" value={form.date} onChange={handleChange} required />
          </div>
        </div>
      )}

      {/* Date field (shown separately when using item picker, since it no longer shares a row) */}
      {hasItems && (
        <div style={{ marginBottom: '1rem' }}>
          <label>Date *</label>
          <input name="date" type="date" value={form.date} onChange={handleChange} required style={{ maxWidth: '200px' }} />
        </div>
      )}

      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Mileage</label>
          <input name="mileage" type="number" placeholder="45000" value={form.mileage} onChange={handleChange} />
        </div>
        <div>
          <label>Cost ($)</label>
          <input name="cost" type="number" step="0.01" placeholder="65.99" value={form.cost} onChange={handleChange} />
        </div>
        <div>
          <label>Shop / Location</label>
          <input name="shop_name" placeholder="Valvoline" value={form.shop_name} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label>Description</label>
        <textarea name="description" rows={2} placeholder="Full synthetic 5W-30, replaced filter..." value={form.description} onChange={handleChange} />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!hasServiceType}>Add Record</button>
      </div>
    </form>
  )
}
