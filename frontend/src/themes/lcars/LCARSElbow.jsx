/**
 * LCARSElbow.jsx - Reusable LCARS Corner Connector
 *
 * The elbow is the most iconic LCARS element: an L-shaped bracket
 * with a rounded inner corner that connects the sidebar to the
 * horizontal bars (header/footer).
 *
 * Props:
 *   position  - 'top-left' or 'bottom-left' (determines which corner is rounded)
 *   color     - CSS color for the elbow (default: sunflower)
 *   className - optional additional className
 */
export default function LCARSElbow({ position = 'top-left', color = 'var(--lcars-sunflower)', className = '' }) {
  // The elbow fills its grid cell completely.
  // It's a solid color block with one rounded inner corner cut out as black.
  const isTop = position === 'top-left'

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: color,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Black cutout for the rounded inner corner */}
      <div
        style={{
          position: 'absolute',
          // Position the cutout at the inner corner of the L
          right: 0,
          [isTop ? 'bottom' : 'top']: 0,
          width: '50%',
          height: '50%',
          background: '#000000',
          // Round only the corner that faces the elbow's center
          borderRadius: isTop
            ? '0 0 0 40px'   // bottom-left rounded for top-left elbow
            : '40px 0 0 0',  // top-left rounded for bottom-left elbow
        }}
      />
    </div>
  )
}
