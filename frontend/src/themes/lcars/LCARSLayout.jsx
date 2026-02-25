/**
 * LCARSLayout.jsx - LCARS Frame Grid Assembly
 *
 * Assembles the full LCARS frame: elbows, sidebar, header, footer,
 * data cascade, and content area. Children (or Routes) render in
 * the content area.
 *
 * This replaces AppShell when the LCARS theme is active.
 *
 * Classic grid (3-column):
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
 * Modern grid (5-column, 4-corner elbows):
 *   ┌──────────────┬───┬───────────────────┬───┬────────┐
 *   │  ELBOW (TL)  │        HEADER BAR         │ ELB TR │
 *   ├──────────────┤ C ├───────────────────┤ C ├────────┤
 *   │              │ A │                   │ A │ RIGHT  │
 *   │   SIDEBAR    │ S │     CONTENT       │ S │  BAR   │
 *   │              │ C │                   │ C │        │
 *   ├──────────────┤ D ├───────────────────┤ D ├────────┤
 *   │  ELBOW (BL)  │ E │     FOOTER BAR        │ ELB BR │
 *   └──────────────┴───┴───────────────────┴───┴────────┘
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

// Colors for the decorative right bar pills (uses CSS variables)
const RIGHT_BAR_BLOCKS = [
  { color: 'var(--lcars-ice)', height: 28 },
  { color: 'var(--lcars-african-violet)', height: 22 },
  { color: 'var(--lcars-butterscotch)', height: 32 },
  { color: 'var(--lcars-sky)', height: 18 },
  { color: 'var(--lcars-lilac)', height: 26 },
  { color: 'var(--lcars-sunflower)', height: 20 },
  { color: 'var(--lcars-almond-creme)', height: 24 },
  { color: 'var(--lcars-moonlit-violet)', height: 30 },
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
        <LCARSElbow
          color="var(--lcars-sunflower)"
          position="tl"
          radius={40}
          animated={isModernLCARS}
        />
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
          {/* Top-right elbow connecting header to right bar */}
          <div className="lcars-elbow-tr">
            <LCARSElbow
              color="var(--lcars-ice)"
              position="tr"
              radius={40}
              animated
            />
          </div>

          {/* Right-side data cascade strip */}
          <div className="lcars-cascade-r">
            <LCARSDataCascade />
          </div>

          {/* Decorative right bar — simple colored pills mirroring left sidebar */}
          <div className="lcars-right-sidebar">
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              padding: '4px 0',
              height: '100%',
              overflow: 'hidden',
            }}>
              {RIGHT_BAR_BLOCKS.map((block, i) => (
                <div
                  key={i}
                  style={{
                    background: block.color,
                    borderRadius: '16px 0 0 16px',
                    height: `${block.height}px`,
                    flexShrink: 0,
                    opacity: 0.7,
                  }}
                />
              ))}
              {/* Flexible spacer block fills remaining space */}
              <div style={{
                flex: 1,
                background: 'var(--lcars-sky)',
                borderRadius: '16px 0 0 16px',
                opacity: 0.3,
                minHeight: '20px',
              }} />
            </div>
          </div>

          {/* Bottom-right elbow connecting footer to right bar */}
          <div className="lcars-elbow-br">
            <LCARSElbow
              color="var(--lcars-butterscotch)"
              position="br"
              radius={24}
              animated
            />
          </div>
        </>
      )}

      {/* Bottom-left elbow connecting sidebar to footer */}
      <div className="lcars-elbow-bl">
        <LCARSElbow
          color="var(--lcars-african-violet)"
          position="bl"
          radius={24}
          animated={isModernLCARS}
        />
      </div>

      {/* Bottom: status bar on desktop, navigation on mobile */}
      <div className="lcars-footer">
        {isMobile ? <LCARSMobileNav /> : <LCARSFooter />}
      </div>
    </div>
  )
}
