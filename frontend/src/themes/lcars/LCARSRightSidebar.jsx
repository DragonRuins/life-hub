/**
 * LCARSRightSidebar.jsx - Right-side status panel (Modern variant only)
 *
 * Displays a mix of live data (vehicle count, alerts, system status)
 * and decorative filler blocks with alphanumeric codes.
 * Pill-shaped blocks are rounded on the RIGHT, flat on the LEFT —
 * mirroring the left sidebar's shape language.
 *
 * Polls dashboard.getSummary() on mount and every 30 seconds.
 */
import { useState, useEffect, useMemo } from 'react'
import { dashboard } from '../../api/client'
import { useTheme } from './ThemeProvider'

// Decorative alphanumeric codes (seeded, deterministic)
const DECO_CODES = [
  '47-C', '09-A', '17-F', '83-D', '22-B', '61-E',
  '38-G', '04-H', '76-J', '55-K', '91-L', '12-M',
]

// Color cycle for decorative blocks (uses CSS variables)
const DECO_COLORS = [
  'var(--lcars-sunflower)',
  'var(--lcars-african-violet)',
  'var(--lcars-ice)',
  'var(--lcars-butterscotch)',
  'var(--lcars-sky)',
  'var(--lcars-lilac)',
]

export default function LCARSRightSidebar() {
  const { alertCondition } = useTheme()
  const [summary, setSummary] = useState(null)

  // Poll dashboard summary for live data
  useEffect(() => {
    let cancelled = false

    async function fetchSummary() {
      try {
        const data = await dashboard.getSummary()
        if (!cancelled) setSummary(data)
      } catch {
        // Silently fail — sidebar is non-critical
      }
    }

    fetchSummary()
    const timer = setInterval(fetchSummary, 30000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  // Build the block list: mix of live data and decorative filler
  const blocks = useMemo(() => {
    const items = []

    // Live data blocks (if summary loaded)
    if (summary) {
      items.push({
        type: 'data',
        label: 'VHC',
        value: String(summary.vehicle_count ?? 0).padStart(2, '0'),
        color: 'var(--lcars-ice)',
      })
      items.push({
        type: 'data',
        label: 'NTS',
        value: String(summary.note_count ?? 0).padStart(2, '0'),
        color: 'var(--lcars-african-violet)',
      })
      items.push({
        type: 'data',
        label: 'FUL',
        value: String(summary.fuel_log_count ?? 0).padStart(2, '0'),
        color: 'var(--lcars-sunflower)',
      })
    }

    // Alert status block
    const alertColor = alertCondition === 'red'
      ? 'var(--lcars-tomato)'
      : alertCondition === 'yellow'
        ? 'var(--lcars-butterscotch)'
        : 'var(--lcars-green)'
    const alertLabel = alertCondition === 'red'
      ? 'ALERT'
      : alertCondition === 'yellow'
        ? 'CAUTION'
        : 'NOM'
    items.push({
      type: 'status',
      label: alertLabel,
      color: alertColor,
    })

    // Fill remaining space with decorative blocks
    for (let i = 0; i < 8; i++) {
      items.push({
        type: 'deco',
        code: DECO_CODES[i % DECO_CODES.length],
        color: DECO_COLORS[i % DECO_COLORS.length],
        height: 20 + ((i * 7) % 18), // pseudo-random heights 20-37px
      })
    }

    return items
  }, [summary, alertCondition])

  // Shared pill style: rounded right, flat left (mirroring left sidebar)
  const pillStyle = (color, height = 'auto') => ({
    background: color,
    borderTopRightRadius: '16px',
    borderBottomRightRadius: '16px',
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    height,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.2rem 0.5rem',
    overflow: 'hidden',
  })

  const monoStyle = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '0.55rem',
    letterSpacing: '0.04em',
    color: 'var(--lcars-text-on-color)',
    fontWeight: 600,
  }

  const labelStyle = {
    fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
    fontSize: '0.6rem',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--lcars-text-on-color)',
    fontWeight: 600,
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        padding: '4px 0',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {blocks.map((block, i) => {
        if (block.type === 'data') {
          return (
            <div key={`data-${i}`} style={pillStyle(block.color)}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <span style={labelStyle}>{block.label}</span>
                <span style={monoStyle}>{block.value}</span>
              </div>
            </div>
          )
        }

        if (block.type === 'status') {
          return (
            <div key={`status-${i}`} style={pillStyle(block.color)}>
              <span style={{ ...labelStyle, fontSize: '0.55rem' }}>{block.label}</span>
            </div>
          )
        }

        // Decorative filler block
        return (
          <div
            key={`deco-${i}`}
            style={{
              ...pillStyle(block.color, `${block.height}px`),
              opacity: 0.6,
            }}
          >
            <span style={{ ...monoStyle, opacity: 0.7 }}>{block.code}</span>
          </div>
        )
      })}

      {/* Spacer to push content up */}
      <div style={{ flex: 1 }} />

      {/* Bottom cap block */}
      <div
        style={{
          ...pillStyle('var(--lcars-sunflower)', '12px'),
          opacity: 0.4,
        }}
      />
    </div>
  )
}
