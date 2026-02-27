/**
 * GlassSidebar.jsx - Floating Inset Glass Sidebar
 *
 * Floats with inset margins from viewport edges.
 * Apple Liquid Glass material: translucent, blurred, with inner glow.
 * Nav items illuminate on hover (material responds to interaction).
 * Collapsible to icon-only mode with smooth width transition.
 *
 * The sidebar CSS (.glass-sidebar) is in GlassLayout.css — it handles
 * the floating position, glass material, and border-radius.
 * This component only renders the nav content inside it.
 */
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Car, StickyNote, FolderKanban, BookOpen,
  Server, Telescope, Library, ChevronLeft, ChevronRight, Settings, Clock
} from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vehicles', icon: Car, label: 'Vehicles' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/kb', icon: BookOpen, label: 'Knowledge Base' },
  { to: '/infrastructure', icon: Server, label: 'Infrastructure' },
  { to: '/astrometrics', icon: Telescope, label: 'Astrometrics' },
  { to: '/trek', icon: Library, label: 'Database' },
  { to: '/work-hours', icon: Clock, label: 'Work Hours' },
]

export default function GlassSidebar({ collapsed, onToggle }) {
  return (
    <nav className={`glass-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo / Brand */}
      <div
        style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem 1rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '0.625rem',
          minHeight: '60px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <img
          src="/icon.svg"
          alt="Datacore"
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            flexShrink: 0,
          }}
        />
        {!collapsed && (
          <span style={{
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: '-0.02em',
            color: 'rgba(255, 255, 255, 0.92)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}>
            Datacore
          </span>
        )}
      </div>

      {/* Nav Links */}
      <div style={{
        padding: '0.75rem 0.5rem',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>
        {NAV_ITEMS.map(item => (
          <GlassNavLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </div>

      {/* Bottom: Settings + Collapse toggle */}
      <div style={{
        padding: '0.5rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        position: 'relative',
        zIndex: 1,
      }}>
        <GlassNavLink to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />

        <button
          onClick={onToggle}
          style={{
            padding: '0.5rem',
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.25)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '10px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.70)'
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.25)'
            e.currentTarget.style.background = 'none'
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </nav>
  )
}

/**
 * Individual nav link with Apple-style hover illumination.
 * Active: system blue tint background + blue text.
 * Hover: subtle material illumination (white glow from within).
 */
export function GlassNavLink({ to, icon: Icon, label, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      className="glass-nav-link"
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '0.75rem',
        padding: collapsed ? '0.625rem' : '0.5rem 0.75rem',
        borderRadius: '10px',
        textDecoration: 'none',
        fontSize: '0.85rem',
        fontWeight: isActive ? 600 : 500,
        color: isActive ? '#0A84FF' : 'rgba(255, 255, 255, 0.55)',
        background: isActive ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        position: 'relative',
      })}
    >
      <Icon size={20} style={{ flexShrink: 0 }} />
      {!collapsed && label}
    </NavLink>
  )
}
