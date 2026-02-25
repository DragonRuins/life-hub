/**
 * LCARSDataCascade.jsx - Animated Data Streaming Strip
 *
 * A thin (5px) animated strip between the sidebar and content area.
 * Displays scrolling colored blocks that mimic the "data streaming"
 * effect seen on TNG panels.
 *
 * The inner container is twice the visible height so the animation
 * loops seamlessly by translating from -50% to 0.
 */
import { useMemo } from 'react'
import { useTheme } from './ThemeProvider'

// Classic LCARS colors for the cascade blocks
const CASCADE_COLORS_CLASSIC = [
  '#FFCC99', // sunflower
  '#CC99FF', // african-violet
  '#99CCFF', // ice
  '#FF9966', // butterscotch
  '#FF9900', // golden-orange
  '#FFBBAA', // almond-creme
  '#AAAAFF', // sky
  '#CC55FF', // lilac
  '#9966FF', // moonlit-violet
  '#FF8866', // peach
  '#CC5599', // magenta
  '#5566FF', // blue
  '#FFAA00', // gold
  '#999933', // green
]

// Vibrant dark colors for the cascade (modern variant)
const CASCADE_COLORS_MODERN = [
  '#1A7A8C', // saturated teal
  '#2E4A6E', // deep navy
  '#00B4D8', // bright cyan
  '#E86830', // bright orange
  '#D05828', // deep orange
  '#387080', // dark teal
  '#2A5E8A', // medium blue
  '#5E3E8A', // deep violet
  '#402E6A', // dark violet
  '#B84A38', // burnt sienna
  '#6A2E5A', // deep magenta
  '#1A3E6A', // dark navy
  '#8A7020', // dark gold
  '#1A8A50', // vibrant green
]

// Generate a pseudo-random 4-character hex string
const HEX_CHARS = '0123456789ABCDEF'
function randomHex(seed) {
  // Simple seeded pseudo-random to keep it stable across renders
  let s = seed
  return Array.from({ length: 4 }, () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return HEX_CHARS[s % 16]
  }).join('')
}

export default function LCARSDataCascade({ seedOffset = 0 }) {
  const { isModernLCARS } = useTheme()
  const CASCADE_COLORS = isModernLCARS ? CASCADE_COLORS_MODERN : CASCADE_COLORS_CLASSIC

  // Generate a fixed set of blocks on mount (memoized so they don't re-randomize)
  // Re-generate when variant changes so colors update
  // seedOffset shifts the pseudo-random sequence so multiple cascades look distinct
  const blocks = useMemo(() => {
    const result = []
    // Generate enough blocks to fill ~2x the viewport height
    for (let i = 0; i < 60; i++) {
      const j = i + seedOffset
      const height = 8 + ((j * 7) % 12) // pseudo-random heights between 8-19px
      // ~20% of blocks tall enough (>=12px) get a hex code overlay
      const hasText = height >= 12 && ((j * 13) % 5 === 0)
      result.push({
        color: CASCADE_COLORS[j % CASCADE_COLORS.length],
        height,
        gap: 2 + ((j * 3) % 4),     // pseudo-random gaps between 2-5px
        text: hasText ? randomHex(j * 997 + 42) : null,
      })
    }
    return result
  }, [CASCADE_COLORS, seedOffset])

  return (
    <div
      className="lcars-cascade-container"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        opacity: isModernLCARS ? 0.3 : 0.55,
        background: '#000000',
      }}
    >
      <div
        className="lcars-cascade-inner"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0px',
        }}
      >
        {/* Render blocks twice for seamless loop */}
        {[...blocks, ...blocks].map((block, i) => (
          <div key={i}>
            {/* Gap spacer */}
            <div style={{ height: `${block.gap}px`, background: '#000000' }} />
            {/* Colored block with optional hex code overlay */}
            <div
              style={{
                width: '100%',
                height: `${block.height}px`,
                background: block.color,
                borderRadius: '1px',
                overflow: 'hidden',
              }}
            >
              {block.text && (
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.5rem',
                  color: 'rgba(0, 0, 0, 0.45)',
                  letterSpacing: '0.05em',
                  paddingLeft: '1px',
                  lineHeight: `${block.height}px`,
                  whiteSpace: 'nowrap',
                }}>
                  {block.text}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
