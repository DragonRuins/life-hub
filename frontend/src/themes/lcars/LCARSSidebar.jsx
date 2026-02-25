/**
 * LCARSSidebar.jsx - LCARS Pill-Button Navigation
 *
 * Uses the vendored LCARS library CSS classes (.lcars-column, .lcars-element)
 * for authentic LCARS-style pill-shaped navigation buttons.
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
    color: 'var(--lcars-sunflower)',
    activeColor: 'var(--lcars-butterscotch)',
    code: '01-4774',
  },
  {
    to: '/vehicles',
    label: 'Vehicles',
    icon: Car,
    color: 'var(--lcars-ice)',
    activeColor: 'var(--lcars-butterscotch)',
    code: '02-1138',
  },
  {
    to: '/notes',
    label: 'Notes',
    icon: StickyNote,
    color: 'var(--lcars-african-violet)',
    activeColor: 'var(--lcars-butterscotch)',
    code: '03-7294',
  },
  {
    to: '/projects',
    label: 'Projects',
    icon: FolderKanban,
    color: 'var(--lcars-lilac)',
    activeColor: 'var(--lcars-butterscotch)',
    code: '04-5031',
  },
  {
    to: '/kb',
    label: 'Library Computer',
    icon: BookOpen,
    color: 'var(--lcars-gold)',
    activeColor: 'var(--lcars-butterscotch)',
    code: '05-8816',
  },
  {
    to: '/infrastructure',
    label: 'Engineering',
    icon: Server,
    color: 'var(--lcars-tanoi)',
    activeColor: 'var(--lcars-butterscotch)',
    code: '06-2447',
  },
  {
    to: '/astrometrics',
    label: 'Astrometrics',
    icon: Telescope,
    color: 'var(--lcars-ice)',
    activeColor: 'var(--lcars-butterscotch)',
    code: '07-9163',
  },
  {
    to: '/trek',
    label: 'Database',
    icon: Library,
    color: 'var(--lcars-almond-creme)',
    activeColor: 'var(--lcars-butterscotch)',
    code: '08-3350',
  },
]

export default function LCARSSidebar() {
  return (
    <nav
      className="lcars-column flush"
      style={{
        gap: '4px',
        padding: '4px 0',
        height: '100%',
        background: 'var(--lcars-bg, #000)',
        overflow: 'hidden',
      }}
    >
      {NAV_ITEMS.map((item) => (
        <LCARSNavButton key={item.to} {...item} />
      ))}

      {/* Fill remaining space with a decorative block — slowly cycles LCARS colors */}
      <div
        className="lcars-element left-rounded lcars-idle-block-1"
        style={{
          flex: 1,
          marginTop: '4px',
          width: '100%',
          minHeight: '40px',
          opacity: 0.4,
        }}
      />

      {/* Bottom decorative blocks — each cycles independently */}
      <div
        className="lcars-element left-rounded lcars-idle-block-2"
        style={{
          height: '24px',
          width: '100%',
          opacity: 0.6,
        }}
      />
      <div
        className="lcars-element left-rounded lcars-idle-block-3"
        style={{
          height: '16px',
          width: '100%',
          opacity: 0.5,
        }}
      />
    </nav>
  )
}


/**
 * Individual LCARS pill-shaped navigation button.
 * Uses library .lcars-element.button.left-rounded for the pill shape,
 * with NavLink for route matching and active state detection.
 * In Modern variant, shows a decorative alphanumeric code below the label.
 */
function LCARSNavButton({ to, label, icon: Icon, color, activeColor, code }) {
  const { isModernLCARS } = useTheme()

  return (
    <NavLink
      to={to}
      end={to === '/'}
      className="lcars-element button left-rounded"
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: '0.5rem',
        padding: isModernLCARS ? '0.35rem 1rem 0.35rem 1.5rem' : '0.5rem 1rem 0.5rem 1.5rem',
        height: isModernLCARS ? '44px' : '40px',
        width: '100%',
        background: isActive ? activeColor : color,
        color: 'var(--lcars-text-on-color)',
        textDecoration: 'none',
        fontSize: '0.95rem',
        // Pill shape: rounded on left, flat on right (abuts the cascade column)
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        opacity: isActive ? 1 : 0.75,
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
