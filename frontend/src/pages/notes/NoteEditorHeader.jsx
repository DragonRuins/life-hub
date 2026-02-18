/**
 * NoteEditorHeader - Top bar of the note editor panel
 *
 * Shows star toggle, tag pills, folder location,
 * and action buttons (delete, restore).
 */
import { useState } from 'react'
import { ArrowLeft, Star, Trash2, RotateCcw, Tag, FolderOpen, ChevronDown } from 'lucide-react'

export default function NoteEditorHeader({
  note,
  tagList,
  folderTree,
  isTrashView,
  onStarToggle,
  onTagToggle,
  onDelete,
  onRestore,
  onMove,
  onBack,
  isMobile,
}) {
  const [showTagMenu, setShowTagMenu] = useState(false)
  const [showFolderMenu, setShowFolderMenu] = useState(false)

  const noteTagIds = note.tags.map(t => t.id)

  // Find current folder name
  const findFolderName = (folders, id) => {
    for (const f of folders) {
      if (f.id === id) return f.name
      const child = findFolderName(f.children || [], id)
      if (child) return child
    }
    return null
  }
  const folderName = note.folder_id ? findFolderName(folderTree, note.folder_id) : null

  // Flatten folder tree for the move menu
  const flattenFolders = (folders, depth = 0) => {
    let result = []
    for (const f of folders) {
      result.push({ ...f, depth })
      if (f.children?.length) {
        result = result.concat(flattenFolders(f.children, depth + 1))
      }
    }
    return result
  }
  const flatFolders = flattenFolders(folderTree)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.5rem 0.75rem',
      borderBottom: '1px solid var(--color-surface-0)',
      flexWrap: 'wrap',
      minHeight: '42px',
    }}>
      {/* Back button (mobile) */}
      {isMobile && onBack && (
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--color-subtext-0)',
            padding: '4px',
            display: 'flex',
          }}
        >
          <ArrowLeft size={18} />
        </button>
      )}

      {/* Star toggle */}
      {!isTrashView && (
        <button
          onClick={onStarToggle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: note.is_starred ? 'var(--color-yellow)' : 'var(--color-overlay-0)',
            padding: '4px',
            display: 'flex',
          }}
          title={note.is_starred ? 'Unstar' : 'Star'}
        >
          <Star size={16} fill={note.is_starred ? 'currentColor' : 'none'} />
        </button>
      )}

      {/* Folder indicator / selector */}
      {!isTrashView && (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowFolderMenu(!showFolderMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'none',
              border: '1px solid var(--color-surface-1)',
              borderRadius: '4px',
              cursor: 'pointer',
              color: 'var(--color-subtext-0)',
              padding: '0.2rem 0.4rem',
              fontSize: '0.72rem',
            }}
          >
            <FolderOpen size={12} />
            {folderName || 'No folder'}
            <ChevronDown size={10} />
          </button>

          {showFolderMenu && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                onClick={() => setShowFolderMenu(false)}
              />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                background: 'var(--color-surface-0)',
                border: '1px solid var(--color-surface-1)',
                borderRadius: '6px',
                padding: '0.25rem',
                zIndex: 51,
                minWidth: '160px',
                maxHeight: '200px',
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>
                {/* Root (no folder) option */}
                <DropdownItem
                  label="No folder"
                  active={!note.folder_id}
                  onClick={() => { onMove(note.id, null); setShowFolderMenu(false) }}
                />
                {flatFolders.map((f) => (
                  <DropdownItem
                    key={f.id}
                    label={f.name}
                    indent={f.depth}
                    active={note.folder_id === f.id}
                    onClick={() => { onMove(note.id, f.id); setShowFolderMenu(false) }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tag pills */}
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
        {note.tags.map((tag) => (
          <span
            key={tag.id}
            style={{
              fontSize: '0.68rem',
              padding: '0.1rem 0.4rem',
              borderRadius: '3px',
              background: tag.color ? `${tag.color}22` : 'var(--color-surface-1)',
              color: tag.color || 'var(--color-overlay-1)',
            }}
          >
            {tag.name}
          </span>
        ))}

        {/* Add tag button */}
        {!isTrashView && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTagMenu(!showTagMenu)}
              style={{
                background: 'none',
                border: '1px dashed var(--color-surface-1)',
                borderRadius: '3px',
                cursor: 'pointer',
                color: 'var(--color-overlay-0)',
                padding: '0.1rem 0.3rem',
                fontSize: '0.68rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}
            >
              <Tag size={10} />
            </button>

            {showTagMenu && (
              <>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 50 }}
                  onClick={() => setShowTagMenu(false)}
                />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  background: 'var(--color-surface-0)',
                  border: '1px solid var(--color-surface-1)',
                  borderRadius: '6px',
                  padding: '0.25rem',
                  zIndex: 51,
                  minWidth: '140px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}>
                  {tagList.length === 0 ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.76rem', color: 'var(--color-subtext-0)' }}>
                      No tags yet
                    </div>
                  ) : (
                    tagList.map((tag) => (
                      <DropdownItem
                        key={tag.id}
                        label={tag.name}
                        active={noteTagIds.includes(tag.id)}
                        color={tag.color}
                        onClick={() => onTagToggle(tag.id)}
                        keepOpen
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
        {isTrashView ? (
          <>
            <button
              onClick={onRestore}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-green)',
                padding: '4px',
                display: 'flex',
              }}
              title="Restore"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={() => {
                if (window.confirm('Permanently delete this note?')) onDelete()
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-red)',
                padding: '4px',
                display: 'flex',
              }}
              title="Delete permanently"
            >
              <Trash2 size={15} />
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              if (window.confirm('Move this note to trash?')) onDelete()
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-overlay-0)',
              padding: '4px',
              display: 'flex',
            }}
            title="Move to trash"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}


function DropdownItem({ label, active, indent = 0, color, onClick, keepOpen }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        width: '100%',
        padding: '0.3rem 0.5rem',
        paddingLeft: `${indent * 0.75 + 0.5}rem`,
        borderRadius: '4px',
        border: 'none',
        background: active ? 'var(--color-surface-1)' : 'transparent',
        color: 'var(--color-text)',
        cursor: 'pointer',
        fontSize: '0.76rem',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--color-surface-1)' }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {color && (
        <span style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }} />
      )}
      <span style={{ flex: 1 }}>{label}</span>
      {active && <span style={{ fontSize: '0.7rem', color: 'var(--color-blue)' }}>&#10003;</span>}
    </button>
  )
}
