/**
 * Work Hours Page (Catppuccin Theme)
 *
 * Tracks monthly hours worked against a 40-hour work week.
 * Shows 12 horizontal bar rows (one per month) color-coded:
 *   - Green: hours worked up to required
 *   - Amber: overtime beyond required
 *   - Red: deficit below required
 *   - Gray: not yet entered
 *
 * Click any month row to open an edit modal.
 *
 * Route: /work-hours
 */
import { useState, useEffect, useCallback } from 'react'
import { Clock } from 'lucide-react'
import useIsMobile from '../hooks/useIsMobile'
import { workHours } from '../api/client'

export default function WorkHours() {
  const isMobile = useIsMobile()
  const currentYear = new Date().getFullYear()

  const [year, setYear] = useState(currentYear)
  const [months, setMonths] = useState([])
  const [summary, setSummary] = useState(null)
  const [years, setYears] = useState([currentYear])
  const [editingMonth, setEditingMonth] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load year data and summary
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

  // Handle month update from modal
  async function handleSave(month, hoursWorked) {
    try {
      await workHours.updateMonth(year, month, { hours_worked: hoursWorked })
      setEditingMonth(null)
      loadData(year)
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  }

  if (loading && months.length === 0) return <LoadingSkeleton />

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={24} style={{ color: 'var(--color-blue)' }} />
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Work Hours
          </h1>
        </div>
        <select
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            background: 'var(--color-surface-0)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-surface-1)',
            fontSize: '0.9rem',
            cursor: 'pointer',
          }}
        >
          {years.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Stats Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          <StatCard
            label="Hours Worked"
            value={summary.total_hours > 0 ? summary.total_hours.toLocaleString() : '0'}
            color="var(--color-blue)"
          />
          <StatCard
            label="Required"
            value={summary.total_required > 0 ? summary.total_required.toLocaleString() : '0'}
            color="var(--color-subtext-0)"
          />
          <StatCard
            label="Overtime"
            value={summary.total_overtime !== 0 ? `${summary.total_overtime > 0 ? '+' : ''}${summary.total_overtime}` : '0'}
            color={summary.total_overtime > 0 ? 'var(--color-green)' : summary.total_overtime < 0 ? 'var(--color-red)' : 'var(--color-subtext-0)'}
          />
          <StatCard
            label="Months Logged"
            value={`${summary.months_entered} / 12`}
            color="var(--color-mauve)"
          />
        </div>
      )}

      {/* Month Bars */}
      <div className="card" style={{ padding: '1rem 1.25rem' }}>
        <h3 style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          color: 'var(--color-subtext-0)',
          marginBottom: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          Monthly Breakdown
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {months.map(m => (
            <MonthRow
              key={m.month}
              month={m}
              isMobile={isMobile}
              onClick={() => setEditingMonth(m)}
            />
          ))}
        </div>
      </div>

      {/* Edit Modal */}
      {editingMonth && (
        <EditModal
          month={editingMonth}
          onSave={handleSave}
          onClose={() => setEditingMonth(null)}
        />
      )}
    </div>
  )
}


/**
 * A single month row with horizontal bar visualization.
 */
