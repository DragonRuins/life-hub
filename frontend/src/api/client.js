/**
 * API Helper for Life Hub
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
  getSummary: () => apiFetch("/dashboard/summary"),
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
  categories: () => apiFetch("/notes/categories"),
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
