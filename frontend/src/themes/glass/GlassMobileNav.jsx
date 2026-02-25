/**
 * GlassMobileNav.jsx - Bottom Tab Bar for Mobile
 *
 * Fixed bottom navigation bar with glass blur for the glass theme.
 * Apple-style tab bar: 5 primary tabs with "More" for overflow.
 * Active tab shows system blue icon + label.
 * Respects safe-area-inset-bottom for iPhone home indicator.
 */
import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, BookOpen, MoreHorizontal, Server, FolderKanban, Telescope, Library, Settings, X } from 'lucide-react'

const PRIMARY_TABS = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/vehicles', icon: Car, label: 'Vehicles' },
  { to: '/notes', icon: StickyNote, label: 'Notes' },
  { to: '/kb', icon: BookOpen, label: 'Library' },
]

const MORE_ITEMS = [
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/infrastructure', icon: Server, label: 'Infrastructure' },
  { to: '/astrometrics', icon: Telescope, label: 'Astrometrics' },
  { to: '/trek', icon: Library, label: 'Database' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function GlassMobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Close "More" sheet when navigating
  useEffect(() => {
    setMoreOpen(false)
  }, [location.pathname])

  // Close on click outside
  useEffect(() => {
    if (!moreOpen) return
    function handleClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) {
        setMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [moreOpen])

  // Check if a "More" item is active
  const moreActive = MORE_ITEMS.some(item => location.pathname.startsWith(item.to) && item.to !== '/')

  return (
    <>
      {/* More action sheet */}
      {moreOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 99,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 0.5rem',
          }}
        >
          <div
            ref={moreRef}
            className="glass-modal-animate"
            style={{
              width: '100%',
              maxWidth: '400px',
              marginBottom: `calc(var(--glass-mobile-nav-height) + env(safe-area-inset-bottom, 0px) + 0.5rem)`,
              background: 'rgba(30, 30, 40, 0.92)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '16px',
              padding: '6px',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
            }}
          >
            {MORE_ITEMS.map(item => {
              const Icon = item.icon
              const isActive = location.pathname.startsWith(item.to) && item.to !== '/'
              return (
                <button
                  key={item.to}
                  onClick={() => {
                    navigate(item.to)
                    setMoreOpen(false)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isActive ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
                    color: isActive ? '#0A84FF' : 'rgba(255, 255, 255, 0.80)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 500,
                    textAlign: 'left',
                  }}
                >
                  <Icon size={20} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <div className="glass-mobile-nav">
        <nav style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          height: 'var(--glass-mobile-nav-height)',
          padding: '0 4px',
        }}>
          {PRIMARY_TABS.map(tab => (
            <TabItem key={tab.to} {...tab} />
          ))}
          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              padding: '6px 12px',
              background: 'none',
              border: 'none',
              color: moreOpen || moreActive ? '#0A84FF' : 'rgba(255, 255, 255, 0.40)',
              cursor: 'pointer',
              fontSize: '0.625rem',
              fontWeight: 500,
              letterSpacing: '0.02em',
              transition: 'color 0.15s ease',
            }}
          >
            {moreOpen ? <X size={22} /> : <MoreHorizontal size={22} />}
            <span>More</span>
          </button>
        </nav>
      </div>
    </>
  )
}

function TabItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '3px',
        padding: '6px 12px',
        textDecoration: 'none',
        color: isActive ? '#0A84FF' : 'rgba(255, 255, 255, 0.40)',
        fontSize: '0.625rem',
        fontWeight: isActive ? 600 : 500,
        letterSpacing: '0.02em',
        transition: 'color 0.15s ease',
      })}
    >
      <Icon size={22} />
      <span>{label}</span>
    </NavLink>
  )
}
