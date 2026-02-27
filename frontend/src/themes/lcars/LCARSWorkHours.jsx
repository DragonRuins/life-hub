/**
 * LCARSWorkHours.jsx - LCARS Duty Roster / Work Hours Page
 *
 * Tracks monthly hours worked against a standard work schedule.
 * LCARS-styled with panels, pill-button year selector, and
 * horizontal bar readouts per month using LCARS color palette:
 *   - Sunflower: straight time (hours worked up to required)
 *   - Red Alert: deficit (behind required hours)
 *   - Gold: overtime (beyond required)
 *   - Gray: not yet entered
 *
 * Route: /work-hours
 */
import { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'
import useIsMobile from '../../hooks/useIsMobile'
import { workHours } from '../../api/client'
import LCARSPanel, { LCARSStat } from './LCARSPanel'
import LCARSModal from './LCARSModal'

export default function LCARSWorkHours() {
  const isMobile = useIsMobile()
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(currentYear)
  const [months, setMonths] = useState([])
  const [summary, setSummary] = useState(null)
  const [years, setYears] = useState([currentYear])
  const [editingMonth, setEditingMonth] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async (y) => {
    try {
      setLoading(true)
      const [monthsData, summaryData, yearsData] = await Promise.all([
        workHours.getYear(y),
        workHours.getSummary(y),
        workHours.getYears(),
      ])
      setMonths(monthsData)
      setSummary(summaryData)
      setYears(yearsData)
    } catch (err) {
      console.error('Failed to load work hours:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(year)
  }, [year, loadData])

  function openEdit(month) {
    setEditingMonth(month)
    setEditValue(
      month.hours_worked !== null && month.hours_worked !== undefined
        ? String(month.hours_worked)
        : ''
    )
  }

  async function handleSave() {
    setSaving(true)
    const hours = editValue.trim() === '' ? null : parseFloat(editValue)
    if (hours !== null && (isNaN(hours) || hours < 0)) {
      alert('Enter a valid number of hours or leave blank to clear')
      setSaving(false)
      return
    }
    try {
      await workHours.updateMonth(year, editingMonth.month, { hours_worked: hours })
      setEditingMonth(null)
      loadData(year)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading && months.length === 0) return <LCARSLoadingSkeleton />

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'var(--lcars-space-white)',
          marginBottom: '0.25rem',
        }}>
          Duty Roster
        </h1>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem',
          color: 'var(--lcars-sunflower)',
        }}>
          Work Hours Tracking // Personnel Time Log
        </div>
      </div>

      {/* Year Selector - LCARS pill buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        marginBottom: '1rem',
      }}>
        <span style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--lcars-gray)',
          marginRight: '0.5rem',
          whiteSpace: 'nowrap',
        }}>
          Year
        </span>
        {years.map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            style={{
              padding: '0.3rem 0.85rem',
              border: 'none',
              background: year === y ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)',
              color: year === y ? 'var(--lcars-text-on-color)' : 'var(--lcars-gray)',
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '0.8rem',
              fontWeight: year === y ? 600 : 400,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              borderRadius: 0,
            }}
            onMouseEnter={e => {
              if (year !== y) e.currentTarget.style.background = 'rgba(102, 102, 136, 0.4)'
            }}
            onMouseLeave={e => {
              if (year !== y) e.currentTarget.style.background = 'rgba(102, 102, 136, 0.25)'
            }}
          >
            {y}
          </button>
        ))}
      </div>

      {/* Stats Panel */}
      {summary && (
        <LCARSPanel title="Personnel Summary" color="var(--lcars-ice)" style={{ marginBottom: '1rem' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: '0.25rem',
          }}>
            <LCARSStat
              icon={<Clock size={18} />}
              label="Hours Logged"
              value={summary.total_hours > 0 ? summary.total_hours.toLocaleString() : '0'}
              color="var(--lcars-ice)"
            />
            <LCARSStat
              label="Required"
              value={summary.total_required > 0 ? summary.total_required.toLocaleString() : '0'}
              color="var(--lcars-gray)"
            />
            <LCARSStat
              label="Overtime"
              value={summary.total_overtime !== 0
                ? `${summary.total_overtime > 0 ? '+' : ''}${summary.total_overtime}`
                : '0'}
              color={summary.total_overtime > 0 ? 'var(--lcars-green)' : summary.total_overtime < 0 ? 'var(--lcars-tomato)' : 'var(--lcars-gray)'}
            />
            <LCARSStat
              label="Months Logged"
              value={`${summary.months_entered} / 12`}
              color="var(--lcars-african-violet)"
            />
          </div>
        </LCARSPanel>
      )}

      {/* Month Bars */}
      <LCARSPanel
        title={`Duty Log // ${year}`}
        color="var(--lcars-sunflower)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {months.map(m => (
            <LCARSMonthRow
              key={m.month}
              month={m}
              isMobile={isMobile}
              onClick={() => openEdit(m)}
            />
          ))}
        </div>
      </LCARSPanel>

      {/* Edit Modal */}
      <LCARSModal
        isOpen={!!editingMonth}
        onClose={() => setEditingMonth(null)}
        title={editingMonth ? `${editingMonth.month_name} ${editingMonth.year}` : ''}
        color="var(--lcars-tanoi)"
      >
        {editingMonth && (
          <div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.78rem',
              color: 'var(--lcars-gray)',
              marginBottom: '1.25rem',
            }}>
              Business Days: {editingMonth.business_days} &middot; Required: {editingMonth.required_hours}h
            </div>

            <label style={{
              display: 'block',
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--lcars-tanoi)',
              marginBottom: '0.5rem',
            }}>
              Hours Worked
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              placeholder="e.g. 168"
              autoFocus
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                border: '2px solid var(--lcars-tanoi)',
                borderRadius: '0',
                background: '#000000',
                color: 'var(--lcars-space-white)',
                fontSize: '1.1rem',
                fontFamily: "'JetBrains Mono', monospace",
                marginBottom: '1.25rem',
                boxSizing: 'border-box',
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditingMonth(null)}
                style={{
                  padding: '0.375rem 1rem',
                  border: '1px solid var(--lcars-gray)',
                  background: 'transparent',
                  color: 'var(--lcars-gray)',
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '0.375rem 1rem',
                  border: 'none',
                  background: 'var(--lcars-tanoi)',
                  color: 'var(--lcars-text-on-color)',
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  cursor: saving ? 'wait' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Saving...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </LCARSModal>
    </div>
  )
}


