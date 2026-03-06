/**
 * BarometerChart - Dual-axis pressure + altitude chart.
 *
 * Renders pressure (hPa) on the left Y axis and altitude (m) on
 * the right Y axis using Recharts. Catppuccin-themed styling.
 *
 * Props:
 *   data     - Array of { date, pressure, altitude } objects (chronological)
 *   height   - Chart height in pixels (default: 300)
 */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatShortDate } from '../../utils/formatDate'

export default function BarometerChart({ data = [], height = 300 }) {
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
        Not enough barometric data for a chart
      </div>
    )
  }

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
          yAxisId="pressure"
          tick={{ fill: 'var(--color-subtext-0)', fontSize: 12 }}
          stroke="var(--color-surface-1)"
          domain={['auto', 'auto']}
          label={{
            value: 'hPa',
            angle: -90,
            position: 'insideLeft',
            fill: 'var(--color-subtext-0)',
            fontSize: 11,
          }}
        />
        <YAxis
          yAxisId="altitude"
          orientation="right"
          tick={{ fill: 'var(--color-subtext-0)', fontSize: 12 }}
          stroke="var(--color-surface-1)"
          domain={['auto', 'auto']}
          label={{
            value: 'm',
            angle: 90,
            position: 'insideRight',
            fill: 'var(--color-subtext-0)',
            fontSize: 11,
          }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-1)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '0.85rem',
          }}
          formatter={(value, name) => {
            if (name === 'pressure') return [`${value?.toFixed(1)} hPa`, 'Pressure']
            if (name === 'altitude') return [`${value?.toFixed(1)} m`, 'Altitude']
            return [value, name]
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}
        />
        <Line
          yAxisId="pressure"
          type="monotone"
          dataKey="pressure"
          name="Pressure"
          stroke="var(--color-blue)"
          strokeWidth={2}
          dot={{ fill: 'var(--color-blue)', r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          yAxisId="altitude"
          type="monotone"
          dataKey="altitude"
          name="Altitude"
          stroke="var(--color-peach)"
          strokeWidth={2}
          dot={{ fill: 'var(--color-peach)', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
