/**
 * ThemeProvider.jsx - Theme Context & Provider
 *
 * Manages theme state (catppuccin | lcars), persists to localStorage,
 * and toggles the .lcars-theme class on <html> to activate LCARS CSS overrides.
 *
 * Usage:
 *   import { useTheme } from './themes/lcars/ThemeProvider'
 *   const { theme, setTheme, isLCARS, booting } = useTheme()
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

// Import all LCARS CSS files so they're available when the theme is active
import './lcars-variables.css'
import './lcars-components.css'
import './lcars-animations.css'

const STORAGE_KEY = 'datacore-theme'
const BOOT_DURATION = 1500 // ms for the boot sequence animation

const ThemeContext = createContext(null)

/**
 * Hook to access theme state and controls.
 * Returns { theme, setTheme, isLCARS, booting }
 */
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}

/**
 * ThemeProvider wraps the app and provides theme state to all children.
 * On mount, reads the saved theme from localStorage.
 * When theme changes, toggles .lcars-theme on <html> and saves to localStorage.
 */
export function ThemeProvider({ children }) {
  // Read initial theme from localStorage (default: catppuccin)
  const [theme, setThemeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'catppuccin'
    } catch {
      return 'catppuccin'
    }
  })

  // Boot sequence state — only true during the transition animation TO LCARS
  const [booting, setBooting] = useState(false)
  const bootTimerRef = useRef(null)
  const isInitialMount = useRef(true)

  const isLCARS = theme === 'lcars'

  // Apply or remove the .lcars-theme class on <html>
  useEffect(() => {
    const root = document.documentElement
    if (isLCARS) {
      root.classList.add('lcars-theme')
    } else {
      root.classList.remove('lcars-theme')
    }

    // Save to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Silently fail if localStorage isn't available
    }
  }, [theme, isLCARS])

  // Skip boot sequence on initial mount (page load with LCARS already active)
  useEffect(() => {
    isInitialMount.current = false
  }, [])

  // Theme setter that triggers boot sequence when switching TO LCARS
  const setTheme = useCallback((newTheme) => {
    // Clear any pending boot timer
    if (bootTimerRef.current) {
      clearTimeout(bootTimerRef.current)
      bootTimerRef.current = null
    }

    if (newTheme === 'lcars' && !isInitialMount.current) {
      // Trigger boot sequence animation
      setBooting(true)
      bootTimerRef.current = setTimeout(() => {
        setBooting(false)
        bootTimerRef.current = null
      }, BOOT_DURATION)
    }

    setThemeState(newTheme)
  }, [])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (bootTimerRef.current) {
        clearTimeout(bootTimerRef.current)
      }
    }
  }, [])

  const value = { theme, setTheme, isLCARS, booting }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
