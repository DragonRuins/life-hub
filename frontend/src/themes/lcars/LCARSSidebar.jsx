/**
 * LCARSSidebar.jsx - LCARS Pill-Button Navigation
 *
 * Replaces the default sidebar with LCARS-style pill-shaped buttons.
 * Each nav item has a fixed color assignment for consistency.
 * Active route is highlighted with a distinct accent color.
 */
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, FolderKanban, BookOpen, Server, Telescope, Library } from 'lucide-react'
import { useTheme } from './ThemeProvider'

// Fixed color assignments per navigation item
// `code` is a decorative alphanumeric identifier shown in Modern variant
const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'var(--lcars-sunflower)',      // #FFCC99
    activeColor: 'var(--lcars-butterscotch)', // #FF9966
    code: '01-4774',
  },
  {
    to: '/vehicles',
    label: 'Vehicles',
    icon: Car,
    color: 'var(--lcars-ice)',            // #99CCFF
    activeColor: 'var(--lcars-butterscotch)',
    code: '02-1138',
  },
  {
    to: '/notes',
    label: 'Notes',
    icon: StickyNote,
    color: 'var(--lcars-african-violet)', // #CC99FF
    activeColor: 'var(--lcars-butterscotch)',
    code: '03-7294',
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    color: 'var(--lcars-lilac)',          // #CC99CC
    activeColor: 'var(--lcars-butterscotch)',
    code: '04-5031',
  },
  {
    to: '/kb',
    label: 'Library Computer',
    icon: BookOpen,
    color: 'var(--lcars-gold)',           // #FFAA00
    activeColor: 'var(--lcars-butterscotch)',
    code: '05-8816',
  },
  {
    to: '/infrastructure',
    label: 'Engineering',
    icon: Server,
    color: 'var(--lcars-tanoi)',          // #FFCC66
    activeColor: 'var(--lcars-butterscotch)',
    code: '06-2447',
  },
  {
    to: '/astrometrics',
    label: 'Astrometrics',
    icon: Telescope,
    color: 'var(--lcars-ice)',            // #99CCFF
    activeColor: 'var(--lcars-butterscotch)',
    code: '07-9163',
  },
  {
    to: '/trek',
    label: 'Database',
    icon: Library,
    color: 'var(--lcars-almond-creme)',   // #FFBBAA
    activeColor: 'var(--lcars-butterscotch)',
    code: '08-3350',
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

      {/* Fill remaining space with a decorative block — slowly cycles LCARS colors */}
      <div
        className="lcars-idle-block-1"
        style={{
          flex: 1,
          marginTop: '4px',
          borderRadius: '0 30px 30px 0',
          minHeight: '40px',
          opacity: 0.4,
        }}
      />

      {/* Bottom decorative blocks — each cycles independently */}
      <div
        className="lcars-idle-block-2"
        style={{
          height: '24px',
          borderRadius: '0 30px 30px 0',
          opacity: 0.6,
        }}
      />
      <div
        className="lcars-idle-block-3"
        style={{
          height: '16px',
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
 * In Modern variant, shows a decorative alphanumeric code below the label.
 */
function LCARSNavButton({ to, label, icon: Icon, color, activeColor, code }) {
  const { isModernLCARS } = useTheme()

  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        padding: isModernLCARS ? '0.35rem 1rem 0.35rem 0.75rem' : '0.5rem 1rem 0.5rem 0.75rem',
        height: isModernLCARS ? '44px' : '40px',
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
      <div style={{ flex: 1, textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span>{label}</span>
        {/* Decorative numeric code — Modern variant only */}
        {isModernLCARS && code && (
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.55rem',
              fontWeight: 400,
              opacity: 0.5,
              letterSpacing: '0.04em',
              textTransform: 'none',
              lineHeight: 1,
            }}
          >
            {code}
          </span>
        )}
      </div>
    </NavLink>
  )
}
