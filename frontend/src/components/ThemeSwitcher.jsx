/**
 * ThemeSwitcher.jsx - Three-Way Theme Dropdown
 *
 * Dropdown button (Palette icon) that opens a popover with three
 * theme options: Catppuccin, Liquid Glass, and LCARS.
 * Each option shows name, short description, and color swatch preview.
 * Dropdown styling adapts to the current theme via CSS variables.
 * Closes on click outside or Escape key.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Palette, Monitor, Sparkles, Tv } from 'lucide-react'
import { useTheme } from '../themes/lcars/ThemeProvider'

const THEMES = [
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    description: 'Warm dark theme',
    icon: Monitor,
    swatches: ['#89b4fa', '#a6e3a1', '#fab387', '#cba6f7'],
  },
  {
    id: 'glass',
    name: 'Liquid Glass',
    description: 'Apple-inspired glass',
    icon: Sparkles,
    swatches: ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2'],
  },
  {
    id: 'lcars',
    name: 'LCARS',
    description: 'Star Trek interface',
    icon: Tv,
    swatches: ['#FFCC99', '#CC99FF', '#FF9966', '#99CCFF'],
  },
]

export default function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  const handleSelect = useCallback((themeId) => {
    setTheme(themeId)
    setOpen(false)
  }, [setTheme])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        title="Switch theme"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          background: open ? 'rgba(137, 180, 250, 0.1)' : 'transparent',
          border: 'none',
          color: open ? 'var(--color-blue)' : 'var(--color-subtext-0)',
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        onMouseEnter={e => {
          if (!open) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)'
        }}
        onMouseLeave={e => {
          if (!open) e.currentTarget.style.background = 'transparent'
        }}
      >
        <Palette size={18} />
      </button>

      {/* Dropdown popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '240px',
            background: 'var(--color-base)',
            border: '1px solid var(--color-surface-0)',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            padding: '6px',
            zIndex: 1000,
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          }}
        >
          {THEMES.map(t => {
            const isActive = theme === t.id
            const Icon = t.icon
            return (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? 'rgba(137, 180, 250, 0.1)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                  color: 'var(--color-text)',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'var(--color-surface-0)'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* Icon */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: isActive ? 'rgba(137, 180, 250, 0.15)' : 'var(--color-surface-0)',
                  flexShrink: 0,
                }}>
                  <Icon size={16} style={{ color: isActive ? 'var(--color-blue)' : 'var(--color-subtext-0)' }} />
                </div>

                {/* Name + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--color-blue)' : 'var(--color-text)',
                    lineHeight: 1.3,
                  }}>
                    {t.name}
                  </div>
                  <div style={{
                    fontSize: '0.72rem',
                    color: 'var(--color-subtext-0)',
                    lineHeight: 1.3,
                  }}>
                    {t.description}
                  </div>
                </div>

                {/* Color swatches */}
                <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                  {t.swatches.map((color, i) => (
                    <div
                      key={i}
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: color,
                      }}
                    />
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
