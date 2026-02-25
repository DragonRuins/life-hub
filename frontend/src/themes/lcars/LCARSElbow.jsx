/**
 * LCARSElbow.jsx - LCARS Corner Connector
 *
 * Uses the vendored joernweissenborn/lcars CSS library classes for
 * authentic LCARS elbows. The library handles the dual border-radius
 * technique (outer curve + inner ::after cutout) via pure CSS.
 *
 * Library position class mapping:
 *   tl → .left-bottom  (sidebar goes down, header goes right)
 *   bl → .left-top     (sidebar goes up, footer goes right)
 *   tr → .right-bottom (right strip goes down, header goes left)
 *   br → .right-top    (right strip goes up, footer goes left)
 *
 * Props:
 *   color     - CSS color for the elbow (applied via inline style override)
 *   position  - Corner position: 'tl' | 'tr' | 'bl' | 'br'
 *   label     - Optional text label displayed inside the elbow
 *   className - Additional CSS class names
 */
export default function LCARSElbow({ color = 'var(--lcars-sunflower)', position = 'tl', label, className = '' }) {
  // Map our position names to the library's orientation class names
  const positionClassMap = {
    tl: 'left-bottom',
    bl: 'left-top',
    tr: 'right-bottom',
    br: 'right-top',
  }

  const posClass = positionClassMap[position] || positionClassMap.tl

  return (
    <div
      className={`lcars-elbow ${posClass} ${className}`.trim()}
      style={{ background: color }}
    >
      {label && <a>{label}</a>}
    </div>
  )
}