/**
 * LCARS-styled month row with horizontal bar readout.
 */
function LCARSMonthRow({ month, isMobile, onClick }) {
  const { month_name, hours_worked, required_hours } = month
  const hasData = hours_worked !== null && hours_worked !== undefined
  const maxVal = hasData ? Math.max(hours_worked, required_hours) : required_hours

  let straightWidth = 0
  let extraWidth = 0
  let extraColor = ''

  if (hasData && maxVal > 0) {
    const straightTime = Math.min(hours_worked, required_hours)
    straightWidth = (straightTime / maxVal) * 100

    if (hours_worked > required_hours) {
      extraWidth = ((hours_worked - required_hours) / maxVal) * 100
      extraColor = 'var(--lcars-gold)'
    } else if (hours_worked < required_hours) {
      extraWidth = ((required_hours - hours_worked) / maxVal) * 100
      extraColor = 'var(--lcars-red-alert)'
    }
  }

  const displayName = isMobile ? month_name.slice(0, 3).toUpperCase() : month_name.toUpperCase()

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '40px 1fr 65px' : '80px 1fr 110px',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem 0.25rem',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 204, 153, 0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Month label */}
      <span style={{
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        fontSize: '0.78rem',
        fontWeight: 600,
        color: 'var(--lcars-almond-creme)',
        letterSpacing: '0.04em',
      }}>
        {displayName}
      </span>

      {/* Bar */}
      <div style={{
        height: '20px',
        background: 'rgba(102, 102, 136, 0.1)',
        overflow: 'hidden',
        display: 'flex',
        border: '1px solid rgba(102, 102, 136, 0.2)',
      }}>
        {hasData ? (
          <>
            {/* Straight time (sunflower) */}
            <div style={{
              width: `${straightWidth}%`,
              height: '100%',
              background: 'var(--lcars-sunflower)',
              transition: 'width 0.3s ease',
            }} />
            {/* Extra segment (overtime gold or deficit red) */}
            {extraWidth > 0 && (
              <div style={{
                width: `${extraWidth}%`,
                height: '100%',
                background: extraColor,
                opacity: hours_worked < required_hours ? 0.5 : 1,
                transition: 'width 0.3s ease',
              }} />
            )}
          </>
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: 'rgba(102, 102, 136, 0.15)',
          }} />
        )}
      </div>

      {/* Hours readout */}
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.72rem',
        color: hasData ? 'var(--lcars-space-white)' : 'var(--lcars-gray)',
        textAlign: 'right',
        whiteSpace: 'nowrap',
      }}>
        {hasData ? `${hours_worked} / ${required_hours}` : `— / ${required_hours}`}
      </span>
    </div>
  )
}


function LCARSLoadingSkeleton() {
  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{
        height: '1.5rem',
        width: '200px',
        background: 'rgba(102, 102, 136, 0.2)',
        marginBottom: '1.5rem',
      }} />
      <div style={{
        height: '120px',
        background: 'rgba(102, 102, 136, 0.06)',
        border: '1px solid rgba(102, 102, 136, 0.15)',
        marginBottom: '1rem',
      }} />
      <div style={{
        height: '500px',
        background: 'rgba(102, 102, 136, 0.06)',
        border: '1px solid rgba(102, 102, 136, 0.15)',
      }} />
    </div>
  )
}
