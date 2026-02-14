/**
 * App.jsx - Main Application Shell
 *
 * Sets up the router and the sidebar layout.
 * Each "page" is a module that renders in the main content area.
 * Standalone pages (like FuelEntry) render without the sidebar.
 */
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, Settings, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import Dashboard from './pages/Dashboard'
import Vehicles from './pages/Vehicles'
import VehicleDetail from './pages/VehicleDetail'
import Notes from './pages/Notes'
import FuelEconomy from './pages/FuelEconomy'
import FuelEntry from './pages/FuelEntry'

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
          padding: '2rem',
          overflowY: 'auto',
          background: 'var(--color-crust)',
        }}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/vehicles/:id" element={<VehicleDetail />} />
          <Route path="/vehicles/:id/fuel" element={<FuelEconomy />} />
          <Route path="/notes" element={<Notes />} />
        </Routes>
      </main>
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
