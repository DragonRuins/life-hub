/**
 * Tooltip - A small "i" icon that shows helpful text on hover.
 */
import { Info } from 'lucide-react'

export default function Tooltip({ text }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: '0.375rem',
        cursor: 'help',
      }}
      title={text}
    >
      <Info size={14} style={{ color: 'var(--color-subtext-0)' }} />
    </span>
  )
}
