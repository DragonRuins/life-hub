/**
 * History Tab
 *
 * Paginated notification log with summary stats and filters.
 * Shows every notification that was sent (or attempted), with:
 *   - Summary stat cards at the top (total 24h, failed, success rate, most active rule)
 *   - Filters: status, channel type, priority
 *   - Paginated table of log entries with expandable rows
 *   - Columns: status icon, title, channel type, rule name, priority, timestamp, duration
 */
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Activity, AlertTriangle, TrendingUp, Star } from 'lucide-react'
import { notifications } from '../../api/client'

// Priority badge styles
const PRIORITY_STYLES = {
  low: { bg: 'rgba(148, 226, 213, 0.1)', color: 'var(--color-teal)' },
  normal: { bg: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)' },
  high: { bg: 'rgba(250, 179, 135, 0.1)', color: 'var(--color-peach)' },
  critical: { bg: 'rgba(243, 139, 168, 0.1)', color: 'var(--color-red)' },
}

export default function HistoryTab() {
  const [stats, setStats] = useState(null)
  const [logData, setLogData] = useState({ items: [], total: 0, page: 1, pages: 0 })
  const [loading, setLoading] = useState(true)

  // Filter state
  const [filters, setFilters] = useState({ status: '', channel_type: '', priority: '' })

  // Current page
  const [page, setPage] = useState(1)
  const perPage = 25

  // Track which rows are expanded (shows body + error message)
  const [expandedRows, setExpandedRows] = useState(new Set())

  // ── Data loading ────────────────────────────────────────────

  /** Load summary stats */
  async function loadStats() {
    try {
      const data = await notifications.stats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load notification stats:', err)
    }
  }

  /** Load paginated log entries with filters */
  async function loadLog() {
    try {
      const params = { page, per_page: perPage }
      if (filters.status) params.status = filters.status
      if (filters.channel_type) params.channel_type = filters.channel_type
      if (filters.priority) params.priority = filters.priority

      const data = await notifications.log(params)
      setLogData(data)
    } catch (err) {
      console.error('Failed to load notification log:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load stats once on mount, reload log when page or filters change
  useEffect(() => { loadStats() }, [])
  useEffect(() => { loadLog() }, [page, filters])

  // ── Handlers ────────────────────────────────────────────────

  /** Update a filter value and reset to page 1 */
  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(1)
  }

  /** Toggle row expansion to show body/error details */
  function toggleRow(logId) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  /** Format an ISO timestamp for display */
  function formatTimestamp(isoString) {
    if (!isoString) return '--'
    const date = new Date(isoString)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
           ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  /** Format delivery duration in ms */
  function formatDuration(ms) {
    if (ms == null) return '--'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div>
      {/* Summary stat cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {/* Total sent in 24h */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <Activity size={16} style={{ color: 'var(--color-blue)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Sent (24h)
              </span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.total_sent_24h}</div>
          </div>

          {/* Failed in 24h */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <AlertTriangle size={16} style={{ color: 'var(--color-red)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Failed (24h)
              </span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stats.failed_24h > 0 ? 'var(--color-red)' : 'var(--color-text)' }}>
              {stats.failed_24h}
            </div>
          </div>

          {/* Success rate */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <TrendingUp size={16} style={{ color: 'var(--color-green)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Success Rate
              </span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-green)' }}>
              {stats.success_rate}%
            </div>
          </div>

          {/* Most active rule */}
          <div className="card" style={{ padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <Star size={16} style={{ color: 'var(--color-yellow)' }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Most Active Rule
              </span>
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              {stats.most_active_rule?.name || 'None'}
            </div>
            {stats.most_active_rule && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)' }}>
                {stats.most_active_rule.count} notifications
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters row */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.7rem' }}>Status</label>
          <select
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
            style={{ minWidth: '120px' }}
          >
            <option value="">All</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.7rem' }}>Channel Type</label>
          <select
            value={filters.channel_type}
            onChange={e => handleFilterChange('channel_type', e.target.value)}
            style={{ minWidth: '120px' }}
          >
            <option value="">All</option>
            <option value="pushover">Pushover</option>
            <option value="discord">Discord</option>
            <option value="email">Email</option>
            <option value="in_app">In-App</option>
            <option value="sms">SMS</option>
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.7rem' }}>Priority</label>
          <select
            value={filters.priority}
            onChange={e => handleFilterChange('priority', e.target.value)}
            style={{ minWidth: '120px' }}
          >
            <option value="">All</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Log entries */}
      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading history...</p>
      ) : logData.items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>
            No notification history found. Notifications will appear here once rules start firing.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {logData.items.map(entry => {
            const isExpanded = expandedRows.has(entry.id)
            const priorityStyle = PRIORITY_STYLES[entry.priority] || PRIORITY_STYLES.normal

            return (
              <div key={entry.id} className="card" style={{ padding: '0.75rem 1rem', cursor: 'pointer' }}>
                {/* Main row */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
                  onClick={() => toggleRow(entry.id)}
                >
                  {/* Status icon */}
                  {entry.status === 'sent' || entry.status === 'read' ? (
                    <CheckCircle size={16} style={{ color: 'var(--color-green)', flexShrink: 0 }} />
                  ) : entry.status === 'failed' ? (
                    <XCircle size={16} style={{ color: 'var(--color-red)', flexShrink: 0 }} />
                  ) : (
                    <Clock size={16} style={{ color: 'var(--color-yellow)', flexShrink: 0 }} />
                  )}

                  {/* Title (or truncated body if no title) */}
                  <span style={{
                    flex: 1, fontSize: '0.875rem', fontWeight: 500, minWidth: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {entry.title || entry.body?.substring(0, 60) || 'Untitled'}
                  </span>

                  {/* Channel type badge */}
                  <span style={{
                    fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                    background: 'var(--color-surface-0)', color: 'var(--color-overlay-1)', flexShrink: 0,
                  }}>
                    {entry.channel_type}
                  </span>

                  {/* Priority badge */}
                  <span style={{
                    fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '4px',
                    background: priorityStyle.bg, color: priorityStyle.color, flexShrink: 0,
                  }}>
                    {entry.priority}
                  </span>

                  {/* Timestamp */}
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {formatTimestamp(entry.sent_at)}
                  </span>

                  {/* Duration */}
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', flexShrink: 0, width: '50px', textAlign: 'right' }}>
                    {formatDuration(entry.delivery_duration_ms)}
                  </span>

                  {/* Expand indicator */}
                  {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--color-overlay-0)', flexShrink: 0 }} /> :
                               <ChevronDown size={14} style={{ color: 'var(--color-overlay-0)', flexShrink: 0 }} />}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    marginTop: '0.75rem', paddingTop: '0.75rem',
                    borderTop: '1px solid var(--color-surface-0)',
                  }}>
                    {/* Body text */}
                    {entry.body && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)', fontWeight: 500 }}>Body:</span>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                          {entry.body}
                        </p>
                      </div>
                    )}

                    {/* Error message (only shown for failed notifications) */}
                    {entry.error_message && (
                      <div style={{
                        padding: '0.5rem 0.75rem', borderRadius: '6px',
                        background: 'rgba(243, 139, 168, 0.08)', border: '1px solid rgba(243, 139, 168, 0.15)',
                        marginBottom: '0.5rem',
                      }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-red)', fontWeight: 500 }}>Error:</span>
                        <p style={{ fontSize: '0.8rem', color: 'var(--color-red)', marginTop: '0.125rem' }}>
                          {entry.error_message}
                        </p>
                      </div>
                    )}

                    {/* Metadata: rule ID, channel ID */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--color-overlay-0)' }}>
                      {entry.rule_id && <span>Rule ID: {entry.rule_id}</span>}
                      {entry.channel_id && <span>Channel ID: {entry.channel_id}</span>}
                      <span>Status: {entry.status}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination controls */}
      {logData.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1.25rem' }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-subtext-0)' }}>
            Page {logData.page} of {logData.pages}
            <span style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginLeft: '0.5rem' }}>
              ({logData.total} total)
            </span>
          </span>
          <button
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem' }}
            onClick={() => setPage(p => Math.min(logData.pages, p + 1))}
            disabled={page >= logData.pages}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
