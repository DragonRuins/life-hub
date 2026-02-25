/**
 * LCARSLayout.jsx - LCARS Frame Grid Assembly
 *
 * Assembles the full LCARS frame: elbows, sidebar, header, footer,
 * data cascade, and content area. Children (or Routes) render in
 * the content area.
 *
 * This replaces AppShell when the LCARS theme is active.
 *
 * Classic grid (3 columns, 2 elbows):
 *   ┌──────────────┬───┬────────────────────────────┐
 *   │  ELBOW (TL)  │   │     HEADER BAR             │
 *   ├──────────────┤ C ├────────────────────────────┤
 *   │              │ A │                             │
 *   │   SIDEBAR    │ S │     CONTENT                 │
 *   │              │ C │                             │
 *   ├──────────────┤ D ├────────────────────────────┤
 *   │  ELBOW (BL)  │ E │     FOOTER / STATUS BAR    │
 *   └──────────────┴───┴────────────────────────────┘
 *
 * Modern grid (4 columns, 4 elbows):
 *   ┌──────────────┬───┬──────────────────────┬─────┐
 *   │  ELBOW (TL)  │   │     HEADER BAR       │ TR  │
 *   ├──────────────┤ C ├──────────────────────┤─────┤
 *   │              │ A │                      │RIGHT│
 *   │   SIDEBAR    │ S │     CONTENT          │STRIP│
 *   │              │ C │                      │     │
 *   ├──────────────┤ D ├──────────────────────┤─────┤
 *   │  ELBOW (BL)  │ E │     FOOTER BAR       │ BR  │
 *   └──────────────┴───┴──────────────────────┴─────┘
 */
import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import './LCARSLayout.css'
import LCARSElbow from './LCARSElbow'
import LCARSSidebar from './LCARSSidebar'
import LCARSHeader from './LCARSHeader'
import LCARSFooter from './LCARSFooter'
import LCARSDataCascade from './LCARSDataCascade'
import LCARSMobileNav from './LCARSMobileNav'
import useIsMobile from '../../hooks/useIsMobile'
import { useTheme } from './ThemeProvider'

/** Decorative right strip colors — cycles through LCARS palette */
const RIGHT_STRIP_COLORS = [
  'var(--lcars-ice)',
  'var(--lcars-african-violet)',
  'var(--lcars-sunflower)',
  'var(--lcars-butterscotch)',
  'var(--lcars-lilac)',
  'var(--lcars-sky)',
]

export default function LCARSLayout({ children, chat }) {
  const isMobile = useIsMobile()
  const { alertCondition, isModernLCARS } = useTheme()
  const location = useLocation()

  // ── Page Route Transition (Chunk 3) ──────────────────────
  // On pathname change, briefly fade content out then back in
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

  // Build root class based on alert condition and variant
  const alertClass = alertCondition === 'red'
    ? 'lcars-alert-red'
    : alertCondition === 'yellow'
      ? 'lcars-alert-yellow'
      : ''
  const modernClass = isModernLCARS ? 'lcars-modern-layout' : ''

  return (
    <div className={`lcars-layout ${alertClass} ${modernClass}`.trim()}>
      {/* Top-left elbow connecting sidebar to header */}
      <div className="lcars-elbow-tl">
        <LCARSElbow color="var(--lcars-sunflower)" position="tl" label="LCARS 47" />
      </div>

      {/* Top header bar */}
      <div className="lcars-header">
        <LCARSHeader chat={chat} />
      </div>

      {/* Left sidebar with pill navigation */}
      <div className="lcars-sidebar">
        <LCARSSidebar />
      </div>

      {/* Data cascade strip between sidebar and content */}
      <div className="lcars-cascade">
        <LCARSDataCascade />
      </div>

      {/* Main content area where Routes/pages render */}
      <div className={`lcars-content${pageOut ? ' lcars-page-out' : ''}`}>
        {children}
      </div>

      {/* ── Right-side elements (Modern variant only) ── */}
      {isModernLCARS && (
        <>
          {/* Top-right elbow */}
          <div className="lcars-elbow-tr">
            <LCARSElbow color="var(--lcars-ice)" position="tr" />
          </div>

          {/* Right decorative strip — colored pill segments
              NOTE: display is set in CSS, NOT inline, so the mobile
              media query's display:none !important can take effect. */}
          <div className="lcars-right-strip">
            {RIGHT_STRIP_COLORS.map((color, i) => (
              <div
                key={i}
                className="lcars-right-strip-pill"
                style={{
                  flex: i === 0 || i === RIGHT_STRIP_COLORS.length - 1 ? 2 : 1,
                  background: color,
                }}
              />
            ))}
          </div>

          {/* Bottom-right elbow */}
          <div className="lcars-elbow-br">
            <LCARSElbow color="var(--lcars-butterscotch)" position="br" />
          </div>
        </>
      )}

      {/* Bottom-left elbow connecting sidebar to footer */}
      <div className="lcars-elbow-bl">
        <LCARSElbow color="var(--lcars-african-violet)" position="bl" />
      </div>

      {/* Bottom: status bar on desktop, navigation on mobile */}
      <div className="lcars-footer">
        {isMobile ? <LCARSMobileNav /> : <LCARSFooter />}
      </div>
    </div>
  )
}
