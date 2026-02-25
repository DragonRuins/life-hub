/**
 * GlassHeader.jsx - Glass Theme Top Bar
 *
 * Glass-blurred header bar across the top of the content area.
 * Right side: NotificationBell, SmartHome, chat toggle, theme switcher, fullscreen, settings.
 * Mobile: hamburger menu button on the left.
 */
import { useState, useEffect, useCallback } from 'react'
import { Menu, Maximize, Minimize, MessageSquare, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import NotificationBell from '../../components/NotificationBell'
import SmartHomeQuickMenu from '../../components/SmartHomeQuickMenu'
import ThemeSwitcher from '../../components/ThemeSwitcher'

export default function GlassHeader({ isMobile, onMenuClick, chat }) {
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

  const btnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.45)',
    cursor: 'pointer',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
  }

  const handleHover = (e) => {
    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.80)'
  }

  const handleLeave = (e) => {
    e.currentTarget.style.background = 'transparent'
    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)'
  }

  return (
    <div className="glass-header">
      {/* Left side: hamburger on mobile */}
      {isMobile ? (
        <button onClick={onMenuClick} style={btnStyle}>
          <Menu size={22} />
        </button>
      ) : (
        <div />
      )}

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <NotificationBell />
        <SmartHomeQuickMenu />

        {/* Chat toggle */}
        <button
          onClick={() => chat?.toggle()}
          title="AI Assistant"
          style={{
            ...btnStyle,
            background: chat?.isOpen ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
            color: chat?.isOpen ? '#0A84FF' : 'rgba(255, 255, 255, 0.45)',
          }}
          onMouseEnter={handleHover}
          onMouseLeave={e => {
            if (!chat?.isOpen) handleLeave(e)
          }}
        >
          <MessageSquare size={18} />
        </button>

        <ThemeSwitcher />

        {/* Fullscreen (desktop only) */}
        {!isMobile && (
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            style={btnStyle}
            onMouseEnter={handleHover}
            onMouseLeave={handleLeave}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        )}

        {/* Settings link */}
        <Link
          to="/settings"
          title="Settings"
          style={{
            ...btnStyle,
            textDecoration: 'none',
          }}
          onMouseEnter={handleHover}
          onMouseLeave={handleLeave}
        >
          <Settings size={18} />
        </Link>
      </div>
    </div>
  )
}