function MonthRow({ month, isMobile, onClick }) {
  const { month_name, hours_worked, required_hours } = month
  const hasData = hours_worked !== null && hours_worked !== undefined
  const maxVal = hasData ? Math.max(hours_worked, required_hours) : required_hours

  // Bar segment widths as percentages
  let greenWidth = 0
  let extraWidth = 0
  let extraColor = ''

  if (hasData && maxVal > 0) {
    const straightTime = Math.min(hours_worked, required_hours)
    greenWidth = (straightTime / maxVal) * 100

    if (hours_worked > required_hours) {
      // Overtime (amber)
      extraWidth = ((hours_worked - required_hours) / maxVal) * 100
      extraColor = 'var(--color-peach)'
    } else if (hours_worked < required_hours) {
      // Deficit (red)
      extraWidth = ((required_hours - hours_worked) / maxVal) * 100
      extraColor = 'var(--color-red)'
    }
  }

  // Short month name for mobile
  const displayName = isMobile ? month_name.slice(0, 3) : month_name

  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '40px 1fr 60px' : '90px 1fr 100px',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.25rem',
        cursor: 'pointer',
        borderRadius: '6px',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-0)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {/* Month label */}
      <span style={{
        fontSize: '0.85rem',
        fontWeight: 600,
        color: 'var(--color-text)',
      }}>
        {displayName}
      </span>

      {/* Bar */}
      <div style={{
        height: '24px',
        borderRadius: '4px',
        background: 'var(--color-surface-0)',
        overflow: 'hidden',
        display: 'flex',
        position: 'relative',
      }}>
        {hasData ? (
          <>
            {/* Green (straight time) */}
            <div style={{
              width: `${greenWidth}%`,
              height: '100%',
              background: 'var(--color-green)',
              borderRadius: hours_worked >= required_hours ? '4px 0 0 4px' : '4px',
              transition: 'width 0.3s ease',
            }} />
            {/* Extra segment (overtime amber or deficit red) */}
            {extraWidth > 0 && (
              <div style={{
                width: `${extraWidth}%`,
                height: '100%',
                background: extraColor,
                opacity: hours_worked < required_hours ? 0.4 : 1,
                borderRadius: hours_worked > required_hours ? '0 4px 4px 0' : '0',
                transition: 'width 0.3s ease',
              }} />
            )}
          </>
        ) : (
          /* Gray placeholder */
          <div style={{
            width: '100%',
            height: '100%',
            background: 'var(--color-surface-1)',
            opacity: 0.5,
          }} />
        )}
      </div>

      {/* Hours label */}
      <span style={{
        fontSize: '0.78rem',
        color: hasData ? 'var(--color-text)' : 'var(--color-overlay-0)',
        textAlign: 'right',
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'nowrap',
      }}>
        {hasData ? `${hours_worked} / ${required_hours}` : `— / ${required_hours}`}
      </span>
    </div>
  )
}


/**
 * Stat card for the summary row.
 */
function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '1rem' }}>
      <div style={{
        fontSize: '0.75rem',
        color: 'var(--color-subtext-0)',
        fontWeight: 500,
        marginBottom: '0.25rem',
      }}>
        {label}
      </div>
      <div style={{
        fontSize: '1.5rem',
        fontWeight: 700,
        color,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
    </div>
  )
}


/**
 * Edit modal for updating hours_worked on a month.
 */
function EditModal({ month, onSave, onClose }) {
  const [value, setValue] = useState(
    month.hours_worked !== null && month.hours_worked !== undefined
      ? String(month.hours_worked)
      : ''
  )
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const hours = value.trim() === '' ? null : parseFloat(value)
    if (hours !== null && (isNaN(hours) || hours < 0)) {
      alert('Please enter a valid number of hours (or leave blank to clear)')
      setSaving(false)
      return
    }
    await onSave(month.month, hours)
    setSaving(false)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.5)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 'min(400px, calc(100vw - 2rem))',
          background: 'var(--color-base)',
          border: '1px solid var(--color-surface-1)',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}
      >
        <h3 style={{
          fontSize: '1.1rem',
          fontWeight: 700,
          marginBottom: '0.25rem',
        }}>
          {month.month_name} {month.year}
        </h3>
        <p style={{
          fontSize: '0.8rem',
          color: 'var(--color-subtext-0)',
          marginBottom: '1.25rem',
        }}>
          {month.business_days} business days &middot; {month.required_hours} hours required
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{
            display: 'block',
            fontSize: '0.8rem',
            color: 'var(--color-subtext-0)',
            marginBottom: '0.5rem',
          }}>
            Hours Worked
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="e.g. 168"
            autoFocus
            style={{
              width: '100%',
              padding: '0.625rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--color-surface-1)',
              background: 'var(--color-surface-0)',
              color: 'var(--color-text)',
              fontSize: '1.1rem',
              fontFamily: "'JetBrains Mono', monospace",
              marginBottom: '1.25rem',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              style={{ fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ fontSize: '0.85rem' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


function LoadingSkeleton() {
  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ height: '2rem', width: '200px', background: 'var(--color-surface-0)', borderRadius: '8px', marginBottom: '1.5rem' }} />
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '0.75rem',
        marginBottom: '1.5rem',
      }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: '80px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
        ))}
      </div>
      <div style={{ height: '500px', background: 'var(--color-surface-0)', borderRadius: '12px', opacity: 0.3 }} />
    </div>
  )
}
