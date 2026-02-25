/**
 * GlassPanel.jsx - Reusable Glass Card Component
 *
 * Three-layer glass card following Apple HIG:
 * 1. Base element: backdrop-filter blur + semi-transparent bg
 * 2. ::before (CSS): inner glow via box-shadow
 * 3. Optional elevated variant with heavier blur + larger shadow
 *
 * Concentric corner radii: inner radius = outer radius - padding
 * per Apple Human Interface Guidelines.
 *
 * Props:
 *   title       - Optional header text
 *   headerRight - Optional JSX in the header right side
 *   footer      - Optional footer JSX
 *   children    - Panel body content
 *   elevated    - Boolean, heavier blur + larger shadow for emphasis
 *   noPad       - Boolean, removes body padding
 *   className   - Additional CSS classes
 *   style       - Additional inline styles
 *   animate     - Boolean, enables entrance animation (default true)
 */
export default function GlassPanel({
  title,
  headerRight,
  footer,
  children,
  elevated = false,
  noPad = false,
  className = '',
  style = {},
  animate = true,
}) {
  const panelStyle = {
    position: 'relative',
    background: elevated ? 'var(--glass-bg-elevated)' : 'var(--glass-bg)',
    backdropFilter: elevated
      ? 'var(--glass-blur-heavy) var(--glass-saturate)'
      : 'var(--glass-blur) var(--glass-saturate)',
    WebkitBackdropFilter: elevated
      ? 'var(--glass-blur-heavy) var(--glass-saturate)'
      : 'var(--glass-blur) var(--glass-saturate)',
    border: 'var(--glass-border)',
    borderRadius: 'var(--glass-radius-lg)',
    boxShadow: elevated ? 'var(--glass-shadow-lg)' : 'var(--glass-shadow)',
    overflow: 'hidden',
    transition: 'var(--glass-transition)',
    ...style,
  }

  return (
    <div
      className={`glass-panel ${animate ? 'glass-animate-in' : ''} ${className}`}
      style={panelStyle}
    >
      {/* Inner glow layer (CSS pseudo would be better, but inline JSX needs this) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.08), inset 0 0 20px -5px rgba(255, 255, 255, 0.04)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Header */}
      {(title || headerRight) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {title && (
            <h3 style={{
              margin: 0,
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </h3>
          )}
          {headerRight && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {headerRight}
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div
        style={{
          padding: noPad ? 0 : '1.25rem',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div
          style={{
            padding: '0.75rem 1.25rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}
