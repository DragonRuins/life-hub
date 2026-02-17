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

// LCARS colors for the cascade blocks
const CASCADE_COLORS = [
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

export default function LCARSDataCascade() {
  // Generate a fixed set of blocks on mount (memoized so they don't re-randomize)
  const blocks = useMemo(() => {
    const result = []
    // Generate enough blocks to fill ~2x the viewport height
    for (let i = 0; i < 60; i++) {
      result.push({
        color: CASCADE_COLORS[i % CASCADE_COLORS.length],
        height: 8 + ((i * 7) % 12), // pseudo-random heights between 8-19px
        gap: 2 + ((i * 3) % 4),     // pseudo-random gaps between 2-5px
      })
    }
    return result
  }, [])

  return (
    <div
      className="lcars-cascade-container"
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        opacity: 0.55,
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
            {/* Colored block */}
            <div
              style={{
                width: '100%',
                height: `${block.height}px`,
                background: block.color,
                borderRadius: '1px',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
