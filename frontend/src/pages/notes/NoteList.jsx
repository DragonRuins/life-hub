/**
 * NoteList - Middle panel of the three-panel layout
 *
 * Shows a scrollable list of note previews for the
 * currently selected folder/view. Includes search bar,
 * sort controls, and new note button.
 */
import { useState } from 'react'
import { Search, Plus, Trash2, ArrowUpDown, Menu, RotateCcw } from 'lucide-react'

export default function NoteList({
  notes,
  loading,
  title,
  activeNoteId,
  isTrashView,
  searchQuery,
  onSearch,
  onSelectNote,
  onCreateNote,
  onDeleteNote,
  onRestoreNote,
  onEmptyTrash,
  onShowSidebar,
  isMobile,
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  function handleSearchSubmit(e) {
    e.preventDefault()
    onSearch(localSearch)
  }

  function handleSearchChange(e) {
    setLocalSearch(e.target.value)
    // Debounce-ish: update on empty to clear filter immediately
    if (!e.target.value) onSearch('')
  }

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSearch(localSearch)
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderRight: isMobile ? 'none' : '1px solid var(--color-surface-0)',
      overflow: 'hidden',
      height: '100%',
      background: 'var(--color-crust)',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem',
        borderBottom: '1px solid var(--color-surface-0)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isMobile && (
              <button
                onClick={onShowSidebar}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-subtext-0)',
                  padding: '4px',
                  display: 'flex',
                }}
              >
                <Menu size={18} />
              </button>
            )}
            <h2 style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
            }}>
              {title}
            </h2>
            <span style={{
              fontSize: '0.72rem',
              color: 'var(--color-overlay-0)',
            }}>
              {notes.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {isTrashView && notes.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('Permanently delete all trashed notes?')) {
                    onEmptyTrash()
                  }
                }}
                className="btn btn-danger"
                style={{ fontSize: '0.72rem', padding: '0.3rem 0.5rem' }}
              >
                <Trash2 size={12} />
                Empty
              </button>
            )}
            {!isTrashView && (
              <button
                onClick={onCreateNote}
                style={{
                  background: 'var(--color-blue)',
                  color: 'var(--color-crust)',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  padding: '0.3rem 0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                <Plus size={14} />
                New
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.6rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-overlay-0)',
            }}
          />
          <input
            type="text"
            placeholder="Search..."
            value={localSearch}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            style={{
              paddingLeft: '2rem',
              fontSize: '0.8rem',
              padding: '0.35rem 0.5rem 0.35rem 2rem',
              width: '100%',
            }}
          />
        </form>
      </div>

      {/* Note Items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
            Loading...
          </div>
        ) : notes.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
            {searchQuery ? 'No notes match your search.' : isTrashView ? 'Trash is empty.' : 'No notes here yet.'}
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              style={{
                padding: '0.625rem 0.75rem',
                borderBottom: '1px solid var(--color-surface-0)',
                cursor: 'pointer',
                background: String(note.id) === String(activeNoteId)
                  ? 'var(--color-surface-0)' : 'transparent',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                marginBottom: '0.2rem',
              }}>
                {note.is_starred && (
                  <span style={{ color: 'var(--color-yellow)', fontSize: '0.72rem' }}>&#9733;</span>
                )}
                <span style={{
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  color: 'var(--color-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {note.title || 'Untitled'}
                </span>
                {isTrashView && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRestoreNote(note.id) }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-green)',
                      padding: '2px',
                      display: 'flex',
                    }}
                    title="Restore"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>

              {/* Content preview */}
              <p style={{
                fontSize: '0.76rem',
                color: 'var(--color-subtext-0)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginBottom: '0.25rem',
              }}>
                {note.content_text || 'Empty note'}
              </p>

              {/* Footer: date + tags */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                flexWrap: 'wrap',
              }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--color-overlay-0)' }}>
                  {formatDate(note.updated_at)}
                </span>
                {note.tags?.slice(0, 3).map((tag) => (
                  <span
                    key={tag.id}
                    style={{
                      fontSize: '0.62rem',
                      padding: '0.05rem 0.35rem',
                      borderRadius: '3px',
                      background: tag.color ? `${tag.color}22` : 'var(--color-surface-1)',
                      color: tag.color || 'var(--color-overlay-1)',
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
