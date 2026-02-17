/**
 * LCARSSidebar.jsx - LCARS Pill-Button Navigation
 *
 * Replaces the default sidebar with LCARS-style pill-shaped buttons.
 * Each nav item has a fixed color assignment for consistency.
 * Active route is highlighted with a distinct accent color.
 */
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote } from 'lucide-react'

// Fixed color assignments per navigation item
const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'var(--lcars-sunflower)',      // #FFCC99
    activeColor: 'var(--lcars-butterscotch)', // #FF9966
  },
  {
    to: '/vehicles',
    label: 'Vehicles',
    icon: Car,
    color: 'var(--lcars-ice)',            // #99CCFF
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/notes',
    label: 'Notes',
    icon: StickyNote,
    color: 'var(--lcars-african-violet)', // #CC99FF
    activeColor: 'var(--lcars-butterscotch)',
  },
]

export default function LCARSSidebar() {
  return (
    <nav
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '4px 0',
        height: '100%',
        background: '#000000',
        overflow: 'hidden',
      }}
    >
      {NAV_ITEMS.map((item) => (
        <LCARSNavButton key={item.to} {...item} />
      ))}

      {/* Fill remaining space with a decorative block */}
      <div
        style={{
          flex: 1,
          marginTop: '4px',
          background: 'var(--lcars-gray)',
          borderRadius: '0 30px 30px 0',
          minHeight: '40px',
          opacity: 0.4,
        }}
      />

      {/* Bottom decorative blocks */}
      <div
        style={{
          height: '24px',
          background: 'var(--lcars-almond-creme)',
          borderRadius: '0 30px 30px 0',
          opacity: 0.6,
        }}
      />
      <div
        style={{
          height: '16px',
          background: 'var(--lcars-moonlit-violet)',
          borderRadius: '0 30px 30px 0',
          opacity: 0.5,
        }}
      />
    </nav>
  )
}


/**
 * Individual LCARS pill-shaped navigation button.
 * Uses NavLink for route matching and active state detection.
 */
function LCARSNavButton({ to, label, icon: Icon, color, activeColor }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        padding: '0.5rem 1rem 0.5rem 0.75rem',
        height: '40px',
        background: isActive ? activeColor : color,
        color: '#000000',
        textDecoration: 'none',
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        fontSize: '0.95rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        // Pill shape: rounded on left side, flat on right (abuts the elbow column)
        borderRadius: '30px 0 0 30px',
        opacity: isActive ? 1 : 0.75,
        transition: 'filter 0.15s ease, opacity 0.15s ease',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      })}
      onMouseEnter={e => {
        e.currentTarget.style.filter = 'brightness(1.3)'
        e.currentTarget.style.opacity = '1'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.filter = 'brightness(1)'
        // Reset opacity only if not active (we can't easily check isActive here,
        // so we let CSS handle the re-render on route change)
      }}
    >
      <Icon size={16} />
      <span style={{ flex: 1, textAlign: 'right' }}>{label}</span>
    </NavLink>
  )
}
