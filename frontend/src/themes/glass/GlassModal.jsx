/**
 * GlassModal.jsx - Apple-Style Translucent Modal
 *
 * Dark translucent backdrop with blur, centered glass panel.
 * Heavy blur (40px), 20px border-radius, smooth scale+fade entrance.
 * Close button top-right, title in header.
 * Mobile-safe: maxWidth uses min() for viewport safety.
 */
import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function GlassModal({
  title,
  children,
  onClose,
  maxWidth = 500,
  footer,
}) {
  const backdropRef = useRef(null)

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && onClose) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close on backdrop click
  function handleBackdropClick(e) {
    if (e.target === backdropRef.current && onClose) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="glass-backdrop-animate"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="glass-modal-animate"
        style={{
          width: '100%',
          maxWidth: `min(${maxWidth}px, calc(100vw - 2rem))`,
          maxHeight: 'calc(100dvh - 4rem)',
          background: 'rgba(30, 30, 40, 0.85)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Inner glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.10), inset 0 0 30px -8px rgba(255, 255, 255, 0.05)',
            pointerEvents: 'none',
          }}
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <h2 style={{
            margin: 0,
            fontSize: '1rem',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.92)',
          }}>
            {title}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                border: 'none',
                background: 'rgba(255, 255, 255, 0.08)',
                color: 'rgba(255, 255, 255, 0.55)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.55)'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '0.5rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
