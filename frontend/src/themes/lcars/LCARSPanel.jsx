/**
 * LCARSPanel.jsx - LCARS C-Bracket Frame Panel System
 *
 * Redesigned panel with iconic LCARS C-bracket frame shape:
 *   - CSS Grid layout with sidebar, elbows, header/footer bars
 *   - Scan-line sweep animation on headers
 *   - Hover glow effect (no glow at rest)
 *   - Simplified mobile layout (top bar only, no sidebar/elbows)
 *
 * Exports:
 *   default  LCARSPanel          - Full C-bracket frame panel
 *   named    LCARSDataRow        - Sensor readout row with accent block + segmented divider
 *   named    LCARSStat           - Large metric display (unchanged)
 *   named    LCARSSegmentedDivider - Row of short colored blocks as separator
 *   named    LCARSGauge          - Horizontal bar gauge for vehicle readouts
 *   named    LCARSMiniPanel      - Miniature C-bracket for status board tiles
 *
 * Props (LCARSPanel — same interface, no breaking changes):
 *   title       - Panel header text (displayed uppercase in Antonio)
 *   color       - Accent color for frame elements (default: sunflower)
 *   headerRight - Optional React node for right side of header
 *   footer      - Optional React node for footer strip
 *   children    - Panel content
 *   style       - Additional styles for outer container
 *   noPadding   - If true, content area has no padding
 */
import { useState } from 'react'
import useIsMobile from '../../hooks/useIsMobile'
import { useTheme } from './ThemeProvider'


// ═══════════════════════════════════════════════════════════════════════════
// LCARSPanel (default export) — C-Bracket Frame
// ═══════════════════════════════════════════════════════════════════════════

export default function LCARSPanel({
  title,
  color = 'var(--lcars-sunflower)',
  headerRight,
  footer,
  children,
  style = {},
  noPadding = false,
}) {
  const [isHovered, setIsHovered] = useState(false)
  const isMobile = useIsMobile()
  const { isModernLCARS } = useTheme()

  // Modern variant: no glow, thinner elements, reduced border radius
  const radius = isModernLCARS ? '8px' : '16px'
  const sidebarWidth = isModernLCARS ? '6px' : '10px'

  // Hover glow applied to all colored frame elements (disabled in Modern)
  const glowStyle = (!isModernLCARS && isHovered)
    ? { boxShadow: `0 0 8px color-mix(in srgb, ${color} 25%, transparent)` }
    : {}

  // Scan-stripe class only in Classic mode
  const scanClass = isModernLCARS ? '' : 'lcars-scan-stripe'

  // ── Mobile: simplified top-bar layout (no sidebar/elbows) ──────────
  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#000',
          overflow: 'hidden',
          ...style,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Top bar with pill cap */}
        {title && (
          <div
            className={scanClass}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.75rem',
              background: color,
              borderTopRightRadius: radius,
              position: 'relative',
              overflow: 'hidden',
              ...glowStyle,
            }}
          >
            <span
              style={{
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#000',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
            {headerRight && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {headerRight}
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, padding: noPadding ? 0 : '1rem' }}>
          {children}
        </div>

        {/* Bottom bar (footer or thin closing bar) */}
        {footer ? (
          <div
            style={{
              padding: '0.35rem 0.75rem',
              background: color,
              borderBottomRightRadius: radius,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              ...glowStyle,
            }}
          >
            {footer}
          </div>
        ) : (
          <div
            style={{
              minHeight: isModernLCARS ? '3px' : '4px',
              background: color,
              borderBottomRightRadius: radius,
              ...glowStyle,
            }}
          />
        )}
      </div>
    )
  }

  // ── Desktop: full C-bracket CSS Grid layout ────────────────────────
  //
  //  ╭──╮──────────────────────────────╮
  //  │  │     HEADER TITLE        ████ │  <- elbow + header + pill cap
  //  │  ╰──────────────────────────────╯
  //  │  │
  //  │  │   Content area (black)
  //  │  │
  //  │  ╭──────────────────────────────╮
  //  │  │     FOOTER (or 4px bar)      │  <- bottom elbow + footer bar
  //  ╰──╯──────────────────────────────╯

  const hasTitle = Boolean(title)

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${sidebarWidth} 1fr`,
        gridTemplateRows: hasTitle ? 'auto 1fr auto' : '1fr auto',
        background: '#000',
        overflow: 'hidden',
        ...style,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Row 1: Header (only when title exists) ── */}
      {hasTitle && (
        <>
          {/* Top-left elbow */}
          <div
            style={{
              background: color,
              borderTopLeftRadius: radius,
              ...glowStyle,
            }}
          />
          {/* Header bar with scan-line */}
          <div
            className={scanClass}
            style={{
              background: color,
              borderTopRightRadius: radius,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.75rem',
              gap: '0.75rem',
              position: 'relative',
              overflow: 'hidden',
              ...glowStyle,
            }}
          >
            <span
              style={{
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#000',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
            {headerRight && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {headerRight}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Row 2 (or Row 1 if no title): Sidebar + Content ── */}
      {/* Sidebar bar */}
      <div
        style={{
          background: color,
          ...glowStyle,
        }}
      />
      {/* Content area */}
      <div
        style={{
          padding: noPadding ? 0 : '1rem',
          minHeight: '2rem',
        }}
      >
        {children}
      </div>

      {/* ── Bottom row: Elbow + Footer ── */}
      {/* Bottom-left elbow */}
      <div
        style={{
          background: color,
          borderBottomLeftRadius: radius,
          ...glowStyle,
        }}
      />
      {/* Footer bar (content or thin closing bar) */}
      {footer ? (
        <div
          style={{
            background: color,
            borderBottomRightRadius: radius,
            padding: '0.35rem 0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.5rem',
            ...glowStyle,
          }}
        >
          {footer}
        </div>
      ) : (
        <div
          style={{
            background: color,
            borderBottomRightRadius: radius,
            minHeight: isModernLCARS ? '3px' : '4px',
            ...glowStyle,
          }}
        />
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// LCARSSegmentedDivider — Row of short colored blocks as separator
// ═══════════════════════════════════════════════════════════════════════════

export function LCARSSegmentedDivider({ color = 'var(--lcars-sunflower)', opacity = 0.4 }) {
  // Block widths: 24px, 12px, 12px, 8px, 8px — all 4px tall
  const blocks = [24, 12, 12, 8, 8]

  return (
    <div
      style={{
        display: 'flex',
        gap: '3px',
        padding: '0 0.75rem',
        opacity,
      }}
    >
      {blocks.map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w}px`,
            height: '4px',
            background: color,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// LCARSDataRow — Sensor Readout Style
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updated layout with 4px colored accent block on left edge,
 * optional icon, label/value pair, and segmented divider below.
 */
