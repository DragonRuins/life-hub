/**
 * Watch Data Pipeline API Helper
 *
 * Standalone API module for the Watch data pipeline.
 * Duplicates the apiFetch() wrapper from client.js since
 * we cannot modify that file (Session 4 creates new files only).
 *
 * Exports:
 *   watchHealth   — Health metrics (getLatest, query)
 *   watchNFC      — NFC actions, timers, events (CRUD + lists)
 *   watchBarometer — Barometric pressure data (query)
 *   watchSync     — Pipeline sync status
 */

const API_BASE = '/api'

/**
 * Generic fetch wrapper with error handling.
 * Mirrors the pattern from client.js.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }

  const response = await fetch(url, config)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

// ── Watch Health ──────────────────────────────────────────────

export const watchHealth = {
  /** Get the latest reading for all (or filtered) health metrics */
  getLatest: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/watch/health/latest${query ? '?' + query : ''}`)
  },

  /** Query health metric history with filters (type, start, end, limit) */
  query: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/watch/health/query${query ? '?' + query : ''}`)
  },
}

// ── Watch NFC ────────────────────────────────────────────────

export const watchNFC = {
  /** List all NFC action definitions */
  listActions: () => apiFetch('/watch/nfc/actions'),

  /** Create a new NFC action */
  createAction: (data) => apiFetch('/watch/nfc/actions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  /** Update an existing NFC action */
  updateAction: (id, data) => apiFetch(`/watch/nfc/actions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  /** Delete an NFC action */
  deleteAction: (id) => apiFetch(`/watch/nfc/actions/${id}`, {
    method: 'DELETE',
  }),

  /** List NFC timer entries with optional filters */
  listTimers: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/watch/nfc/timers${query ? '?' + query : ''}`)
  },

  /** List NFC tap events with optional filters */
  listEvents: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/watch/nfc/events${query ? '?' + query : ''}`)
  },
}

// ── Watch Barometer ──────────────────────────────────────────

export const watchBarometer = {
  /** Query barometric pressure data with date range */
  query: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/watch/barometer/query${query ? '?' + query : ''}`)
  },
}

// ── Watch Sync ───────────────────────────────────────────────

export const watchSync = {
  /** Get current sync pipeline status for all watch data sources */
  status: () => apiFetch('/watch/sync/status'),
}
