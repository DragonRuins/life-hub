/**
 * API Helper for Datacore
 *
 * Centralizes all HTTP requests to backend.
 * Components import functions from here instead of
 * calling fetch() directly. This means if API
 * URL changes, you only update it in one place.
 */

const API_BASE = '/api'

/**
 * Generic fetch wrapper with error handling.
 */
async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`
  const config = {
    headers: { "Content-Type": "application/json" },
    ...options,
  }

  const response = await fetch(url, config)
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

// ── Dashboard ─────────────────────────────────────────────────

export const dashboard = {
  getWeather: () => apiFetch("/dashboard/weather"),
  getSummary: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/dashboard/summary${query ? '?' + query : ''}`)
  },
  getFleetStatus: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/dashboard/fleet-status${query ? '?' + query : ''}`)
  },
  getSystemStats: () => apiFetch("/dashboard/system-stats"),
}

// ── Vehicles ──────────────────────────────────────────────────

export const vehicles = {
  list: () => apiFetch("/vehicles/"),
  get: (id) => apiFetch(`/vehicles/${id}`),
  create: (data) => apiFetch("/vehicles/", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiFetch(`/vehicles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  delete: (id) => apiFetch(`/vehicles/${id}`, {
    method: "DELETE",
  }),
  setPrimary: (id) => apiFetch(`/vehicles/${id}/set-primary`, {
    method: "PUT",
  }),

  // Maintenance logs
  addMaintenance: (vehicleId, data) => apiFetch(`/vehicles/${vehicleId}/maintenance`, {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateMaintenance: (logId, data) => apiFetch(`/vehicles/maintenance/${logId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  deleteMaintenance: (logId) => apiFetch(`/vehicles/maintenance/${logId}`, {
    method: "DELETE",
  }),

  // Maintenance Items (global catalog)
  maintenanceItems: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/vehicles/maintenance-items${query ? '?' + query : ''}`)
    },
    create: (data) => apiFetch('/vehicles/maintenance-items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/vehicles/maintenance-items/${id}`, {
      method: 'DELETE',
    }),
  },

  // Vehicle Maintenance Intervals
  intervals: {
    list: (vehicleId) => apiFetch(`/vehicles/${vehicleId}/intervals`),
    create: (vehicleId, data) => apiFetch(`/vehicles/${vehicleId}/intervals`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (intervalId, data) => apiFetch(`/vehicles/intervals/${intervalId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (intervalId) => apiFetch(`/vehicles/intervals/${intervalId}`, {
      method: 'DELETE',
    }),
    setupDefaults: (vehicleId) => apiFetch(`/vehicles/${vehicleId}/intervals/setup-defaults`, {
      method: 'POST',
    }),
  },

  // Vehicle components (tires, battery, etc.)
  components: {
    list: (vehicleId, params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/vehicles/${vehicleId}/components${query ? "?" + query : ""}`)
    },
    get: (componentId) => apiFetch(`/vehicles/components/${componentId}`),
    create: (vehicleId, data) => apiFetch(`/vehicles/${vehicleId}/components`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (componentId, data) => apiFetch(`/vehicles/components/${componentId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (componentId) => apiFetch(`/vehicles/components/${componentId}`, {
      method: "DELETE",
    }),

    // Helper methods for common queries
    getActive: (vehicleId) => apiFetch(`/vehicles/${vehicleId}/components?active=true`),
    getArchived: (vehicleId) => apiFetch(`/vehicles/${vehicleId}/components?active=false`),
    getByType: (vehicleId, type) => apiFetch(`/vehicles/${vehicleId}/components?type=${type}`),

    // Component logs (service history for a component)
    addLog: (componentId, data) => apiFetch(`/vehicles/components/${componentId}/logs`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateLog: (logId, data) => apiFetch(`/vehicles/component-logs/${logId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteLog: (logId) => apiFetch(`/vehicles/component-logs/${logId}`, {
      method: "DELETE",
    }),
  },

  // Tire Sets
  tireSets: {
    list: (vehicleId) => apiFetch(`/vehicles/${vehicleId}/tire-sets`),
    get: (setId) => apiFetch(`/vehicles/tire-sets/${setId}`),
    create: (vehicleId, data) => apiFetch(`/vehicles/${vehicleId}/tire-sets`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (setId, data) => apiFetch(`/vehicles/tire-sets/${setId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    delete: (setId) => apiFetch(`/vehicles/tire-sets/${setId}`, {
      method: "DELETE",
    }),
    swap: (setId) => apiFetch(`/vehicles/tire-sets/${setId}/swap`, {
      method: "POST",
    }),
  },

  // Fuel Logs
  fuelLogs: {
    list: (vehicleId) => apiFetch(`/vehicles/${vehicleId}/fuel-logs`),
    get: (logId) => apiFetch(`/vehicles/fuel-logs/${logId}`),
    create: (vehicleId, data) => apiFetch(`/vehicles/${vehicleId}/fuel-logs`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (logId, data) => apiFetch(`/vehicles/fuel-logs/${logId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    delete: (logId) => apiFetch(`/vehicles/fuel-logs/${logId}`, {
      method: "DELETE",
    }),
  },
}

// ── Fuel Economy ─────────────────────────────────────────────

export const fuel = {
  // List fuel entries for a vehicle (uses the /api/fuel/ blueprint)
  entries: (vehicleId) => apiFetch(`/fuel/entries?vehicle_id=${vehicleId}`),
  // Get computed stats for a vehicle
  stats: (vehicleId) => apiFetch(`/fuel/stats?vehicle_id=${vehicleId}`),
  // Delete a fuel entry
  deleteEntry: (id) => apiFetch(`/fuel/entries/${id}`, { method: "DELETE" }),
}

// ── Notes ─────────────────────────────────────────────────────

export const notes = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/notes/${query ? "?" + query : ""}`)
  },
  get: (id) => apiFetch(`/notes/${id}`),
  create: (data) => apiFetch("/notes/", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiFetch(`/notes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  delete: (id) => apiFetch(`/notes/${id}`, {
    method: "DELETE",
  }),
  restore: (id) => apiFetch(`/notes/${id}/restore`, { method: "PUT" }),
  permanentDelete: (id) => apiFetch(`/notes/${id}/permanent`, { method: "DELETE" }),
  emptyTrash: () => apiFetch("/notes/empty-trash", { method: "POST" }),
  move: (id, folderId) => apiFetch(`/notes/${id}/move`, {
    method: "POST",
    body: JSON.stringify({ folder_id: folderId }),
  }),
  recent: (limit = 10) => apiFetch(`/notes/recent?limit=${limit}`),
  stats: () => apiFetch("/notes/stats"),

  // Tags
  tags: {
    list: () => apiFetch("/notes/tags"),
    create: (data) => apiFetch("/notes/tags", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/notes/tags/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/notes/tags/${id}`, { method: "DELETE" }),
  },
}

// ── Folders ───────────────────────────────────────────────────

export const folders = {
  list: () => apiFetch("/folders/"),
  create: (data) => apiFetch("/folders/", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  update: (id, data) => apiFetch(`/folders/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  }),
  delete: (id, action = 'move_to_root') => apiFetch(`/folders/${id}?action=${action}`, {
    method: "DELETE",
  }),
  reorder: (id, position) => apiFetch(`/folders/${id}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ position }),
  }),
}

// ── Attachments ───────────────────────────────────────────────

/**
 * Upload helper - sends FormData without setting Content-Type header
 * so the browser can set the correct multipart boundary.
 */
async function apiUpload(path, file, extraFields = {}) {
  const formData = new FormData()
  formData.append('file', file)
  for (const [key, value] of Object.entries(extraFields)) {
    formData.append(key, value)
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export const attachments = {
  upload: (file, noteId) => apiUpload('/attachments/upload', file, noteId ? { note_id: noteId } : {}),
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/attachments/${query ? '?' + query : ''}`)
  },
  get: (id) => apiFetch(`/attachments/${id}`),
  delete: (id, force = false) => apiFetch(`/attachments/${id}${force ? '?force=true' : ''}`, {
    method: 'DELETE',
  }),
  fileUrl: (id) => `${API_BASE}/attachments/${id}/file`,
}

// ── Projects ─────────────────────────────────────────────────

export const projects = {
  list: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/projects/${query ? '?' + query : ''}`)
  },
  get: (slug) => apiFetch(`/projects/${slug}`),
  create: (data) => apiFetch('/projects/', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  update: (slug, data) => apiFetch(`/projects/${slug}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: (slug) => apiFetch(`/projects/${slug}`, { method: 'DELETE' }),
  reorder: (ids) => apiFetch('/projects/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  }),
  stats: () => apiFetch('/projects/stats'),

  // Tech Stack
  techStack: {
    list: (slug) => apiFetch(`/projects/${slug}/tech-stack`),
    add: (slug, data) => apiFetch(`/projects/${slug}/tech-stack`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/projects/tech-stack/${id}`, { method: 'DELETE' }),
  },

  // Tags (global project tags)
  tags: {
    list: () => apiFetch('/projects/tags'),
    create: (data) => apiFetch('/projects/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/projects/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/projects/tags/${id}`, { method: 'DELETE' }),
    assign: (slug, tagId) => apiFetch(`/projects/${slug}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_id: tagId }),
    }),
    remove: (slug, tagId) => apiFetch(`/projects/${slug}/tags/${tagId}`, { method: 'DELETE' }),
  },

  // Kanban Columns
  columns: {
    list: (slug) => apiFetch(`/projects/${slug}/columns`),
    create: (slug, data) => apiFetch(`/projects/${slug}/columns`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/projects/columns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/projects/columns/${id}`, { method: 'DELETE' }),
    reorder: (slug, ids) => apiFetch(`/projects/${slug}/columns/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ ids }),
    }),
  },

  // Tasks
  tasks: {
    list: (slug, params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/projects/${slug}/tasks${query ? '?' + query : ''}`)
    },
    get: (id) => apiFetch(`/projects/tasks/${id}`),
    create: (slug, data) => apiFetch(`/projects/${slug}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/projects/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/projects/tasks/${id}`, { method: 'DELETE' }),
    move: (id, data) => apiFetch(`/projects/tasks/${id}/move`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    batchReorder: (slug, items) => apiFetch(`/projects/${slug}/tasks/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),
  },

  // Changelog
  changelog: {
    list: (slug, params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/projects/${slug}/changelog${query ? '?' + query : ''}`)
    },
    create: (slug, data) => apiFetch(`/projects/${slug}/changelog`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/projects/changelog/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/projects/changelog/${id}`, { method: 'DELETE' }),
  },
}

// ── Knowledge Base ───────────────────────────────────────────

export const kb = {
  // Categories
  categories: {
    list: () => apiFetch('/kb/categories'),
    create: (data) => apiFetch('/kb/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/kb/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/kb/categories/${id}`, { method: 'DELETE' }),
    reorder: (data) => apiFetch('/kb/categories/reorder', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },

  // Articles
  articles: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/kb/articles${query ? '?' + query : ''}`)
    },
    get: (slug) => apiFetch(`/kb/articles/${slug}`),
    create: (data) => apiFetch('/kb/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (slug, data) => apiFetch(`/kb/articles/${slug}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (slug) => apiFetch(`/kb/articles/${slug}`, { method: 'DELETE' }),
    backlinks: (slug) => apiFetch(`/kb/articles/${slug}/backlinks`),
    subPages: (slug) => apiFetch(`/kb/articles/${slug}/sub-pages`),
    setParent: (slug, data) => apiFetch(`/kb/articles/${slug}/parent`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    recordView: (slug) => apiFetch(`/kb/articles/${slug}/view`, { method: 'POST' }),
    toggleBookmark: (slug) => apiFetch(`/kb/articles/${slug}/bookmark`, { method: 'POST' }),
  },

  // Tags (Phase 3)
  tags: {
    list: () => apiFetch('/kb/tags'),
    create: (data) => apiFetch('/kb/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/kb/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/kb/tags/${id}`, { method: 'DELETE' }),
  },

  // Revisions
  revisions: {
    list: (slug) => apiFetch(`/kb/articles/${slug}/revisions`),
    get: (slug, revisionId) => apiFetch(`/kb/articles/${slug}/revisions/${revisionId}`),
    restore: (slug, revisionId) => apiFetch(`/kb/articles/${slug}/revisions/${revisionId}/restore`, {
      method: 'POST',
    }),
  },

  // Templates
  templates: {
    list: () => apiFetch('/kb/templates'),
    saveAs: (slug, data) => apiFetch(`/kb/articles/${slug}/save-template`, {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    createFrom: (data) => apiFetch('/kb/articles/from-template', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  },

  // Search
  search: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/kb/search${query ? '?' + query : ''}`)
  },

  // Recently viewed
  recentViews: (limit = 20) => apiFetch(`/kb/recent-views?limit=${limit}`),

  // Bookmarks
  bookmarks: {
    list: () => apiFetch('/kb/bookmarks'),
  },

  // Export (returns blob, not JSON)
  exportArticle: async (slug) => {
    const response = await fetch(`${API_BASE}/kb/articles/${slug}/export`)
    if (!response.ok) throw new Error('Export failed')
    return response
  },

  // Import (multipart upload)
  importArticle: async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${API_BASE}/kb/import`, {
      method: 'POST',
      body: formData,
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Import failed' }))
      throw new Error(err.error || 'Import failed')
    }
    return response.json()
  },

  // Stats
  stats: () => apiFetch('/kb/stats'),
}

// -- Notifications --------------------------------------------------------

export const notifications = {
  // Channels
  channels: {
    list: () => apiFetch("/notifications/channels"),
    get: (id) => apiFetch(`/notifications/channels/${id}`),
    create: (data) => apiFetch("/notifications/channels", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/notifications/channels/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/notifications/channels/${id}`, {
      method: "DELETE",
    }),
    test: (id) => apiFetch(`/notifications/channels/${id}/test`, {
      method: "POST",
    }),
  },

  // Rules
  rules: {
    list: () => apiFetch("/notifications/rules"),
    get: (id) => apiFetch(`/notifications/rules/${id}`),
    create: (data) => apiFetch("/notifications/rules", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/notifications/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/notifications/rules/${id}`, {
      method: "DELETE",
    }),
    trigger: (id) => apiFetch(`/notifications/rules/${id}/trigger`, {
      method: "POST",
    }),
    events: () => apiFetch("/notifications/rules/events"),
    templateVariables: (module) => apiFetch(`/notifications/rules/template-variables/${module}`),
  },

  // Feed (bell icon)
  feed: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/notifications/feed${query ? "?" + query : ""}`)
  },
  unreadCount: () => apiFetch("/notifications/unread-count"),
  markRead: (id) => apiFetch(`/notifications/feed/${id}/read`, { method: "PUT" }),
  markAllRead: () => apiFetch("/notifications/feed/read-all", { method: "PUT" }),

  // Log & stats
  log: (params = {}) => {
    const query = new URLSearchParams(params).toString()
    return apiFetch(`/notifications/log${query ? "?" + query : ""}`)
  },
  stats: () => apiFetch("/notifications/stats"),

  // Config
  schemas: () => apiFetch("/notifications/channels/schemas"),
  settings: () => apiFetch("/notifications/settings"),
  updateSettings: (data) => apiFetch("/notifications/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  }),
}

// ── Astrometrics ──────────────────────────────────────────────────

export const astrometrics = {
  // APOD (Astronomy Picture of the Day)
  apod: {
    get: (date) => {
      const params = date ? `?date=${date}` : ''
      return apiFetch(`/astrometrics/apod${params}`)
    },
    random: () => apiFetch('/astrometrics/apod/random'),
    favorites: {
      list: () => apiFetch('/astrometrics/apod/favorites'),
      save: (data) => apiFetch('/astrometrics/apod/favorites', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      delete: (id) => apiFetch(`/astrometrics/apod/favorites/${id}`, { method: 'DELETE' }),
    },
  },

  // NEO (Near Earth Objects)
  neo: {
    feed: (start, end) => {
      const params = new URLSearchParams()
      if (start) params.set('start', start)
      if (end) params.set('end', end)
      const query = params.toString()
      return apiFetch(`/astrometrics/neo${query ? '?' + query : ''}`)
    },
    closest: () => apiFetch('/astrometrics/neo/closest'),
    hazardous: () => apiFetch('/astrometrics/neo/hazardous'),
  },

  // ISS (International Space Station)
  iss: {
    position: () => apiFetch('/astrometrics/iss/position'),
    crew: () => apiFetch('/astrometrics/iss/crew'),
    passes: (days) => {
      const params = days ? `?days=${days}` : ''
      return apiFetch(`/astrometrics/iss/passes${params}`)
    },
    groundtrack: (minutes) => {
      const params = minutes ? `?minutes=${minutes}` : ''
      return apiFetch(`/astrometrics/iss/groundtrack${params}`)
    },
  },

  // Launches
  launches: {
    upcoming: (limit) => {
      const params = limit ? `?limit=${limit}` : ''
      return apiFetch(`/astrometrics/launches/upcoming${params}`)
    },
    past: (limit) => {
      const params = limit ? `?limit=${limit}` : ''
      return apiFetch(`/astrometrics/launches/past${params}`)
    },
    next: () => apiFetch('/astrometrics/launches/next'),
  },

  // Settings
  settings: {
    get: () => apiFetch('/astrometrics/settings'),
    update: (data) => apiFetch('/astrometrics/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },

  // Cache status
  status: () => apiFetch('/astrometrics/status'),
}

// ── Infrastructure ────────────────────────────────────────────────

export const infrastructure = {
  // Dashboard (aggregated summary)
  dashboard: () => apiFetch('/infrastructure/dashboard'),

  // Hosts
  hosts: {
    list: () => apiFetch('/infrastructure/hosts'),
    get: (id) => apiFetch(`/infrastructure/hosts/${id}`),
    create: (data) => apiFetch('/infrastructure/hosts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/infrastructure/hosts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/infrastructure/hosts/${id}`, { method: 'DELETE' }),
    setupDocker: (id, data) => apiFetch(`/infrastructure/hosts/${id}/setup-docker`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    detectHardware: (id) => apiFetch(`/infrastructure/hosts/${id}/hardware-detect`, { method: 'POST' }),
    liveStats: (id) => apiFetch(`/infrastructure/hosts/${id}/live-stats`),
  },

  // Network devices
  network: {
    list: () => apiFetch('/infrastructure/network'),
    get: (id) => apiFetch(`/infrastructure/network/${id}`),
    create: (data) => apiFetch('/infrastructure/network', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/infrastructure/network/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/infrastructure/network/${id}`, { method: 'DELETE' }),
  },

  // Containers
  containers: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/infrastructure/containers${query ? '?' + query : ''}`)
    },
    get: (id) => apiFetch(`/infrastructure/containers/${id}`),
    create: (data) => apiFetch('/infrastructure/containers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/infrastructure/containers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/infrastructure/containers/${id}`, { method: 'DELETE' }),
    sync: (hostId) => apiFetch(`/infrastructure/containers/sync/${hostId}`, { method: 'POST' }),
  },

  // Services
  services: {
    list: () => apiFetch('/infrastructure/services'),
    get: (id) => apiFetch(`/infrastructure/services/${id}`),
    create: (data) => apiFetch('/infrastructure/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/infrastructure/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/infrastructure/services/${id}`, { method: 'DELETE' }),
    check: (id) => apiFetch(`/infrastructure/services/${id}/check`, { method: 'POST' }),
  },

  // Incidents
  incidents: {
    list: (params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/infrastructure/incidents${query ? '?' + query : ''}`)
    },
    get: (id) => apiFetch(`/infrastructure/incidents/${id}`),
    create: (data) => apiFetch('/infrastructure/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/infrastructure/incidents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/infrastructure/incidents/${id}`, { method: 'DELETE' }),
  },

  // Integrations
  integrations: {
    list: () => apiFetch('/infrastructure/integrations'),
    get: (id) => apiFetch(`/infrastructure/integrations/${id}`),
    create: (data) => apiFetch('/infrastructure/integrations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => apiFetch(`/infrastructure/integrations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/infrastructure/integrations/${id}`, { method: 'DELETE' }),
    test: (id) => apiFetch(`/infrastructure/integrations/${id}/test`, { method: 'POST' }),
    sync: (id) => apiFetch(`/infrastructure/integrations/${id}/sync`, { method: 'POST' }),
    schemas: () => apiFetch('/infrastructure/integrations/schemas'),
  },

  // Metrics
  metrics: {
    query: (params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/infrastructure/metrics${query ? '?' + query : ''}`)
    },
    latest: (sourceType, sourceId) =>
      apiFetch(`/infrastructure/metrics/latest/${sourceType}/${sourceId}`),
  },

  // Smart Home
  smarthome: {
    // Rooms
    rooms: {
      list: () => apiFetch('/infrastructure/smarthome/rooms'),
      create: (data) => apiFetch('/infrastructure/smarthome/rooms', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      update: (id, data) => apiFetch(`/infrastructure/smarthome/rooms/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
      delete: (id) => apiFetch(`/infrastructure/smarthome/rooms/${id}`, { method: 'DELETE' }),
      reorder: (items) => apiFetch('/infrastructure/smarthome/rooms/reorder', {
        method: 'PUT',
        body: JSON.stringify(items),
      }),
    },

    // Devices
    devices: {
      list: (params = {}) => {
        const query = new URLSearchParams(params).toString()
        return apiFetch(`/infrastructure/smarthome/devices${query ? '?' + query : ''}`)
      },
      create: (data) => apiFetch('/infrastructure/smarthome/devices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      update: (id, data) => apiFetch(`/infrastructure/smarthome/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
      delete: (id) => apiFetch(`/infrastructure/smarthome/devices/${id}`, { method: 'DELETE' }),
      history: (id, params = {}) => {
        const query = new URLSearchParams(params).toString()
        return apiFetch(`/infrastructure/smarthome/devices/${id}/history${query ? '?' + query : ''}`)
      },
      bulkImport: (devices) => apiFetch('/infrastructure/smarthome/devices/bulk-import', {
        method: 'POST',
        body: JSON.stringify(devices),
      }),
      bulkUpdate: (deviceIds, updates) => apiFetch('/infrastructure/smarthome/devices/bulk-update', {
        method: 'PUT',
        body: JSON.stringify({ device_ids: deviceIds, updates }),
      }),
      bulkDelete: (deviceIds) => apiFetch('/infrastructure/smarthome/devices/bulk-delete', {
        method: 'DELETE',
        body: JSON.stringify({ device_ids: deviceIds }),
      }),
      control: (id, data) => apiFetch(`/infrastructure/smarthome/devices/${id}/control`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      favorite: (id, data) => apiFetch(`/infrastructure/smarthome/devices/${id}/favorite`, {
        method: 'PUT',
        body: JSON.stringify(data || {}),
      }),
    },

    // Favorites
    favorites: () => apiFetch('/infrastructure/smarthome/favorites'),

    // Discovery & Sync
    discover: (params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/infrastructure/smarthome/discover${query ? '?' + query : ''}`)
    },
    sync: () => apiFetch('/infrastructure/smarthome/sync', { method: 'POST' }),
    dashboard: () => apiFetch('/infrastructure/smarthome/dashboard'),

    // SSE stream for real-time state updates
    stream: {
      connect: (onEvent, onError) => {
        const es = new EventSource('/api/infrastructure/smarthome/stream')
        es.onmessage = (e) => onEvent(JSON.parse(e.data))
        es.onerror = (e) => onError?.(e)
        return es  // caller closes with es.close()
      },
    },
  },

  // 3D Printer
  printer: {
    status: () => apiFetch('/infrastructure/printer/status'),
    current: (deviceId) => apiFetch(`/infrastructure/printer/${deviceId}/current`),
    jobs: (deviceId, params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/infrastructure/printer/${deviceId}/jobs${query ? '?' + query : ''}`)
    },
    job: (deviceId, jobId) => apiFetch(`/infrastructure/printer/${deviceId}/jobs/${jobId}`),
    metrics: (deviceId, params = {}) => {
      const query = new URLSearchParams(params).toString()
      return apiFetch(`/infrastructure/printer/${deviceId}/metrics${query ? '?' + query : ''}`)
    },
    k2plus: (deviceId) => apiFetch(`/infrastructure/printer/${deviceId}/k2plus`),
    cameraStreamUrl: (deviceId) => `/api/infrastructure/smarthome/camera/${deviceId}/stream`,
  },
}

// ── AI Assistant ──────────────────────────────────────────────────

export const ai = {
  conversations: {
    list: () => apiFetch('/ai/conversations'),
    create: (data) => apiFetch('/ai/conversations', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    }),
    get: (id) => apiFetch(`/ai/conversations/${id}`),
    update: (id, data) => apiFetch(`/ai/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => apiFetch(`/ai/conversations/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => apiFetch('/ai/settings'),
    update: (data) => apiFetch('/ai/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  },
  status: () => apiFetch('/ai/status'),
}

// ── Star Trek Database ────────────────────────────────────────────

export const trek = {
  // Daily Entry
  daily: () => apiFetch('/trek/daily'),
  dailyHistory: (limit = 30) => apiFetch(`/trek/daily/history?limit=${limit}`),
  dailyShuffle: () => apiFetch('/trek/daily/shuffle'),

  // Search (live STAPI)
  search: (q, type = 'all') => apiFetch(`/trek/search?q=${encodeURIComponent(q)}&type=${type}`),

  // Browse
  browse: (entityType, page = 0, pageSize = 25, name = '') =>
    apiFetch(`/trek/browse/${entityType}?page=${page}&pageSize=${pageSize}${name ? `&name=${encodeURIComponent(name)}` : ''}`),
  detail: (entityType, uid) => apiFetch(`/trek/browse/${entityType}/${uid}`),

  // Episode Guide
  episodes: {
    series: () => apiFetch('/trek/episodes/series'),
    seasons: (seriesUid) => apiFetch(`/trek/episodes/series/${seriesUid}/seasons`),
    episodes: (seasonUid) => apiFetch(`/trek/episodes/season/${seasonUid}`),
    onThisDay: () => apiFetch('/trek/episodes/on-this-day'),
  },

  // Starship Registry
  ships: {
    list: (page = 0, classUid) =>
      apiFetch(`/trek/ships?page=${page}${classUid ? `&classUid=${classUid}` : ''}`),
    classes: () => apiFetch('/trek/ships/classes'),
    detail: (uid) => apiFetch(`/trek/ships/${uid}`),
    classDetail: (uid) => apiFetch(`/trek/ships/classes/${uid}`),
  },

  // Favorites
  favorites: {
    list: (type = 'all') => apiFetch(`/trek/favorites?type=${type}`),
    add: (data) => apiFetch('/trek/favorites', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/trek/favorites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => apiFetch(`/trek/favorites/${id}`, { method: 'DELETE' }),
  },

  // Settings
  settings: () => apiFetch('/trek/settings'),
  updateSettings: (data) => apiFetch('/trek/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Status + entity types
  status: () => apiFetch('/trek/status'),
  entityTypes: () => apiFetch('/trek/entity-types'),
}

// ── Work Hours ────────────────────────────────────────────────

export const workHours = {
  getYear: (year) => apiFetch(`/work-hours/${year}`),
  updateMonth: (year, month, data) => apiFetch(`/work-hours/${year}/${month}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  getYears: () => apiFetch('/work-hours/years'),
  getSummary: (year) => apiFetch(`/work-hours/summary/${year}`),
}
