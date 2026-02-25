/**
 * LCARSElbow.jsx - LCARS Corner Connector
 *
 * Simple filled rectangle with a rounded outer corner, creating
 * the characteristic LCARS frame curvature. Connects the sidebar
 * to the header/footer bars seamlessly — no inner L-shape cutout.
 *
 * Props:
 *   color     - CSS color for the elbow background
 *   position  - Corner position: 'tl' | 'tr' | 'bl' | 'br'
 *   label     - Optional text label displayed inside the elbow
 */
export default function LCARSElbow({ color = 'var(--lcars-sunflower)', position = 'tl', label }) {
  // Outer border-radius based on corner position
  // Top corners are taller cells (56px) so get larger radii
  // Bottom corners are shorter cells (36px) so get smaller radii
  const radiusMap = {
    tl: { borderTopLeftRadius: '2.5rem' },
    tr: { borderTopRightRadius: '2rem' },
    bl: { borderBottomLeftRadius: '1.75rem' },
    br: { borderBottomRightRadius: '1.5rem' },
  }

  // Label alignment: position text away from the curved corner
  const labelAlignMap = {
    tl: { bottom: '0.15rem', right: '0.5rem', textAlign: 'right' },
    tr: { bottom: '0.15rem', left: '0.5rem', textAlign: 'left' },
    bl: { top: '0.15rem', right: '0.5rem', textAlign: 'right' },
    br: { top: '0.15rem', left: '0.5rem', textAlign: 'left' },
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: color,
        position: 'relative',
        ...radiusMap[position],
      }}
    >
      {label && (
        <span
          style={{
            position: 'absolute',
            ...labelAlignMap[position],
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--lcars-text-on-color)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
