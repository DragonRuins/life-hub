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
