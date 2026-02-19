/**
 * LCARSBootSequence.jsx - Boot-Up Animation Overlay
 *
 * A full-screen overlay that plays when switching TO the LCARS theme.
 * Shows a ~1.5 second "computer terminal powering on" sequence:
 *   1. Black screen
 *   2. LCARS frame elements draw in (lines, bars)
 *   3. Sidebar pills appear with stagger
 *   4. Content area brightens
 *   5. Overlay fades out
 *
 * Only triggers on explicit theme switch, NOT on page load with
 * LCARS already active. Respects prefers-reduced-motion.
 */
import { useState, useEffect } from 'react'

// LCARS colors for the boot animation elements
const BOOT_COLORS = [
  '#FFCC99', // sunflower
  '#CC99FF', // african-violet
  '#99CCFF', // ice
  '#FF9966', // butterscotch
]

export default function LCARSBootSequence({ onComplete }) {
  const [phase, setPhase] = useState(0)
  const [visible, setVisible] = useState(true)

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    // If user prefers reduced motion, skip the animation entirely
    if (prefersReducedMotion) {
      setVisible(false)
      onComplete?.()
      return
    }

    // Phase timeline:
    // 0ms: Black screen (phase 0)
    // 200ms: Frame lines start drawing (phase 1)
    // 500ms: Sidebar bars appear (phase 2)
    // 900ms: Content brightens (phase 3)
    // 1300ms: Begin fade out (phase 4)
    // 1500ms: Remove from DOM

    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 500),
      setTimeout(() => setPhase(3), 900),
      setTimeout(() => setPhase(4), 1300),
      setTimeout(() => {
        setVisible(false)
        onComplete?.()
      }, 1500),
    ]

    return () => timers.forEach(t => clearTimeout(t))
  }, [prefersReducedMotion, onComplete])

  if (!visible) return null

  return (
    <div
      className="lcars-boot-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#000000',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: phase >= 4 ? 0 : 1,
        transition: 'opacity 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Scanline effect */}
      {phase >= 1 && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '2px',
            background: 'linear-gradient(90deg, transparent, rgba(255, 204, 153, 0.4), transparent)',
            animation: 'lcars-scanline 0.8s linear',
            animationFillMode: 'forwards',
            zIndex: 2,
          }}
        />
      )}

      {/* Frame outline */}
      {phase >= 1 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            animation: 'lcars-boot-frame 0.6s ease-out forwards',
          }}
        >
          {/* Top bar */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: '200px',
              right: 0,
              height: '56px',
              display: 'flex',
              gap: '3px',
            }}
          >
            <div style={{ flex: 1, background: BOOT_COLORS[0], opacity: phase >= 2 ? 0.8 : 0.3, transition: 'opacity 0.3s' }} />
            <div style={{ width: '60px', background: BOOT_COLORS[1], opacity: phase >= 2 ? 0.8 : 0.3, transition: 'opacity 0.3s' }} />
            <div style={{ width: '40px', background: BOOT_COLORS[2], opacity: phase >= 2 ? 0.8 : 0.3, transition: 'opacity 0.3s' }} />
            <div style={{ width: '120px', background: BOOT_COLORS[0], borderRadius: '0 30px 30px 0', opacity: phase >= 2 ? 0.8 : 0.3, transition: 'opacity 0.3s' }} />
          </div>

          {/* Left elbow (top) */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '200px',
              height: '56px',
              background: BOOT_COLORS[0],
              opacity: phase >= 2 ? 0.8 : 0.3,
              transition: 'opacity 0.3s',
            }}
          >
            <div style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '50%',
              height: '50%',
              background: '#000',
              borderRadius: '0 0 0 40px',
            }} />
          </div>

          {/* Sidebar pills */}
          <div
            style={{
              position: 'absolute',
              top: '60px',
              left: 0,
              width: '200px',
              bottom: '40px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '4px 0',
            }}
          >
            {BOOT_COLORS.map((color, i) => (
              <div
                key={i}
                style={{
                  height: '40px',
                  background: color,
                  borderRadius: '30px 0 0 30px',
                  opacity: phase >= 2 ? 0.8 : 0,
                  transform: phase >= 2 ? 'translateX(0)' : 'translateX(-30px)',
                  transition: `opacity 0.3s ease ${i * 100}ms, transform 0.3s ease ${i * 100}ms`,
                }}
              />
            ))}
          </div>

          {/* Bottom bar */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: '200px',
              right: 0,
              height: '36px',
              display: 'flex',
              gap: '3px',
            }}
          >
            <div style={{ flex: 1, background: BOOT_COLORS[1], opacity: phase >= 2 ? 0.8 : 0.3, transition: 'opacity 0.3s' }} />
            <div style={{ width: '120px', background: BOOT_COLORS[2], opacity: phase >= 2 ? 0.8 : 0.3, transition: 'opacity 0.3s' }} />
            <div style={{ width: '80px', background: BOOT_COLORS[1], borderRadius: '0 30px 30px 0', opacity: phase >= 2 ? 0.8 : 0.3, transition: 'opacity 0.3s' }} />
          </div>

          {/* Left elbow (bottom) */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '200px',
              height: '36px',
              background: BOOT_COLORS[1],
              opacity: phase >= 2 ? 0.8 : 0.3,
              transition: 'opacity 0.3s',
            }}
          >
            <div style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '50%',
              height: '50%',
              background: '#000',
              borderRadius: '40px 0 0 0',
            }} />
          </div>
        </div>
      )}

      {/* Center text (appears briefly) */}
      {phase >= 2 && phase < 4 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            opacity: phase >= 3 ? 0 : 0.7,
            transition: 'opacity 0.3s',
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontFamily: "'Antonio', 'Helvetica Neue', sans-serif",
              fontSize: '1.5rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.3em',
              color: BOOT_COLORS[0],
            }}
          >
            Initializing
          </div>
          <div
            style={{
              fontFamily: "'Antonio', 'Helvetica Neue', sans-serif",
              fontSize: '0.72rem',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: BOOT_COLORS[2],
            }}
          >
            Library Computer Access/Retrieval System
          </div>
        </div>
      )}
    </div>
  )
}
