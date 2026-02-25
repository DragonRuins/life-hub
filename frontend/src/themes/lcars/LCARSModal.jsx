/**
 * LCARSModal.jsx - LCARS-Styled Modal with Elbow Accents
 *
 * A modal wrapper component with LCARS visual treatment:
 *   - Dark overlay (black, 0.75 opacity)
 *   - Black panel with colored border
 *   - Small decorative elbow accents at corners
 *   - Colored title bar
 *   - Pill-shaped close button
 *
 * Props:
 *   isOpen    - boolean controlling visibility
 *   onClose   - callback when modal should close
 *   title     - modal title text
 *   children  - modal content
 *   color     - accent color (default: sunflower)
 */
import { useEffect, useRef } from 'react'

export default function LCARSModal({
  isOpen,
  onClose,
  title,
  children,
  color = 'var(--lcars-sunflower)',
}) {
  const modalRef = useRef(null)

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Close when clicking outside the modal panel
  function handleOverlayClick(e) {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose?.()
    }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        ref={modalRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 'min(520px, calc(100vw - 2rem))',
          maxHeight: 'calc(100dvh - 2rem)',
          margin: '1rem',
          background: '#000000',
          border: `2px solid ${color}`,
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Corner elbow accents */}
        <CornerAccent position="top-left" color={color} />
        <CornerAccent position="top-right" color={color} />
        <CornerAccent position="bottom-left" color={color} />
        <CornerAccent position="bottom-right" color={color} />

        {/* Title bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.625rem 1rem 0.625rem 1.5rem',
            background: color,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '1rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--lcars-text-on-color)',
            }}
          >
            {title}
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'var(--lcars-red)',
              border: 'none',
              borderRadius: '999px',
              padding: '0.25rem 0.75rem',
              color: 'var(--lcars-text-on-color)',
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              transition: 'filter 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.3)'}
            onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
          >
            Close
          </button>
        </div>

        {/* Content area */}
        <div style={{ padding: '1.5rem', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}


/**
 * Small decorative elbow accent for modal corners.
 * A tiny L-shaped element that suggests the LCARS elbow motif.
 */
function CornerAccent({ position, color }) {
  const size = 16
  const styles = {
    position: 'absolute',
    width: `${size}px`,
    height: `${size}px`,
    zIndex: 1,
  }

  // Position at the correct corner
  if (position.includes('top')) styles.top = -1
  if (position.includes('bottom')) styles.bottom = -1
  if (position.includes('left')) styles.left = -1
  if (position.includes('right')) styles.right = -1

  // Border on the two sides facing inward
  const borderWidth = '2px'
  const borderStyle = `${borderWidth} solid ${color}`

  if (position === 'top-left') {
    styles.borderBottom = borderStyle
    styles.borderRight = borderStyle
    styles.borderRadius = '0 0 6px 0'
  } else if (position === 'top-right') {
    styles.borderBottom = borderStyle
    styles.borderLeft = borderStyle
    styles.borderRadius = '0 0 0 6px'
  } else if (position === 'bottom-left') {
    styles.borderTop = borderStyle
    styles.borderRight = borderStyle
    styles.borderRadius = '0 6px 0 0'
  } else if (position === 'bottom-right') {
    styles.borderTop = borderStyle
    styles.borderLeft = borderStyle
    styles.borderRadius = '6px 0 0 0'
  }

  return <div style={styles} />
}
