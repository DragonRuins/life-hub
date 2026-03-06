/**
 * HealthMetricCard - Metric card with inline SVG sparkline.
 *
 * Displays a single health metric with current value, unit,
 * trend arrow, and a mini sparkline chart. Used in both
 * WatchHealth and WatchOverview pages.
 *
 * Props:
 *   label      - Metric display name (e.g., "Heart Rate")
 *   value      - Current value (number or string)
 *   unit       - Unit label (e.g., "bpm", "steps")
 *   trend      - Trend direction: "up", "down", or "flat"
 *   sparkData  - Array of numbers for the sparkline
 *   color      - Accent color (default: var(--color-blue))
 *   onClick    - Optional click handler (makes card clickable)
 *   icon       - Optional React node (Lucide icon)
 */

export default function HealthMetricCard({
  label,
  value,
  unit = '',
  trend,
  sparkData = [],
  color = 'var(--color-blue)',
  onClick,
  icon,
}) {
  // Build sparkline SVG points from data array
  const sparkWidth = 80
  const sparkHeight = 28
  const points = buildSparklinePoints(sparkData, sparkWidth, sparkHeight)

  const trendArrow = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : ''
  const trendColor = trend === 'up' ? 'var(--color-green)' : trend === 'down' ? 'var(--color-red)' : 'var(--color-subtext-0)'

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '1rem',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease',
        borderColor: onClick ? undefined : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.borderColor = color
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.borderColor = 'transparent'
      }}
    >
      {/* Header: icon + label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        marginBottom: '0.5rem',
      }}>
        {icon && (
          <div style={{ color, flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--color-subtext-0)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}>
          {label}
        </span>
      </div>

      {/* Value + trend + sparkline row */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
          <span style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--color-text)',
          }}>
            {value ?? '\u2014'}
          </span>
          {unit && (
            <span style={{
              fontSize: '0.75rem',
              color: 'var(--color-subtext-0)',
              fontWeight: 500,
            }}>
              {unit}
            </span>
          )}
          {trendArrow && (
            <span style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: trendColor,
            }}>
              {trendArrow}
            </span>
          )}
        </div>

        {/* Sparkline */}
        {points && (
          <svg
            width={sparkWidth}
            height={sparkHeight}
            viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
            style={{ flexShrink: 0, opacity: 0.7 }}
          >
            <polyline
              points={points}
              fill="none"
              stroke={color}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </div>
  )
}

/**
 * Build SVG polyline points string from an array of numbers.
 * Returns null if fewer than 2 data points.
 */
function buildSparklinePoints(data, width, height) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const padding = 2

  return data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width
      const y = padding + ((1 - (val - min) / range) * (height - padding * 2))
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
