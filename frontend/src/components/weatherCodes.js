/**
 * Maps WMO weather codes (used by Open-Meteo) to human-readable
 * descriptions and emoji icons.
 *
 * Full code reference: https://open-meteo.com/en/docs
 */

const weatherCodes = {
  0: { description: 'Clear sky', icon: '☀️' },
  1: { description: 'Mainly clear', icon: '🌤️' },
  2: { description: 'Partly cloudy', icon: '⛅' },
  3: { description: 'Overcast', icon: '☁️' },
  45: { description: 'Foggy', icon: '🌫️' },
  48: { description: 'Rime fog', icon: '🌫️' },
  51: { description: 'Light drizzle', icon: '🌦️' },
  53: { description: 'Moderate drizzle', icon: '🌦️' },
  55: { description: 'Dense drizzle', icon: '🌧️' },
  56: { description: 'Freezing drizzle', icon: '🌧️' },
  57: { description: 'Heavy freezing drizzle', icon: '🌧️' },
  61: { description: 'Light rain', icon: '🌦️' },
  63: { description: 'Moderate rain', icon: '🌧️' },
  65: { description: 'Heavy rain', icon: '🌧️' },
  66: { description: 'Freezing rain', icon: '🌧️' },
  67: { description: 'Heavy freezing rain', icon: '🌧️' },
  71: { description: 'Light snow', icon: '🌨️' },
  73: { description: 'Moderate snow', icon: '🌨️' },
  75: { description: 'Heavy snow', icon: '❄️' },
  77: { description: 'Snow grains', icon: '❄️' },
  80: { description: 'Light showers', icon: '🌦️' },
  81: { description: 'Moderate showers', icon: '🌧️' },
  82: { description: 'Violent showers', icon: '🌧️' },
  85: { description: 'Light snow showers', icon: '🌨️' },
  86: { description: 'Heavy snow showers', icon: '❄️' },
  95: { description: 'Thunderstorm', icon: '⛈️' },
  96: { description: 'Thunderstorm with hail', icon: '⛈️' },
  99: { description: 'Severe thunderstorm', icon: '⛈️' },
}

export function getWeatherInfo(code) {
  return weatherCodes[code] || { description: 'Unknown', icon: '❓' }
}

/**
 * Format a day name from an ISO date string.
 * e.g., "2025-02-12" → "Wed"
 */
export function getDayName(dateStr) {
  const date = new Date(dateStr + 'T12:00:00')
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tmrw'

  return date.toLocaleDateString('en-US', { weekday: 'short' })
}
