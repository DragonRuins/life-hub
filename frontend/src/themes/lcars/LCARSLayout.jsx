/**
 * LCARSLayout.jsx - LCARS Frame Grid Assembly
 *
 * Assembles the full LCARS frame: elbows, sidebar, header, footer,
 * data cascade, and content area. Children (or Routes) render in
 * the content area.
 *
 * This replaces AppShell when the LCARS theme is active.
 *
 * Grid structure:
 *   ┌──────────────┬───┬────────────────────────────┐
 *   │  ELBOW (TL)  │   │     HEADER BAR             │
 *   ├──────────────┤ C ├────────────────────────────┤
 *   │              │ A │                             │
 *   │   SIDEBAR    │ S │     CONTENT                 │
 *   │              │ C │                             │
 *   ├──────────────┤ D ├────────────────────────────┤
 *   │  ELBOW (BL)  │ E │     FOOTER / STATUS BAR    │
 *   └──────────────┴───┴────────────────────────────┘
 */
import './LCARSLayout.css'
import LCARSElbow from './LCARSElbow'
import LCARSSidebar from './LCARSSidebar'
import LCARSHeader from './LCARSHeader'
import LCARSFooter from './LCARSFooter'
import LCARSDataCascade from './LCARSDataCascade'
import LCARSMobileNav from './LCARSMobileNav'
import useIsMobile from '../../hooks/useIsMobile'

export default function LCARSLayout({ children }) {
  const isMobile = useIsMobile()

  return (
    <div className="lcars-layout">
      {/* Top-left elbow connecting sidebar to header */}
      <div className="lcars-elbow-tl">
        <LCARSElbow position="top-left" color="var(--lcars-sunflower)" />
      </div>

      {/* Top header bar */}
      <div className="lcars-header">
        <LCARSHeader />
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
      <div className="lcars-content">
        {children}
      </div>

      {/* Bottom-left elbow connecting sidebar to footer */}
      <div className="lcars-elbow-bl">
        <LCARSElbow position="bottom-left" color="var(--lcars-african-violet)" />
      </div>

      {/* Bottom: status bar on desktop, navigation on mobile */}
      <div className="lcars-footer">
        {isMobile ? <LCARSMobileNav /> : <LCARSFooter />}
      </div>
    </div>
  )
}
