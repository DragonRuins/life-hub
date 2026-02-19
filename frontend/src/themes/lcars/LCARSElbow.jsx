/**
 * LCARSElbow.jsx - LCARS Corner Connector
 *
 * A solid colored block that connects the sidebar to the
 * horizontal bars (header/footer). Fills its grid cell completely.
 *
 * Props:
 *   color     - CSS color for the elbow (default: sunflower)
 *   className - optional additional className
 */
export default function LCARSElbow({ color = 'var(--lcars-sunflower)', className = '' }) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        background: color,
      }}
    />
  )
}
