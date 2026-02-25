/**
 * LCARSMobileNav.jsx - Bottom Navigation Bar for Mobile
 *
 * Replaces the sidebar on mobile (< 768px). Horizontal pill-button
 * bar that sits in the footer grid area. Uses the same nav items
 * and LCARS styling as LCARSSidebar.
 *
 * Horizontally scrollable when there are too many items to fit
 * on screen. Each pill has a minimum width to stay legible.
 */
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, FolderKanban, BookOpen, Server, Telescope, Library, Settings } from 'lucide-react'

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Ops',
    icon: LayoutDashboard,
    color: 'var(--lcars-sunflower)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/vehicles',
    label: 'Veh',
    icon: Car,
    color: 'var(--lcars-ice)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/notes',
    label: 'Notes',
    icon: StickyNote,
    color: 'var(--lcars-african-violet)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/projects',
    label: 'Proj',
    icon: FolderKanban,
    color: 'var(--lcars-lilac)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/kb',
    label: 'Lib',
    icon: BookOpen,
    color: 'var(--lcars-gold)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/infrastructure',
    label: 'Engr',
    icon: Server,
    color: 'var(--lcars-tanoi)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/astrometrics',
    label: 'Astro',
    icon: Telescope,
    color: 'var(--lcars-ice)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/trek',
    label: 'DB',
    icon: Library,
    color: 'var(--lcars-almond-creme)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/settings',
    label: 'Cfg',
    icon: Settings,
    color: 'var(--lcars-gray)',
    activeColor: 'var(--lcars-butterscotch)',
  },
]

export default function LCARSMobileNav() {
  return (
    <nav
      style={{
        display: 'flex',
        gap: '3px',
        height: '100%',
        background: '#000000',
        padding: '0',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {NAV_ITEMS.map((item) => (
        <MobileNavPill key={item.to} {...item} />
      ))}
    </nav>
  )
}

function MobileNavPill({ to, label, icon: Icon, color, activeColor }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        minWidth: '52px',
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        padding: '0 6px',
        background: isActive ? activeColor : color,
        color: 'var(--lcars-text-on-color)',
        textDecoration: 'none',
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        fontSize: '0.6rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        opacity: isActive ? 1 : 0.75,
        transition: 'opacity 0.15s ease',
      })}
    >
      <Icon size={16} />
      <span>{label}</span>
    </NavLink>
  )
}
