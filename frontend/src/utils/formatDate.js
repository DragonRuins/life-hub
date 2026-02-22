/**
 * formatDate.js - Centralized date formatting utility
 *
 * All user-facing dates should use these functions so the format
 * is consistent across the entire application (MM-DD-YYYY).
 *
 * Usage:
 *   import { formatDate } from '../utils/formatDate'
 *   formatDate('2025-01-15')        → "01-15-2025"
 *   formatDate(someDate)            → "01-15-2025"
 *   formatShortDate('2025-01-15')   → "Jan 15"
 */

/**
 * Format a date as MM-DD-YYYY.
 * Accepts ISO strings ("2025-01-15"), Date objects, or timestamps.
 * Returns empty string for null/undefined/invalid input.
 */
export function formatDate(input) {
  if (!input) return ''
  const d = typeof input === 'string' ? parseDate(input) : new Date(input)
  if (isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${mm}-${dd}-${yyyy}`
}

/**
 * Format a date as a short label (e.g., "Jan 15").
 * Used for chart axes, compact displays, and relative contexts
 * where the year is implied.
 */
export function formatShortDate(input) {
  if (!input) return ''
  const d = typeof input === 'string' ? parseDate(input) : new Date(input)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Format a date as a short label with year (e.g., "Jan 15, 2025").
 * Used for service intervals and other contexts where year matters
 * but full MM-DD-YYYY is too terse.
 */
export function formatShortDateWithYear(input) {
  if (!input) return ''
  const d = typeof input === 'string' ? parseDate(input) : new Date(input)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Parse a date string safely.
 * Handles ISO date-only strings ("2025-01-15") by treating them as local
 * dates rather than UTC (which would shift the day in negative UTC offsets).
 */
function parseDate(str) {
  // Date-only strings like "2025-01-15" get parsed as UTC midnight,
  // which can display as the previous day in western timezones.
  // Split and construct locally to avoid this.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return new Date(str)
}
