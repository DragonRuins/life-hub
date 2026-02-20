/**
 * LCARSMobileNav.jsx - Bottom Navigation Bar for Mobile
 *
 * Replaces the sidebar on mobile (< 768px). Horizontal pill-button
 * bar that sits in the footer grid area. Uses the same nav items
 * and LCARS styling as LCARSSidebar.
 */
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, FolderKanban, BookOpen, Server, Telescope, Library } from 'lucide-react'

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
    label: 'Vehicles',
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
    label: 'Projects',
    icon: FolderKanban,
    color: 'var(--lcars-lilac)',
    activeColor: 'var(--lcars-butterscotch)',
  },
  {
    to: '/kb',
    label: 'Library',
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
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        background: isActive ? activeColor : color,
        color: '#000000',
        textDecoration: 'none',
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        opacity: isActive ? 1 : 0.75,
        transition: 'opacity 0.15s ease',
      })}
    >
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  )
}
