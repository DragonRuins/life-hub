/**
 * App.jsx - Main Application Shell
 *
 * Sets up the router and the sidebar layout.
 * Each "page" is a module that renders in the main content area.
 * Standalone pages (like FuelEntry) render without the sidebar.
 */
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

import Dashboard from './pages/Dashboard'
import Vehicles from './pages/Vehicles'
import VehicleDetail from './pages/VehicleDetail'
import Notes from './pages/Notes'
import Notifications from './pages/Notifications'
import FuelEconomy from './pages/FuelEconomy'
import FuelEntry from './pages/FuelEntry'
import NotificationBell from './components/NotificationBell'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone pages (no sidebar) */}
        <Route path="/fuel/add/:id" element={<FuelEntry />} />

        {/* Main app with sidebar */}
        <Route path="*" element={<AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}

/**
 * Main app shell with sidebar navigation.
 * Separated so standalone pages (like FuelEntry) can render without it.
 */
function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Sidebar Navigation ────────────────────────────── */}
      <nav
        style={{
          width: sidebarCollapsed ? '68px' : '220px',
          background: 'var(--color-mantle)',
          borderRight: '1px solid var(--color-surface-0)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s ease',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {/* Logo / Brand */}
        <div
          style={{
            padding: sidebarCollapsed ? '1.25rem 0' : '1.25rem 1.25rem',
            borderBottom: '1px solid var(--color-surface-0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: '0.625rem',
            minHeight: '64px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, var(--color-blue), var(--color-mauve))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--color-crust)',
              flexShrink: 0,
            }}
          >
            LH
          </div>
          {!sidebarCollapsed && (
            <span style={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
              Life Hub
            </span>
          )}
        </div>

        {/* Nav Links */}
        <div style={{ padding: '0.75rem 0.625rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" collapsed={sidebarCollapsed} />
          <SidebarLink to="/vehicles" icon={<Car size={20} />} label="Vehicles" collapsed={sidebarCollapsed} />
          <SidebarLink to="/notes" icon={<StickyNote size={20} />} label="Notes" collapsed={sidebarCollapsed} />
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          style={{
            padding: '0.75rem',
            background: 'none',
            border: 'none',
            borderTop: '1px solid var(--color-surface-0)',
            color: 'var(--color-overlay-0)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
          }}
          onMouseEnter={e => e.target.style.color = 'var(--color-text)'}
          onMouseLeave={e => e.target.style.color = 'var(--color-overlay-0)'}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </nav>

      {/* ── Main Content Area ─────────────────────────────── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          background: 'var(--color-crust)',
        }}
      >
        {/* Header Bar */}
        <HeaderBar />

        {/* Page Content */}
        <div style={{ flex: 1, padding: '2rem' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/vehicles/:id" element={<VehicleDetail />} />
            <Route path="/vehicles/:id/fuel" element={<FuelEconomy />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notifications" element={<Notifications />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}


/**
 * Header bar with notification bell and settings gear dropdown.
 * Sits at the top of the main content area.
 */
function HeaderBar() {
  const [gearOpen, setGearOpen] = useState(false)
  const gearRef = useRef(null)
  const navigate = useNavigate()

  // Close gear dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (gearRef.current && !gearRef.current.contains(e.target)) {
        setGearOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0.5rem 1.5rem',
      borderBottom: '1px solid var(--color-surface-0)',
      background: 'var(--color-mantle)',
      gap: '0.5rem',
      minHeight: '48px',
    }}>
      {/* Notification Bell */}
      <NotificationBell />

      {/* Settings Gear */}
      <div ref={gearRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setGearOpen(!gearOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: gearOpen ? 'rgba(137, 180, 250, 0.08)' : 'transparent',
            border: 'none',
            color: gearOpen ? 'var(--color-blue)' : 'var(--color-subtext-0)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => { if (!gearOpen) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)' }}
          onMouseLeave={e => { if (!gearOpen) e.currentTarget.style.background = 'transparent' }}
        >
          <Settings size={20} />
        </button>

        {/* Gear Dropdown */}
        {gearOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            width: '200px',
            background: 'var(--color-base)',
            border: '1px solid var(--color-surface-0)',
            borderRadius: '8px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            overflow: 'hidden',
          }}>
            <button
              onClick={() => { setGearOpen(false); navigate('/notifications') }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'none',
                border: 'none',
                color: 'var(--color-text)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                textAlign: 'left',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              Notifications
            </button>
          </div>
        )}
      </div>
    </div>
  )
}


/**
 * Sidebar navigation link component.
 * Highlights when the current route matches.
 */
function SidebarLink({ to, icon, label, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '0.75rem',
        padding: collapsed ? '0.625rem' : '0.625rem 0.875rem',
        borderRadius: '8px',
        textDecoration: 'none',
        fontSize: '0.9rem',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? 'var(--color-blue)' : 'var(--color-subtext-0)',
        background: isActive ? 'rgba(137, 180, 250, 0.08)' : 'transparent',
        transition: 'all 0.15s ease',
      })}
    >
      {icon}
      {!collapsed && label}
    </NavLink>
  )
}
