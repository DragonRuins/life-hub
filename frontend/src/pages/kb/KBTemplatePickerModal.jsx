/**
 * KBTemplatePickerModal - Modal for selecting a template when creating a new article.
 *
 * Shows a list of available templates. User can either select one to
 * pre-fill the new article, or skip to start with a blank article.
 * Works in both Catppuccin and LCARS themes (styling adapts via CSS context).
 */
import { useState, useEffect } from 'react'
import { X, FileText, Plus, Loader } from 'lucide-react'
import { kb } from '../../api/client'

export default function KBTemplatePickerModal({ onSelect, onBlank, onClose }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      const data = await kb.templates.list()
      setTemplates(data)
    } catch (err) {
      console.error('Failed to load templates:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(template) {
    try {
      setCreating(true)
      const article = await kb.templates.createFrom({
        template_id: template.id,
      })
      onSelect(article)
    } catch (err) {
      alert('Failed to create from template: ' + err.message)
    } finally {
      setCreating(false)
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
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 999,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(480px, calc(100vw - 2rem))',
        maxHeight: 'min(500px, calc(100dvh - 4rem))',
        background: 'var(--color-base, #1e1e2e)',
        border: '1px solid var(--color-surface-0, rgba(102, 102, 136, 0.3))',
        borderRadius: '12px',
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
          padding: '0.875rem 1rem',
          borderBottom: '1px solid var(--color-surface-0, rgba(102, 102, 136, 0.3))',
        }}>
          <h3 style={{
            margin: 0,
            fontSize: '0.95rem',
            fontWeight: 600,
          }}>
            New Article
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
        <div style={{ flex: 1, overflow: 'auto', padding: '0.75rem 1rem' }}>
          {/* Blank article option */}
          <button
            onClick={onBlank}
            disabled={creating}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem',
              background: 'var(--color-surface-0, rgba(102, 102, 136, 0.08))',
              border: '1px solid var(--color-surface-1, rgba(102, 102, 136, 0.2))',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'inherit',
              textAlign: 'left',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'rgba(137, 180, 250, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Plus size={18} style={{ color: 'var(--color-blue, var(--lcars-ice, #89b4fa))' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Blank Article</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0, var(--lcars-gray, #888))' }}>
                Start from scratch
              </div>
            </div>
          </button>

          {/* Templates section */}
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '1.5rem',
              color: 'var(--color-overlay-0, var(--lcars-gray, #888))',
              fontSize: '0.82rem',
            }}>
              <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : templates.length > 0 ? (
            <div>
              <div style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-overlay-0, var(--lcars-gray, #888))',
                marginBottom: '0.5rem',
              }}>
                From Template
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {templates.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => handleSelect(tpl)}
                    disabled={creating}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.625rem 0.75rem',
                      background: 'transparent',
                      border: '1px solid var(--color-surface-1, rgba(102, 102, 136, 0.15))',
                      borderRadius: '8px',
                      cursor: creating ? 'not-allowed' : 'pointer',
                      color: 'inherit',
                      textAlign: 'left',
                      opacity: creating ? 0.6 : 1,
                    }}
                  >
                    <FileText
                      size={16}
                      style={{
                        color: 'var(--color-green, var(--lcars-gold, #a6e3a1))',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {tpl.template_name || tpl.title}
                      </div>
                      {tpl.content_text && (
                        <div style={{
                          fontSize: '0.72rem',
                          color: 'var(--color-overlay-0, var(--lcars-gray, #888))',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {tpl.content_text.substring(0, 80)}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
