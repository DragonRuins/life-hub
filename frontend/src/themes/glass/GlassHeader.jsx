/**
 * GlassHeader.jsx - Minimal Floating Header Controls
 *
 * Content-first philosophy: no solid header bar. Controls float
 * in the top-right (desktop) or spread across top (mobile).
 * The parent GlassLayout positions this inside .glass-header-bar.
 *
 * Desktop: right-aligned controls (notification, chat, theme, fullscreen, settings)
 * Mobile: hamburger left, controls right
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
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.40)',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  }

  const handleHover = (e) => {
    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.80)'
  }

  const handleLeave = (e) => {
    e.currentTarget.style.background = 'transparent'
    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.40)'
  }

  return (
    <>
      {/* Left side: hamburger on mobile */}
      {isMobile ? (
        <button onClick={onMenuClick} style={btnStyle} onMouseEnter={handleHover} onMouseLeave={handleLeave}>
          <Menu size={22} />
        </button>
      ) : (
        <div />
      )}

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <NotificationBell />
        <SmartHomeQuickMenu />

        {/* Chat toggle */}
        <button
          onClick={() => chat?.toggle()}
          title="AI Assistant"
          style={{
            ...btnStyle,
            background: chat?.isOpen ? 'rgba(10, 132, 255, 0.12)' : 'transparent',
            color: chat?.isOpen ? '#0A84FF' : 'rgba(255, 255, 255, 0.40)',
          }}
          onMouseEnter={handleHover}
          onMouseLeave={e => {
            if (!chat?.isOpen) handleLeave(e)
          }}
        >
          <MessageSquare size={17} />
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
            {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
          </button>
        )}

        {/* Settings link */}
        <Link
          to="/settings"
          title="Settings"
          style={{ ...btnStyle, textDecoration: 'none' }}
          onMouseEnter={handleHover}
          onMouseLeave={handleLeave}
        >
          <Settings size={17} />
        </Link>
      </div>
    </>
  )
}