export function LCARSDataRow({ label, value, color = 'var(--lcars-sunflower)', icon }) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.5rem 0.75rem',
        }}
      >
        {/* 4px colored accent block */}
        <div
          style={{
            width: '4px',
            alignSelf: 'stretch',
            background: color,
            flexShrink: 0,
          }}
        />
        {icon && (
          <div style={{ color, flexShrink: 0 }}>
            {icon}
          </div>
        )}
        <span
          style={{
            width: '12rem',
            flexShrink: 0,
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '0.8rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--lcars-gray)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--lcars-space-white)',
          }}
        >
          {value}
        </span>
      </div>
      <LCARSSegmentedDivider color={color} />
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// LCARSStat — Large metric display (unchanged)
// ═══════════════════════════════════════════════════════════════════════════

export function LCARSStat({ label, value, color = 'var(--lcars-ice)', icon }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0.75rem',
        gap: '0.25rem',
      }}
    >
      {icon && (
        <div style={{ color, marginBottom: '0.125rem' }}>
          {icon}
        </div>
      )}
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--lcars-space-white)',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color,
        }}
      >
        {label}
      </span>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// LCARSGauge — Horizontal Bar Gauge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Horizontal bar gauge for vehicle readout panels.
 * Props:
 *   label   - Gauge label (Antonio, gray)
 *   value   - Display value string (JetBrains Mono, white)
 *   percent - Fill percentage 0-100
 *   color   - Bar fill color
 */
export function LCARSGauge({ label, value, percent = 0, color = 'var(--lcars-sunflower)' }) {
  const clampedPercent = Math.max(0, Math.min(percent, 100))

  return (
    <div style={{ padding: '0.25rem 0.75rem' }}>
      {/* Label + value row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: '0.2rem',
        }}
      >
        <span
          style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--lcars-gray)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--lcars-space-white)',
          }}
        >
          {value}
        </span>
      </div>
      {/* Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          background: 'rgba(102, 102, 136, 0.2)',
        }}
      >
        <div
          style={{
            width: `${clampedPercent}%`,
            height: '100%',
            background: color,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// LCARSMiniPanel — Miniature C-Bracket for Status Board Tiles
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Small C-bracket frame for status board tiles.
 * Deliberately minimal: no glow, no scan-line, no headerRight/footer.
 * Props:
 *   title    - Tile header text
 *   color    - Frame accent color
 *   children - Tile content
 *   style    - Additional outer styles
 */
export function LCARSMiniPanel({ title, color = 'var(--lcars-sunflower)', children, style = {} }) {
  const { isModernLCARS } = useTheme()
  const miniSidebarWidth = isModernLCARS ? '3px' : '4px'
  const miniRadius = isModernLCARS ? '4px' : '8px'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `${miniSidebarWidth} 1fr`,
        gridTemplateRows: 'auto 1fr auto',
        background: '#000',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Top-left mini elbow */}
      <div
        style={{
          background: color,
          borderTopLeftRadius: miniRadius,
        }}
      />
      {/* Header */}
      <div
        style={{
          background: color,
          borderTopRightRadius: miniRadius,
          padding: '0.25rem 0.5rem',
        }}
      >
        <span
          style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: isModernLCARS ? '0.7rem' : '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: isModernLCARS ? 'var(--lcars-space-white)' : '#000',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>

      {/* Sidebar */}
      <div style={{ background: color }} />
      {/* Content */}
      <div style={{ padding: '0.5rem' }}>
        {children}
      </div>

      {/* Bottom-left mini elbow */}
      <div
        style={{
          background: color,
          borderBottomLeftRadius: miniRadius,
        }}
      />
      {/* Bottom closing bar */}
      <div
        style={{
          background: color,
          borderBottomRightRadius: miniRadius,
          minHeight: isModernLCARS ? '2px' : '3px',
        }}
      />
    </div>
  )
}
