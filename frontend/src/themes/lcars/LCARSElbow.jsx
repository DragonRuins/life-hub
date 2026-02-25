/**
 * LCARSElbow.jsx - LCARS Corner Connector with Rounded Cutout
 *
 * A solid colored block with a quarter-circle black cutout that creates
 * the distinctive LCARS rounded corner. Connects horizontal bars
 * (header/footer) to vertical bars (sidebars).
 *
 * The cutout sits in the "inner" corner of the elbow — the corner
 * that faces the content area:
 *   TL → cutout at bottom-right
 *   TR → cutout at bottom-left
 *   BL → cutout at top-right
 *   BR → cutout at top-left
 *
 * Props:
 *   color     - CSS color for the elbow (default: sunflower)
 *   position  - 'tl' | 'tr' | 'bl' | 'br' (determines cutout corner)
 *   radius    - Cutout radius in pixels (default: 40)
 *   animated  - Enable looping sweep animation (modern variant only)
 *   className - optional additional className
 */
export default function LCARSElbow({
  color = 'var(--lcars-sunflower)',
  position = 'tl',
  radius = 40,
  animated = false,
  className = '',
}) {
  // Map position to cutout placement + which border-radius corner to curve
  const cutoutMap = {
    tl: { bottom: 0, right: 0, borderTopLeftRadius: `${radius}px` },
    tr: { bottom: 0, left: 0, borderTopRightRadius: `${radius}px` },
    bl: { top: 0, right: 0, borderBottomLeftRadius: `${radius}px` },
    br: { top: 0, left: 0, borderBottomRightRadius: `${radius}px` },
  }

  const cutoutStyle = cutoutMap[position] || cutoutMap.tl

  return (
    <div
      className={`lcars-elbow lcars-elbow-${position} ${animated ? 'lcars-elbow-animated' : ''} ${className}`.trim()}
      style={{
        width: '100%',
        height: '100%',
        background: color,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Quarter-circle black cutout — sits above the sweep animation */}
      <div
        style={{
          position: 'absolute',
          width: `${radius}px`,
          height: `${radius}px`,
          background: '#000000',
          zIndex: 2,
          ...cutoutStyle,
        }}
      />
    </div>
  )
}
