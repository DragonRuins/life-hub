/**
 * FolderTree - Recursive folder tree component
 *
 * Renders folders with expand/collapse, inline rename,
 * right-click context menu, and sub-folder creation.
 */
import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreHorizontal, FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { folders as foldersApi } from '../../api/client'

export default function FolderTree({ folders, activeFolderId, onSelectFolder, onFoldersChanged, depth = 0 }) {
  if (!folders || folders.length === 0) return null

  return (
    <div>
      {folders.map((folder) => (
        <FolderItem
          key={folder.id}
          folder={folder}
          activeFolderId={activeFolderId}
          onSelectFolder={onSelectFolder}
          onFoldersChanged={onFoldersChanged}
          depth={depth}
        />
      ))}
    </div>
  )
}

function FolderItem({ folder, activeFolderId, onSelectFolder, onFoldersChanged, depth }) {
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameTo, setRenameTo] = useState(folder.name)
  const [addingChild, setAddingChild] = useState(false)
  const [childName, setChildName] = useState('')

  const isActive = String(activeFolderId) === String(folder.id)
  const hasChildren = folder.children && folder.children.length > 0
  const maxDepthReached = depth >= 2  // 0-indexed; depth 2 = level 3

  async function handleRename(e) {
    e.preventDefault()
    if (!renameTo.trim() || renameTo.trim() === folder.name) {
      setRenaming(false)
      return
    }
    try {
      await foldersApi.update(folder.id, { name: renameTo.trim() })
      setRenaming(false)
      onFoldersChanged()
    } catch (err) {
      console.error('Failed to rename folder:', err)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete folder "${folder.name}"? Notes will be moved to root.`)) return
    try {
      await foldersApi.delete(folder.id)
      onFoldersChanged()
      if (isActive) onSelectFolder(null)
    } catch (err) {
      console.error('Failed to delete folder:', err)
    }
  }

  async function handleAddChild(e) {
    e.preventDefault()
    if (!childName.trim()) return
    try {
      await foldersApi.create({ name: childName.trim(), parent_id: folder.id })
      setChildName('')
      setAddingChild(false)
      setExpanded(true)
      onFoldersChanged()
    } catch (err) {
      console.error('Failed to create sub-folder:', err)
    }
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          padding: '0.3rem 0.5rem',
          paddingLeft: `${depth * 1 + 0.5}rem`,
          borderRadius: '5px',
          cursor: 'pointer',
          background: isActive ? 'var(--color-surface-0)' : 'transparent',
          color: isActive ? 'var(--color-text)' : 'var(--color-subtext-0)',
          fontSize: '0.82rem',
          position: 'relative',
        }}
        onClick={() => onSelectFolder(folder.id)}
      >
        {/* Expand/collapse toggle */}
        <span
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '16px',
            flexShrink: 0,
            opacity: hasChildren ? 1 : 0,
          }}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>

        {/* Folder icon */}
        {expanded ? <FolderOpen size={14} /> : <Folder size={14} />}

        {/* Name or rename input */}
        {renaming ? (
          <form onSubmit={handleRename} style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => { if (e.key === 'Escape') setRenaming(false) }}
              style={{ fontSize: '0.8rem', padding: '0.15rem 0.3rem', width: '100%' }}
            />
          </form>
        ) : (
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {folder.name}
          </span>
        )}

        {/* Note count */}
        <span style={{ fontSize: '0.7rem', color: 'var(--color-overlay-0)', flexShrink: 0 }}>
          {folder.note_count || ''}
        </span>

        {/* Menu button */}
        <span
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '2px',
            opacity: isActive || menuOpen ? 1 : 0,
            color: 'var(--color-overlay-0)',
          }}
          className="folder-menu-trigger"
        >
          <MoreHorizontal size={13} />
        </span>

        {/* Context menu */}
        {menuOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 50 }}
              onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }}
            />
            <div
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '100%',
                background: 'var(--color-surface-0)',
                border: '1px solid var(--color-surface-1)',
                borderRadius: '6px',
                padding: '0.25rem',
                zIndex: 51,
                minWidth: '140px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {!maxDepthReached && (
                <MenuButton icon={FolderPlus} label="New sub-folder" onClick={() => {
                  setMenuOpen(false)
                  setAddingChild(true)
                  setExpanded(true)
                }} />
              )}
              <MenuButton icon={Pencil} label="Rename" onClick={() => {
                setMenuOpen(false)
                setRenaming(true)
                setRenameTo(folder.name)
              }} />
              <MenuButton icon={Trash2} label="Delete" onClick={() => {
                setMenuOpen(false)
                handleDelete()
              }} danger />
            </div>
          </>
        )}
      </div>

      {/* Sub-folder creation input */}
      {addingChild && (
        <form
          onSubmit={handleAddChild}
          style={{ paddingLeft: `${(depth + 1) * 1 + 0.5}rem`, paddingRight: '0.5rem', marginTop: '0.25rem' }}
        >
          <input
            autoFocus
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            onBlur={() => { if (!childName.trim()) setAddingChild(false) }}
            onKeyDown={(e) => { if (e.key === 'Escape') setAddingChild(false) }}
            placeholder="Sub-folder name"
            style={{ fontSize: '0.8rem', padding: '0.25rem 0.4rem', width: '100%' }}
          />
        </form>
      )}

      {/* Children */}
      {expanded && hasChildren && (
        <FolderTree
          folders={folder.children}
          activeFolderId={activeFolderId}
          onSelectFolder={onSelectFolder}
          onFoldersChanged={onFoldersChanged}
          depth={depth + 1}
        />
      )}
    </div>
  )
}


function MenuButton({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        padding: '0.35rem 0.5rem',
        borderRadius: '4px',
        border: 'none',
        background: 'transparent',
        color: danger ? 'var(--color-red)' : 'var(--color-text)',
        cursor: 'pointer',
        fontSize: '0.78rem',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-surface-1)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
