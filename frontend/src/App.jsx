/**
 * App.jsx - Main Application Shell
 *
 * Sets up the router and the sidebar layout.
 * Each "page" is a module that renders in the main content area.
 * Standalone pages (like FuelEntry) render without the sidebar.
 */
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, FolderKanban, BookOpen, ChevronLeft, ChevronRight, Settings, Monitor, Menu, X, Star, Server } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from './themes/lcars/ThemeProvider'
import useIsMobile from './hooks/useIsMobile'
import { vehicles as vehiclesApi } from './api/client'

import Dashboard from './pages/Dashboard'
import Vehicles from './pages/Vehicles'
import VehicleDetail from './pages/VehicleDetail'
import Notes from './pages/notes/Notes'
import Notifications from './pages/Notifications'
import FuelEconomy from './pages/FuelEconomy'
import FuelEntry from './pages/FuelEntry'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import NotificationBell from './components/NotificationBell'
import LCARSLayout from './themes/lcars/LCARSLayout'
import LCARSBootSequence from './themes/lcars/LCARSBootSequence'
import LCARSDashboard from './themes/lcars/LCARSDashboard'
import LCARSFuelEconomy from './themes/lcars/LCARSFuelEconomy'
import LCARSVehicles from './themes/lcars/LCARSVehicles'
import LCARSVehicleDetail from './themes/lcars/LCARSVehicleDetail'
import LCARSNotes from './themes/lcars/LCARSNotes'
import LCARSProjects from './themes/lcars/LCARSProjects'
import LCARSProjectDetail from './themes/lcars/LCARSProjectDetail'
import KnowledgeBase from './pages/kb/KnowledgeBase'
import LCARSKnowledgeBase from './themes/lcars/LCARSKnowledgeBase'
import Infrastructure from './pages/Infrastructure'
import InfraHostDetail from './pages/InfraHostDetail'
import InfraNetwork from './pages/InfraNetwork'
import InfraServices from './pages/InfraServices'
import InfraIncidents from './pages/InfraIncidents'
import InfraIntegrations from './pages/InfraIntegrations'
import LCARSInfrastructure from './themes/lcars/LCARSInfrastructure'
import LCARSInfraHostDetail from './themes/lcars/LCARSInfraHostDetail'
import LCARSInfraNetwork from './themes/lcars/LCARSInfraNetwork'
import LCARSInfraServices from './themes/lcars/LCARSInfraServices'
import LCARSInfraIncidents from './themes/lcars/LCARSInfraIncidents'
import LCARSInfraIntegrations from './themes/lcars/LCARSInfraIntegrations'

export default function App() {
  const { isLCARS, booting } = useTheme()

  return (
    <BrowserRouter>
      {/* Boot sequence overlay (only when transitioning TO LCARS) */}
      {booting && <LCARSBootSequence />}

      <Routes>
        {/* FuelEntry: standalone in default theme, gets LCARS frame when active */}
        <Route
          path="/fuel/add/:id"
          element={
            isLCARS ? (
              <LCARSLayout><FuelEntry /></LCARSLayout>
            ) : (
              <FuelEntry />
            )
          }
        />

        {/* Main app with sidebar (default) or LCARS frame */}
        <Route path="*" element={isLCARS ? <LCARSAppShell /> : <AppShell />} />
      </Routes>
    </BrowserRouter>
  )
}

/**
 * LCARS version of the app shell.
 * Renders all page routes inside the LCARS frame layout.
 */
