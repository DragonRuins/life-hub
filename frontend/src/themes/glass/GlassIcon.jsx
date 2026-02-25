/**
 * GlassIcon.jsx - Squircle Icon Wrapper
 *
 * Apple-style icon container with squircle border-radius (22%),
 * glass gradient fill, and subtle inner shadow + outer glow.
 *
 * Props:
 *   icon   - Lucide icon component (e.g. Car, StickyNote)
 *   color  - Tint color for the icon and glow (CSS color string)
 *   size   - Container size in px (default 36)
 */
export default function GlassIcon({ icon: Icon, color = 'var(--color-blue)', size = 36 }) {
  const iconSize = Math.round(size * 0.5)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '22%',
        background: `linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 0 12px ${color}22`,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        flexShrink: 0,
      }}
    >
      <Icon size={iconSize} style={{ color }} />
    </div>
  )
}
