/**
 * App.jsx - Main Application Shell
 *
 * Sets up the router and the sidebar layout.
 * Each "page" is a module that renders in the main content area.
 * Standalone pages (like FuelEntry) render without the sidebar.
 */
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom'
import { LayoutDashboard, Car, StickyNote, FolderKanban, BookOpen, ChevronLeft, ChevronRight, Settings, Menu, X, Server, Telescope, Library, Maximize, Minimize, MessageSquare, Clock } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { useTheme } from './themes/lcars/ThemeProvider'
import useIsMobile from './hooks/useIsMobile'
import useChat from './hooks/useChat'

import Dashboard from './pages/Dashboard'
import Vehicles from './pages/Vehicles'
import VehicleDetail from './pages/VehicleDetail'
import Notes from './pages/notes/Notes'
import Notifications from './pages/Notifications'
import FuelEconomy from './pages/FuelEconomy'
import FuelEntry from './pages/FuelEntry'
import WorkHours from './pages/WorkHours'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import NotificationBell from './components/NotificationBell'
import SmartHomeQuickMenu from './components/SmartHomeQuickMenu'
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
import InfraSmartHome from './pages/InfraSmartHome'
import InfraPrinter from './pages/InfraPrinter'
import LCARSInfrastructure from './themes/lcars/LCARSInfrastructure'
import LCARSInfraHostDetail from './themes/lcars/LCARSInfraHostDetail'
import LCARSInfraNetwork from './themes/lcars/LCARSInfraNetwork'
import LCARSInfraServices from './themes/lcars/LCARSInfraServices'
import LCARSInfraIncidents from './themes/lcars/LCARSInfraIncidents'
import LCARSInfraIntegrations from './themes/lcars/LCARSInfraIntegrations'
import LCARSInfraSmartHome from './themes/lcars/LCARSInfraSmartHome'
import LCARSInfraPrinter from './themes/lcars/LCARSInfraPrinter'
import Astrometrics from './pages/Astrometrics'
import LCARSAstrometrics from './themes/lcars/LCARSAstrometrics'
import TrekDatabase from './pages/TrekDatabase'
import TrekBrowse from './pages/trek/TrekBrowse'
import TrekDetail from './pages/trek/TrekDetail'
import TrekEpisodes from './pages/trek/TrekEpisodes'
import TrekShips from './pages/trek/TrekShips'
import TrekSearch from './pages/trek/TrekSearch'
import TrekFavorites from './pages/trek/TrekFavorites'
import LCARSTrekDatabase from './themes/lcars/LCARSTrekDatabase'
import LCARSTrekBrowse from './themes/lcars/LCARSTrekBrowse'
import LCARSTrekDetail from './themes/lcars/LCARSTrekDetail'
import LCARSTrekEpisodes from './themes/lcars/LCARSTrekEpisodes'
import LCARSTrekShips from './themes/lcars/LCARSTrekShips'
import LCARSTrekSearch from './themes/lcars/LCARSTrekSearch'
import LCARSTrekFavorites from './themes/lcars/LCARSTrekFavorites'
import SettingsPage from './pages/Settings'
import LCARSWorkHours from './themes/lcars/LCARSWorkHours'
import LCARSSettings from './themes/lcars/LCARSSettings'
import ChatWidget from './components/ChatWidget'
import LCARSChatTerminal from './themes/lcars/LCARSChatTerminal'

// Settings sub-pages
import VehicleSettings from './pages/settings/VehicleSettings'
import AstroSettings from './pages/settings/AstroSettings'
import NotificationSettings from './pages/settings/NotificationSettings'
import LCARSVehicleSettings from './themes/lcars/settings/LCARSVehicleSettings'
import LCARSAstroSettings from './themes/lcars/settings/LCARSAstroSettings'
import LCARSNotificationSettings from './themes/lcars/settings/LCARSNotificationSettings'
import AISettings from './pages/settings/AISettings'
import LCARSAISettings from './themes/lcars/settings/LCARSAISettings'
import DataImport from './pages/settings/DataImport'
import LCARSDataImport from './themes/lcars/settings/LCARSDataImport'

import ThemeSwitcher from './components/ThemeSwitcher'

export default function App() {
  const { isLCARS, booting, lcarsVariant } = useTheme()
  const chat = useChat()

  // Determine which app shell to render
  const shell = isLCARS
    ? <LCARSAppShell chat={chat} />
    : <AppShell chat={chat} />

  return (
    <BrowserRouter>
      {/* Boot sequence overlay (only when transitioning TO LCARS) */}
      {booting && <LCARSBootSequence variant={lcarsVariant} />}

      <Routes>
        {/* FuelEntry: standalone in default theme, gets frame in LCARS */}
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
        <Route path="*" element={shell} />
      </Routes>

      {/* Global chat widget — persists across page navigation */}
      {isLCARS ? <LCARSChatTerminal chat={chat} /> : <ChatWidget chat={chat} />}
    </BrowserRouter>
  )
}

