/**
 * useIsMobile - Responsive breakpoint hook.
 *
 * Returns true when the viewport width is <= 768px.
 * Uses window.matchMedia so the component only re-renders
 * when the breakpoint is actually crossed (no resize spam).
 */
import { useState, useEffect } from 'react'

const MOBILE_QUERY = '(max-width: 768px)'

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const handler = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isMobile
}
