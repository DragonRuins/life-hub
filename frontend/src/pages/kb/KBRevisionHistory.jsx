/**
 * KBRevisionHistory - Slide-out revision history panel.
 *
 * Shows a chronological list of article revisions with the ability
 * to preview content and restore to a previous version.
 * Used in both Catppuccin and LCARS themes (styling adapts via
 * parent CSS context).
 */
import { useState, useEffect } from 'react'
import { X, RotateCcw, Clock, ChevronRight } from 'lucide-react'
import { kb } from '../../api/client'

export default function KBRevisionHistory({ articleSlug, onClose, onRestore }) {
  const [revisions, setRevisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRevision, setSelectedRevision] = useState(null)
  const [previewContent, setPreviewContent] = useState(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    loadRevisions()
  }, [articleSlug])

  async function loadRevisions() {
    try {
      setLoading(true)
      const data = await kb.revisions.list(articleSlug)
      setRevisions(data)
    } catch (err) {
      console.error('Failed to load revisions:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectRevision(revision) {
    if (selectedRevision?.id === revision.id) {
      setSelectedRevision(null)
      setPreviewContent(null)
      return
    }
    try {
      const full = await kb.revisions.get(articleSlug, revision.id)
      setSelectedRevision(revision)
      setPreviewContent(full)
    } catch (err) {
      console.error('Failed to load revision:', err)
    }
  }

  async function handleRestore() {
    if (!selectedRevision) return
    if (!confirm(`Restore to revision #${selectedRevision.revision_number}? A snapshot of the current version will be saved first.`)) return

    try {
      setRestoring(true)
      const restored = await kb.revisions.restore(articleSlug, selectedRevision.id)
      onRestore(restored)
    } catch (err) {
      alert('Failed to restore: ' + err.message)
    } finally {
      setRestoring(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 999,
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(400px, 90vw)',
        background: 'var(--color-base, #1e1e2e)',
        borderLeft: '1px solid var(--color-surface-0, rgba(102, 102, 136, 0.3))',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-surface-0, rgba(102, 102, 136, 0.3))',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '0.95rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <Clock size={16} /> Revision History
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-subtext-0, var(--lcars-gray, #888))',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0.5rem' }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--color-overlay-0, var(--lcars-gray, #888))',
              fontSize: '0.85rem',
            }}>
              Loading revisions...
            </div>
          ) : revisions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--color-overlay-0, var(--lcars-gray, #888))',
              fontSize: '0.85rem',
            }}>
              No revisions yet. Revisions are created automatically when you edit article content.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {revisions.map((rev) => {
                const isSelected = selectedRevision?.id === rev.id
                const date = rev.created_at
                  ? new Date(rev.created_at).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''

                return (
                  <div key={rev.id}>
                    <button
                      onClick={() => handleSelectRevision(rev)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.625rem 0.75rem',
                        background: isSelected
                          ? 'var(--color-surface-0, rgba(102, 102, 136, 0.15))'
                          : 'transparent',
                        border: '1px solid',
                        borderColor: isSelected
                          ? 'var(--color-blue, var(--lcars-ice, #89b4fa))'
                          : 'transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: 'inherit',
                      }}
                    >
                      <ChevronRight
                        size={14}
                        style={{
                          color: 'var(--color-overlay-0, var(--lcars-gray, #888))',
                          transform: isSelected ? 'rotate(90deg)' : 'none',
                          transition: 'transform 0.15s',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.375rem',
                        }}>
                          <span style={{
                            color: 'var(--color-blue, var(--lcars-ice, #89b4fa))',
                            fontSize: '0.72rem',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>
                            #{rev.revision_number}
                          </span>
                          <span style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {rev.title}
                          </span>
                        </div>
                        <div style={{
                          fontSize: '0.72rem',
                          color: 'var(--color-overlay-0, var(--lcars-gray, #888))',
                          marginTop: '0.125rem',
                        }}>
                          {date}
                        </div>
                      </div>
                    </button>

                    {/* Preview when selected */}
                    {isSelected && previewContent && (
                      <div style={{
                        margin: '0.375rem 0 0.375rem 1.5rem',
                        padding: '0.75rem',
                        background: 'var(--color-mantle, rgba(0,0,0,0.3))',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        color: 'var(--color-subtext-0, var(--lcars-gray, #aaa))',
                        lineHeight: 1.5,
                        maxHeight: '200px',
                        overflow: 'auto',
                      }}>
                        <div style={{
                          fontWeight: 600,
                          marginBottom: '0.375rem',
                          color: 'var(--color-text, var(--lcars-space-white, #fff))',
                          fontSize: '0.82rem',
                        }}>
                          {previewContent.title}
                        </div>
                        <div>
                          {previewContent.content_text
                            ? previewContent.content_text.substring(0, 300) +
                              (previewContent.content_text.length > 300 ? '...' : '')
                            : 'No content'}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer - restore button */}
        {selectedRevision && (
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--color-surface-0, rgba(102, 102, 136, 0.3))',
          }}>
            <button
              onClick={handleRestore}
              disabled={restoring}
              className="btn btn-primary"
              style={{
                width: '100%',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
              }}
            >
              <RotateCcw size={14} />
              {restoring ? 'Restoring...' : `Restore Revision #${selectedRevision.revision_number}`}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
