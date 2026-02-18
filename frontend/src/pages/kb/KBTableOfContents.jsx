/**
 * KBTableOfContents - Floating sidebar Table of Contents.
 *
 * Auto-generates a TOC from headings (h1, h2, h3) in the article content.
 * Uses Intersection Observer to highlight the currently visible section.
 * Positioned on the right side of the reader. Hidden on mobile.
 *
 * Props:
 *   contentRef - ref to the article content container DOM element
 *   isLCARS - boolean to use LCARS styling
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { List } from 'lucide-react'

export default function KBTableOfContents({ contentRef, isLCARS = false }) {
  const [headings, setHeadings] = useState([])
  const [activeId, setActiveId] = useState(null)
  const observerRef = useRef(null)

  // Extract headings from the content DOM
  const extractHeadings = useCallback(() => {
    if (!contentRef?.current) return

    const elements = contentRef.current.querySelectorAll('h1, h2, h3')
    const items = []

    elements.forEach((el, index) => {
      // Assign an ID if one doesn't exist
      if (!el.id) {
        el.id = `heading-${index}`
      }
      items.push({
        id: el.id,
        text: el.textContent || '',
        level: parseInt(el.tagName.charAt(1)),
      })
    })

    setHeadings(items)
  }, [contentRef])

  // Set up Intersection Observer to track active heading
  useEffect(() => {
    extractHeadings()

    // Re-extract after a short delay to handle async TipTap rendering
    const timer = setTimeout(extractHeadings, 500)

    return () => clearTimeout(timer)
  }, [extractHeadings])

  useEffect(() => {
    if (headings.length === 0 || !contentRef?.current) return

    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first heading that is in the viewport
        const visibleEntries = entries.filter(e => e.isIntersecting)
        if (visibleEntries.length > 0) {
          setActiveId(visibleEntries[0].target.id)
        }
      },
      {
        rootMargin: '-64px 0px -70% 0px', // Top offset for header, bottom margin
        threshold: 0,
      }
    )

    // Observe all heading elements
    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    observerRef.current = observer

    return () => observer.disconnect()
  }, [headings, contentRef])

  function scrollToHeading(id) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(id)
    }
  }

  // Don't render if fewer than 2 headings
  if (headings.length < 2) return null

  // LCARS styling
  if (isLCARS) {
    return (
      <nav style={{
        position: 'sticky',
        top: '1rem',
        maxHeight: 'calc(100dvh - 120px)',
        overflow: 'auto',
        padding: '0.75rem',
        borderLeft: '3px solid var(--lcars-gold)',
        background: 'rgba(255, 170, 0, 0.03)',
      }}>
        <div style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--lcars-gold)',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
        }}>
          <List size={12} /> Section Index
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {headings.map((h) => (
            <button
              key={h.id}
              onClick={() => scrollToHeading(h.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.25rem 0.375rem',
                paddingLeft: `${(h.level - 1) * 0.625 + 0.375}rem`,
                fontFamily: h.level === 1 ? "'Antonio', sans-serif" : "'JetBrains Mono', monospace",
                fontSize: h.level === 1 ? '0.72rem' : '0.68rem',
                textTransform: h.level === 1 ? 'uppercase' : 'none',
                letterSpacing: h.level === 1 ? '0.04em' : '0',
                color: activeId === h.id ? 'var(--lcars-gold)' : 'var(--lcars-gray)',
                fontWeight: activeId === h.id ? 600 : 400,
                borderLeft: activeId === h.id ? '2px solid var(--lcars-gold)' : '2px solid transparent',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
            >
              {h.text}
            </button>
          ))}
        </div>
      </nav>
    )
  }

  // Catppuccin styling
  return (
    <nav style={{
      position: 'sticky',
      top: '1rem',
      maxHeight: 'calc(100dvh - 120px)',
      overflow: 'auto',
      padding: '0.75rem',
      borderLeft: '2px solid var(--color-surface-1)',
      borderRadius: '0 8px 8px 0',
    }}>
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: 'var(--color-overlay-0)',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
      }}>
        <List size={12} /> Contents
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
        {headings.map((h) => (
          <button
            key={h.id}
            onClick={() => scrollToHeading(h.id)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem 0.375rem',
              paddingLeft: `${(h.level - 1) * 0.75 + 0.375}rem`,
              fontSize: '0.78rem',
              color: activeId === h.id ? 'var(--color-blue)' : 'var(--color-subtext-0)',
              fontWeight: activeId === h.id ? 600 : 400,
              borderLeft: activeId === h.id ? '2px solid var(--color-blue)' : '2px solid transparent',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {h.text}
          </button>
        ))}
      </div>
    </nav>
  )
}
