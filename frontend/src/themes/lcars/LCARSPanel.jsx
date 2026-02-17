/**
 * LCARSPanel.jsx - Reusable LCARS Data Panel
 *
 * Replaces generic .card divs with a proper LCARS-style data readout panel.
 * Features:
 *   - Colored side accent bar (left edge)
 *   - Header strip with title in Antonio font
 *   - Black content area with LCARS text styling
 *   - Optional footer strip
 *
 * Props:
 *   title       - Panel header text (displayed uppercase in Antonio)
 *   color       - Accent color for the side bar and header (default: sunflower)
 *   headerRight - Optional React node to render on the right side of the header
 *   footer      - Optional React node for the footer strip
 *   children    - Panel content
 *   style       - Additional styles for the outer container
 *   noPadding   - If true, content area has no padding (for tables, etc.)
 */
export default function LCARSPanel({
  title,
  color = 'var(--lcars-sunflower)',
  headerRight,
  footer,
  children,
  style = {},
  noPadding = false,
}) {
  return (
    <div
      style={{
        display: 'flex',
        background: '#000000',
        border: `1px solid rgba(102, 102, 136, 0.3)`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          width: '6px',
          background: color,
          flexShrink: 0,
        }}
      />

      {/* Main panel area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header strip */}
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 1rem',
              background: color,
              gap: '0.75rem',
            }}
          >
            <span
              style={{
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '0.85rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: '#000000',
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

        {/* Content area */}
        <div
          style={{
            flex: 1,
            padding: noPadding ? 0 : '1rem',
          }}
        >
          {children}
        </div>

        {/* Optional footer strip */}
        {footer && (
          <div
            style={{
              padding: '0.375rem 1rem',
              borderTop: '1px solid rgba(102, 102, 136, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.5rem',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}


/**
 * LCARS-styled data row for use inside panels.
 * A horizontal row showing a label and value, similar to a sensor readout.
 */
export function LCARSDataRow({ label, value, color = 'var(--lcars-sunflower)', icon }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
      }}
    >
      {icon && (
        <div style={{ color, flexShrink: 0 }}>
          {icon}
        </div>
      )}
      <span
        style={{
          flex: 1,
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
  )
}


/**
 * LCARS stat display - large number with label underneath.
 * Used for key metrics in dashboard panels.
 */
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
