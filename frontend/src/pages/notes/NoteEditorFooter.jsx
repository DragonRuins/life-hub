/**
 * NoteEditorFooter - Bottom bar of the note editor
 *
 * Shows save status indicator, word count, and last updated time.
 */
import { Check, Loader, AlertCircle } from 'lucide-react'

export default function NoteEditorFooter({ saveStatus, wordCount, updatedAt }) {
  const statusConfig = {
    saved: { label: 'Saved', icon: Check, color: 'var(--color-green)' },
    saving: { label: 'Saving...', icon: Loader, color: 'var(--color-yellow)' },
    unsaved: { label: 'Unsaved', icon: null, color: 'var(--color-yellow)' },
    error: { label: 'Save failed', icon: AlertCircle, color: 'var(--color-red)' },
  }

  const status = statusConfig[saveStatus] || statusConfig.saved
  const StatusIcon = status.icon

  function formatUpdatedAt(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.4rem 1.25rem',
      borderTop: '1px solid var(--color-surface-0)',
      fontSize: '0.7rem',
      color: 'var(--color-overlay-0)',
    }}>
      {/* Save status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {StatusIcon && (
          <StatusIcon
            size={11}
            style={{
              color: status.color,
              ...(saveStatus === 'saving' ? { animation: 'spin 1s linear infinite' } : {}),
            }}
          />
        )}
        {saveStatus === 'unsaved' && (
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: status.color,
          }} />
        )}
        <span style={{ color: status.color }}>{status.label}</span>
      </div>

      {/* Word count + last updated */}
      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <span>{wordCount} word{wordCount !== 1 ? 's' : ''}</span>
        {updatedAt && <span>{formatUpdatedAt(updatedAt)}</span>}
      </div>
    </div>
  )
}