/**
 * LCARS version of the app shell.
 * Renders all page routes inside the LCARS frame layout.
 */
function LCARSAppShell({ chat }) {
  return (
    <LCARSLayout chat={chat}>
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
        <Route path="/infrastructure/smarthome" element={<LCARSInfraSmartHome />} />
        <Route path="/infrastructure/printer" element={<LCARSInfraPrinter />} />
        <Route path="/astrometrics" element={<LCARSAstrometrics />} />
        <Route path="/trek" element={<LCARSTrekDatabase />} />
        <Route path="/trek/search" element={<LCARSTrekSearch />} />
        <Route path="/trek/favorites" element={<LCARSTrekFavorites />} />
        <Route path="/trek/episodes" element={<LCARSTrekEpisodes />} />
        <Route path="/trek/ships" element={<LCARSTrekShips />} />
        <Route path="/trek/:entityType/:uid" element={<LCARSTrekDetail />} />
        <Route path="/trek/:entityType" element={<LCARSTrekBrowse />} />
        <Route path="/work-hours" element={<LCARSWorkHours />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/settings" element={<LCARSSettings />} />
        <Route path="/settings/vehicles" element={<LCARSVehicleSettings />} />
        <Route path="/settings/astrometrics" element={<LCARSAstroSettings />} />
        <Route path="/settings/notifications" element={<LCARSNotificationSettings />} />
        <Route path="/settings/ai" element={<LCARSAISettings />} />
        <Route path="/settings/import" element={<LCARSDataImport />} />
      </Routes>
    </LCARSLayout>
  )
}

/**
 * Main app shell with sidebar navigation.
 * Separated so standalone pages (like FuelEntry) can render without it.
 */
function AppShell({ chat }) {
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
            <SidebarLink to="/astrometrics" icon={<Telescope size={20} />} label="Astrometrics" collapsed={sidebarCollapsed} />
            <SidebarLink to="/trek" icon={<Library size={20} />} label="Database" collapsed={sidebarCollapsed} />
            <SidebarLink to="/work-hours" icon={<Clock size={20} />} label="Work Hours" collapsed={sidebarCollapsed} />
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
              <SidebarLink to="/astrometrics" icon={<Telescope size={20} />} label="Astrometrics" collapsed={false} onClick={() => setDrawerOpen(false)} />
              <SidebarLink to="/trek" icon={<Library size={20} />} label="Database" collapsed={false} onClick={() => setDrawerOpen(false)} />
              <SidebarLink to="/work-hours" icon={<Clock size={20} />} label="Work Hours" collapsed={false} onClick={() => setDrawerOpen(false)} />
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
        <HeaderBar isMobile={isMobile} onMenuClick={() => setDrawerOpen(true)} chat={chat} />

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
            <Route path="/infrastructure/smarthome" element={<InfraSmartHome />} />
            <Route path="/infrastructure/printer" element={<InfraPrinter />} />
            <Route path="/astrometrics" element={<Astrometrics />} />
            <Route path="/trek" element={<TrekDatabase />} />
            <Route path="/trek/search" element={<TrekSearch />} />
            <Route path="/trek/favorites" element={<TrekFavorites />} />
            <Route path="/trek/episodes" element={<TrekEpisodes />} />
            <Route path="/trek/ships" element={<TrekShips />} />
            <Route path="/trek/:entityType/:uid" element={<TrekDetail />} />
            <Route path="/trek/:entityType" element={<TrekBrowse />} />
            <Route path="/work-hours" element={<WorkHours />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/vehicles" element={<VehicleSettings />} />
            <Route path="/settings/astrometrics" element={<AstroSettings />} />
            <Route path="/settings/notifications" element={<NotificationSettings />} />
            <Route path="/settings/ai" element={<AISettings />} />
            <Route path="/settings/import" element={<DataImport />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}


/**
 * Header bar with notification bell, theme toggle, and settings link.
 * Sits at the top of the main content area.
 */
function HeaderBar({ isMobile, onMenuClick, chat }) {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }, [])

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

        {/* Smart Home Quick Menu */}
        <SmartHomeQuickMenu />

        {/* AI Chat Toggle Button */}
        <button
          onClick={() => chat?.toggle()}
          title="AI Assistant"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: chat?.isOpen ? 'rgba(137, 180, 250, 0.1)' : 'transparent',
            border: 'none',
            color: chat?.isOpen ? 'var(--color-blue)' : 'var(--color-subtext-0)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)'}
          onMouseLeave={e => {
            if (!chat?.isOpen) e.currentTarget.style.background = 'transparent'
          }}
        >
          <MessageSquare size={18} />
        </button>

        {/* Theme Switcher Dropdown */}
        <ThemeSwitcher />

        {/* Fullscreen Toggle (desktop only) */}
        {!isMobile && (
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
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
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        )}

        {/* Settings Link (direct navigation, no dropdown) */}
        <Link
          to="/settings"
          title="Settings"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            background: 'transparent',
            color: 'var(--color-subtext-0)',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <Settings size={20} />
        </Link>
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
