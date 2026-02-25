/**
 * GlassSidebar.jsx - Glass Theme Sidebar Navigation
 *
 * Translucent glass sidebar with Apple-style nav items.
 * Collapsible (icon-only mode) with smooth width transition.
 * Active item has system blue tint background.
 */
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, FolderKanban, BookOpen, Server, Telescope, Library, ChevronLeft, ChevronRight, Settings } from 'lucide-react'

export const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/vehicles', icon: Car, label: 'Vehicles' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/kb', icon: BookOpen, label: 'Knowledge Base' },
  { to: '/infrastructure', icon: Server, label: 'Infrastructure' },
  { to: '/astrometrics', icon: Telescope, label: 'Astrometrics' },
  { to: '/trek', icon: Library, label: 'Database' },
]

export default function GlassSidebar({ collapsed, onToggle }) {
  return (
    <nav className={`glass-sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Logo / Brand */}
      <div
        style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem 1.25rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: '0.625rem',
          minHeight: '64px',
        }}
      >
        <img
          src="/icon.svg"
          alt="Datacore"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            flexShrink: 0,
          }}
        />
        {!collapsed && (
          <span style={{
            fontWeight: 600,
            fontSize: '1.05rem',
            letterSpacing: '-0.01em',
            color: 'rgba(255, 255, 255, 0.92)',
          }}>
            Datacore
          </span>
        )}
      </div>

      {/* Nav Links */}
      <div style={{
        padding: '0.75rem 0.625rem',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        {NAV_ITEMS.map(item => (
          <GlassNavLink key={item.to} {...item} collapsed={collapsed} />
        ))}
      </div>

      {/* Bottom: Settings + Collapse */}
      <div style={{
        padding: '0.5rem 0.625rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}>
        <GlassNavLink to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />

        <button
          onClick={onToggle}
          style={{
            padding: '0.625rem',
            background: 'none',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.30)',
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
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.30)'
            e.currentTarget.style.background = 'none'
          }}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
    </nav>
  )
}

/** Individual nav link with Apple-style hover/active states */
export function GlassNavLink({ to, icon: Icon, label, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '0.75rem',
        padding: collapsed ? '0.625rem' : '0.625rem 0.875rem',
        borderRadius: '10px',
        textDecoration: 'none',
        fontSize: '0.875rem',
        fontWeight: isActive ? 600 : 500,
        color: isActive ? '#0A84FF' : 'rgba(255, 255, 255, 0.55)',
        background: isActive ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
      })}
    >
      <Icon size={20} />
      {!collapsed && label}
    </NavLink>
  )
}
