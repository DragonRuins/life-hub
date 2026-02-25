/**
 * GlassLayout.jsx - Glass Theme App Shell
 *
 * CSS Grid shell for the Liquid Glass theme.
 * Desktop: GlassSidebar + GlassHeader + scrollable content area
 * Mobile: GlassHeader (with hamburger) + content + GlassMobileNav (bottom)
 *
 * Replaces AppShell when the glass theme is active.
 */
import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { X, Settings } from 'lucide-react'
import './GlassLayout.css'
import GlassSidebar, { NAV_ITEMS, GlassNavLink } from './GlassSidebar'
import GlassHeader from './GlassHeader'
import GlassMobileNav from './GlassMobileNav'
import useIsMobile from '../../hooks/useIsMobile'

export default function GlassLayout({ children, chat }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const location = useLocation()

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  // Close drawer when switching away from mobile
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  // Page transition state
  const [pageOut, setPageOut] = useState(false)
  const prevPathRef = useRef(location.pathname)

  useEffect(() => {
    if (location.pathname !== prevPathRef.current) {
      prevPathRef.current = location.pathname
      setPageOut(true)
      const timer = setTimeout(() => setPageOut(false), 100)
      return () => clearTimeout(timer)
    }
  }, [location.pathname])

  return (
    <div className="glass-layout">
      {/* Desktop sidebar */}
      {!isMobile && (
        <GlassSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Mobile drawer overlay */}
      {isMobile && drawerOpen && (
        <div
          className="glass-drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
        >
          <div className="glass-drawer" onClick={e => e.stopPropagation()}>
            {/* Drawer header */}
            <div
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: '64px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <img
                  src="/icon.svg"
                  alt="Datacore"
                  style={{ width: '32px', height: '32px', borderRadius: '10px' }}
                />
                <span style={{
                  fontWeight: 600,
                  fontSize: '1.05rem',
                  color: 'rgba(255, 255, 255, 0.92)',
                }}>
                  Datacore
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.55)',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer nav links */}
            <div style={{
              padding: '0.75rem 0.625rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}>
              {NAV_ITEMS.map(item => (
                <GlassNavLink key={item.to} {...item} collapsed={false} onClick={() => setDrawerOpen(false)} />
              ))}
            </div>
            <div style={{
              padding: '0.5rem 0.625rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <GlassNavLink to="/settings" icon={Settings} label="Settings" collapsed={false} onClick={() => setDrawerOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main content area */}
      <main className="glass-main">
        <GlassHeader
          isMobile={isMobile}
          onMenuClick={() => setDrawerOpen(true)}
          chat={chat}
        />

        <div
          className={`glass-content ${pageOut ? 'glass-page-exit' : 'glass-page-enter'}`}
        >
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && <GlassMobileNav />}
    </div>
  )
}
