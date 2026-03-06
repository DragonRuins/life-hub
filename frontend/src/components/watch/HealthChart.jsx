/**
 * HealthChart - Recharts time-series wrapper for health metrics.
 *
 * Renders a responsive line chart with Catppuccin-themed styling.
 * Used in WatchHealthDetail for metric drilldowns.
 *
 * Props:
 *   data       - Array of { date, value } objects (chronological order)
 *   dataKey    - Key name for the Y axis value (default: "value")
 *   color      - Line/dot color (default: var(--color-blue))
 *   unit       - Unit label for tooltip (e.g., "bpm")
 *   avgValue   - Optional average value for reference line
 *   height     - Chart height in pixels (default: 280)
 */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatShortDate } from '../../utils/formatDate'

export default function HealthChart({
  data = [],
  dataKey = 'value',
  color = 'var(--color-blue)',
  unit = '',
  avgValue,
  height = 280,
}) {
  if (!data || data.length < 2) {
    return (
      <div style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--color-subtext-0)',
        fontSize: '0.85rem',
      }}>
        Not enough data points for a chart
      </div>
    )
  }

  // Format dates for display
  const chartData = data.map(d => ({
    ...d,
    dateLabel: formatShortDate(d.date),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-surface-1)"
        />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: 'var(--color-subtext-0)', fontSize: 12 }}
          stroke="var(--color-surface-1)"
        />
        <YAxis
          tick={{ fill: 'var(--color-subtext-0)', fontSize: 12 }}
          stroke="var(--color-surface-1)"
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-1)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '0.85rem',
          }}
          formatter={(value) => [
            `${typeof value === 'number' ? value.toFixed(1) : value} ${unit}`,
            unit,
          ]}
        />
        {avgValue != null && (
          <ReferenceLine
            y={avgValue}
            stroke="var(--color-overlay-0)"
            strokeDasharray="5 5"
            label={{
              value: `Avg: ${typeof avgValue === 'number' ? avgValue.toFixed(1) : avgValue}`,
              position: 'right',
              fill: 'var(--color-subtext-0)',
              fontSize: 11,
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={{ fill: color, r: 3 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