function LCARSAppShell() {
  return (
    <LCARSLayout>
      <Routes>
        <Route path="/" element={<LCARSDashboard />} />
        <Route path="/vehicles" element={<LCARSVehicles />} />
        <Route path="/vehicles/:id" element={<LCARSVehicleDetail />} />
        <Route path="/vehicles/:id/fuel" element={<LCARSFuelEconomy />} />
        <Route path="/notes" element={<LCARSNotes />} />
        <Route path="/projects" element={<LCARSProjects />} />
        <Route path="/projects/:slug" element={<LCARSProjectDetail />} />
        <Route path="/kb" element={<LCARSKnowledgeBase />} />
        <Route path="/kb/:slug" element={<LCARSKnowledgeBase />} />
        <Route path="/kb/:slug/edit" element={<LCARSKnowledgeBase />} />
        <Route path="/infrastructure" element={<LCARSInfrastructure />} />
        <Route path="/infrastructure/hosts/:id" element={<LCARSInfraHostDetail />} />
        <Route path="/infrastructure/network" element={<LCARSInfraNetwork />} />
        <Route path="/infrastructure/services" element={<LCARSInfraServices />} />
        <Route path="/infrastructure/incidents" element={<LCARSInfraIncidents />} />
        <Route path="/infrastructure/integrations" element={<LCARSInfraIntegrations />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>
    </LCARSLayout>
  )
}

/**
 * Main app shell with sidebar navigation.
 * Separated so standalone pages (like FuelEntry) can render without it.
 */
function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()

  // Close drawer when switching away from mobile
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  return (
    <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
      {/* ── Sidebar Navigation (desktop only) ──────────────── */}
      {!isMobile && (
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
            <img
              src="/icon.svg"
              alt="Datacore"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                flexShrink: 0,
              }}
            />
            {!sidebarCollapsed && (
              <span style={{ fontWeight: 600, fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                Datacore
              </span>
            )}
          </div>

          {/* Nav Links */}
          <div style={{ padding: '0.75rem 0.625rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" collapsed={sidebarCollapsed} />
            <SidebarLink to="/vehicles" icon={<Car size={20} />} label="Vehicles" collapsed={sidebarCollapsed} />
            <SidebarLink to="/notes" icon={<StickyNote size={20} />} label="Notes" collapsed={sidebarCollapsed} />
            <SidebarLink to="/projects" icon={<FolderKanban size={20} />} label="Projects" collapsed={sidebarCollapsed} />
            <SidebarLink to="/kb" icon={<BookOpen size={20} />} label="Knowledge Base" collapsed={sidebarCollapsed} />
            <SidebarLink to="/infrastructure" icon={<Server size={20} />} label="Infrastructure" collapsed={sidebarCollapsed} />
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
      )}

      {/* ── Mobile Drawer Overlay ──────────────────────────── */}
      {isMobile && drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 999,
          }}
        >
          <nav
            onClick={e => e.stopPropagation()}
            style={{
              width: '260px',
              height: '100%',
              background: 'var(--color-mantle)',
              borderRight: '1px solid var(--color-surface-0)',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideIn 0.2s ease',
            }}
          >
            {/* Drawer header */}
            <div
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid var(--color-surface-0)',
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
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                  }}
                />
                <span style={{ fontWeight: 600, fontSize: '1.05rem' }}>Datacore</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-overlay-0)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav Links */}
            <div style={{ padding: '0.75rem 0.625rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <SidebarLink to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" collapsed={false} onClick={() => setDrawerOpen(false)} />
              <SidebarLink to="/vehicles" icon={<Car size={20} />} label="Vehicles" collapsed={false} onClick={() => setDrawerOpen(false)} />
              <SidebarLink to="/notes" icon={<StickyNote size={20} />} label="Notes" collapsed={false} onClick={() => setDrawerOpen(false)} />
              <SidebarLink to="/projects" icon={<FolderKanban size={20} />} label="Projects" collapsed={false} onClick={() => setDrawerOpen(false)} />
              <SidebarLink to="/kb" icon={<BookOpen size={20} />} label="Knowledge Base" collapsed={false} onClick={() => setDrawerOpen(false)} />
              <SidebarLink to="/infrastructure" icon={<Server size={20} />} label="Infrastructure" collapsed={false} onClick={() => setDrawerOpen(false)} />
            </div>
          </nav>
        </div>
      )}

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
        <HeaderBar isMobile={isMobile} onMenuClick={() => setDrawerOpen(true)} />

        {/* Page Content */}
        <div style={{ flex: 1, padding: isMobile ? '1rem' : '2rem' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/vehicles/:id" element={<VehicleDetail />} />
            <Route path="/vehicles/:id/fuel" element={<FuelEconomy />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:slug" element={<ProjectDetail />} />
            <Route path="/kb" element={<KnowledgeBase />} />
            <Route path="/kb/:slug" element={<KnowledgeBase />} />
            <Route path="/kb/:slug/edit" element={<KnowledgeBase />} />
            <Route path="/infrastructure" element={<Infrastructure />} />
            <Route path="/infrastructure/hosts/:id" element={<InfraHostDetail />} />
            <Route path="/infrastructure/network" element={<InfraNetwork />} />
            <Route path="/infrastructure/services" element={<InfraServices />} />
            <Route path="/infrastructure/incidents" element={<InfraIncidents />} />
            <Route path="/infrastructure/integrations" element={<InfraIntegrations />} />
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
function HeaderBar({ isMobile, onMenuClick }) {
  const [gearOpen, setGearOpen] = useState(false)
  const [vehicleList, setVehicleList] = useState([])
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    localStorage.getItem('dashboard_vehicle_id') || 'all'
  )
  const gearRef = useRef(null)
  const navigate = useNavigate()
  const { theme, setTheme, isLCARS } = useTheme()

  // Fetch vehicle list when gear dropdown opens
  useEffect(() => {
    if (gearOpen && vehicleList.length === 0) {
      vehiclesApi.list().then(setVehicleList).catch(() => {})
    }
  }, [gearOpen])

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

  function handleVehicleSelect(id) {
    setSelectedVehicleId(id)
    localStorage.setItem('dashboard_vehicle_id', id)
    window.dispatchEvent(new Event('vehicle-selection-changed'))
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: isMobile ? 'space-between' : 'flex-end',
      padding: isMobile ? '0.5rem 1rem' : '0.5rem 1.5rem',
      paddingTop: isMobile ? 'calc(0.5rem + env(safe-area-inset-top, 0px))' : '0.5rem',
      borderBottom: '1px solid var(--color-surface-0)',
      background: 'var(--color-mantle)',
      gap: '0.5rem',
      minHeight: '48px',
      position: 'sticky',
      top: 0,
      zIndex: 10,
    }}>
      {/* Hamburger menu (mobile only) */}
      {isMobile && (
        <button
          onClick={onMenuClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            color: 'var(--color-subtext-0)',
            cursor: 'pointer',
          }}
        >
          <Menu size={22} />
        </button>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

            {/* Vehicle Selector */}
            {vehicleList.length > 0 && (
              <div style={{ borderTop: '1px solid var(--color-surface-0)' }}>
                <div style={{
                  padding: '0.5rem 1rem 0.25rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: 'var(--color-subtext-0)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Dashboard Vehicle
                </div>
                <button
                  onClick={() => handleVehicleSelect('all')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    padding: '0.4rem 1rem',
                    background: 'none',
                    border: 'none',
                    color: selectedVehicleId === 'all' ? 'var(--color-blue)' : 'var(--color-text)',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    fontWeight: selectedVehicleId === 'all' ? 600 : 400,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  All Fleet
                </button>
                {vehicleList.map(v => (
                  <button
                    key={v.id}
                    onClick={() => handleVehicleSelect(String(v.id))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      width: '100%',
                      padding: '0.4rem 1rem',
                      background: 'none',
                      border: 'none',
                      color: selectedVehicleId === String(v.id) ? 'var(--color-blue)' : 'var(--color-text)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      fontWeight: selectedVehicleId === String(v.id) ? 600 : 400,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {v.is_primary && <Star size={12} fill="var(--color-yellow)" style={{ color: 'var(--color-yellow)', flexShrink: 0 }} />}
                    {v.year} {v.make} {v.model}
                  </button>
                ))}
              </div>
            )}

            {/* Theme Toggle */}
            <button
              onClick={() => {
                setTheme(isLCARS ? 'catppuccin' : 'lcars')
                setGearOpen(false)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--color-surface-0)',
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
              <Monitor size={16} />
              Theme: {isLCARS ? 'LCARS' : 'Catppuccin'}
            </button>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}


/**
 * Sidebar navigation link component.
 * Highlights when the current route matches.
 */
function SidebarLink({ to, icon, label, collapsed, onClick }) {
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
