/**
 * LCARSElbow.jsx - LCARS Corner Connector
 *
 * An L-shaped elbow that connects horizontal bars (header/footer)
 * to vertical bars (sidebar/right strip). Features a quarter-circle
 * cutout on the inner corner — the signature LCARS design element.
 *
 * The cutout is positioned at the inner corner of each position:
 *   TL: cutout bottom-right  TR: cutout bottom-left
 *   BL: cutout top-right     BR: cutout top-left
 *
 * Props:
 *   color     - CSS color for the elbow (default: sunflower)
 *   position  - Corner position: 'tl' | 'tr' | 'bl' | 'br'
 *   className - optional additional className
 */
export default function LCARSElbow({ color = 'var(--lcars-sunflower)', position = 'tl', className = '' }) {
  // Each corner needs the cutout placed at the inner corner.
  // The border-radius curves away from the corner, creating the L-shape.
  const cutoutMap = {
    tl: { right: 0, bottom: 0, borderTopLeftRadius: '100%' },
    tr: { left: 0, bottom: 0, borderTopRightRadius: '100%' },
    bl: { right: 0, top: 0, borderBottomLeftRadius: '100%' },
    br: { left: 0, top: 0, borderBottomRightRadius: '100%' },
  }

  const cutout = cutoutMap[position] || cutoutMap.tl

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
      {/* Inner quarter-circle cutout */}
      <div
        style={{
          position: 'absolute',
          width: '50%',
          height: '50%',
          background: '#000',
          ...cutout,
        }}
      />
    </div>
  )
}
