/**
 * ThemeProvider.jsx - Theme Context & Provider
 *
 * Manages three independent settings:
 *   1. Theme engine (catppuccin | lcars) — stored in 'datacore-theme'
 *   2. Color scheme (mocha, dracula, etc.) — stored in 'datacore-color-scheme'
 *   3. LCARS variant (classic | modern) — stored in 'datacore-lcars-variant'
 *
 * The color scheme only affects the Catppuccin/standard mode. It works by
 * setting a data-color-scheme attribute on <html> which activates CSS
 * variable overrides from color-schemes.css.
 *
 * The LCARS variant controls Classic (bright TNG) vs Modern (muted blue-gray)
 * palettes. When variant is 'modern', .lcars-modern is added to <html>,
 * layering overrides from lcars-modern-variables.css on top of .lcars-theme.
 *
 * Usage:
 *   import { useTheme } from './themes/lcars/ThemeProvider'
 *   const { theme, setTheme, isLCARS, booting, colorScheme, setColorScheme,
 *           lcarsVariant, setLcarsVariant, isModernLCARS } = useTheme()
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { dashboard } from '../../api/client'

// Import all LCARS CSS files so they're available when the theme is active
import './lcars-variables.css'
import './lcars-modern-variables.css'
import './lcars-library.css'      // Vendored joernweissenborn/lcars structural CSS
import './lcars-components.css'
import './lcars-animations.css'

const STORAGE_KEY = 'datacore-theme'
const COLOR_SCHEME_KEY = 'datacore-color-scheme'
const LCARS_VARIANT_KEY = 'datacore-lcars-variant'
const BOOT_DURATION = 1500 // ms for the boot sequence animation

// Schemes that use light mode (for browser controls, scrollbars, etc.)
const LIGHT_SCHEMES = ['latte', 'rose-pine-dawn', 'solarized-light']

// Base background colors per scheme (for theme-color meta tag)
const SCHEME_BASE_COLORS = {
  mocha: '#1e1e2e',
  macchiato: '#24273a',
  frappe: '#303446',
  latte: '#eff1f5',
  'rose-pine': '#232136',
  'rose-pine-dawn': '#fffaf3',
  dracula: '#282a36',
  'gruvbox-dark': '#32302f',
  'tokyo-night': '#1f2335',
  'solarized-dark': '#073642',
  'solarized-light': '#fdf6e3',
}

const ThemeContext = createContext(null)

/**
 * Hook to access theme state and controls.
 * Returns { theme, setTheme, isLCARS, booting, colorScheme, setColorScheme,
 *           lcarsVariant, setLcarsVariant, isModernLCARS, alertCondition }
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
 * On mount, reads the saved theme and color scheme from localStorage.
 * When theme changes, toggles .lcars-theme on <html> and saves to localStorage.
 * When color scheme changes, sets data-color-scheme on <html>.
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

  // Read initial color scheme from localStorage (default: mocha)
  const [colorScheme, setColorSchemeState] = useState(() => {
    try {
      return localStorage.getItem(COLOR_SCHEME_KEY) || 'mocha'
    } catch {
      return 'mocha'
    }
  })

  // LCARS variant: 'classic' (bright TNG) or 'modern' (muted blue-gray)
  const [lcarsVariant, setLcarsVariantState] = useState(() => {
    try {
      return localStorage.getItem(LCARS_VARIANT_KEY) || 'classic'
    } catch {
      return 'classic'
    }
  })

  // Boot sequence state — only true during the transition animation TO LCARS
  const [booting, setBooting] = useState(false)
  const bootTimerRef = useRef(null)
  const isInitialMount = useRef(true)

  const isLCARS = theme === 'lcars'
  const isModernLCARS = isLCARS && lcarsVariant === 'modern'

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

  // Apply or remove the .lcars-modern class on <html>
  useEffect(() => {
    const root = document.documentElement
    if (isModernLCARS) {
      root.classList.add('lcars-modern')
    } else {
      root.classList.remove('lcars-modern')
    }

    // Save variant to localStorage
    try {
      localStorage.setItem(LCARS_VARIANT_KEY, lcarsVariant)
    } catch {
      // Silently fail if localStorage isn't available
    }
  }, [lcarsVariant, isModernLCARS])

  // Apply color scheme attribute on <html>
  useEffect(() => {
    const root = document.documentElement

    // Mocha is the default — remove attribute so base @theme applies
    if (colorScheme === 'mocha') {
      root.removeAttribute('data-color-scheme')
    } else {
      root.setAttribute('data-color-scheme', colorScheme)
    }

    // Set color-scheme CSS property for light/dark browser controls
    // Only matters when not in LCARS mode (LCARS is always dark)
    if (!isLCARS) {
      root.style.colorScheme = LIGHT_SCHEMES.includes(colorScheme) ? 'light' : 'dark'
    } else {
      root.style.colorScheme = 'dark'
    }

    // Update theme-color meta tag (affects mobile browser chrome color)
    const baseColor = isLCARS ? '#000000' : (SCHEME_BASE_COLORS[colorScheme] || '#1e1e2e')
    let metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta')
      metaThemeColor.name = 'theme-color'
      document.head.appendChild(metaThemeColor)
    }
    metaThemeColor.content = baseColor

    // Save to localStorage
    try {
      localStorage.setItem(COLOR_SCHEME_KEY, colorScheme)
    } catch {
      // Silently fail if localStorage isn't available
    }
  }, [colorScheme, isLCARS])

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

  // Color scheme setter — just updates state, effect handles the rest
  const setColorScheme = useCallback((newScheme) => {
    setColorSchemeState(newScheme)
  }, [])

  // LCARS variant setter — toggles between 'classic' and 'modern'
  const setLcarsVariant = useCallback((newVariant) => {
    setLcarsVariantState(newVariant)
  }, [])

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (bootTimerRef.current) {
        clearTimeout(bootTimerRef.current)
      }
    }
  }, [])

  // ── Alert Condition (LCARS frame-level) ──────────────────────
  // Polls fleet status to determine maintenance alert state:
  //   'red'    = overdue maintenance items
  //   'yellow' = due soon / due now items
  //   'green'  = nominal (no animation)
  const [alertCondition, setAlertCondition] = useState('green')

  useEffect(() => {
    if (!isLCARS) return

    let cancelled = false

    async function fetchAlertCondition() {
      try {
        const data = await dashboard.getFleetStatus()
        if (cancelled) return
        const alerts = data?.interval_alerts || []
        if (alerts.some(a => a.status === 'overdue')) {
          setAlertCondition('red')
        } else if (alerts.some(a => a.status === 'due' || a.status === 'due_soon')) {
          setAlertCondition('yellow')
        } else {
          setAlertCondition('green')
        }
      } catch {
        // Silently fail — default to green
      }
    }

    fetchAlertCondition()
    const pollTimer = setInterval(fetchAlertCondition, 60000)
    return () => {
      cancelled = true
      clearInterval(pollTimer)
    }
  }, [isLCARS])

  const value = {
    theme, setTheme, isLCARS, booting,
    colorScheme, setColorScheme,
    lcarsVariant, setLcarsVariant, isModernLCARS,
    alertCondition,
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}
