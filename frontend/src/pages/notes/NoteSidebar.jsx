/**
 * NoteSidebar - Left panel of the three-panel notes layout
 *
 * Contains:
 *   - Smart views (All Notes, Favorites, Recent, Trash)
 *   - Folder tree with create/rename/delete
 *   - Tag filter list
 */
import { useState } from 'react'
import { FileText, Star, Clock, Trash2, FolderPlus, Plus } from 'lucide-react'
import { folders as foldersApi, notes } from '../../api/client'
import FolderTree from './FolderTree'
import TagFilter from './TagFilter'

const TAG_COLORS = [
  '#89b4fa', '#a6e3a1', '#f9e2af', '#fab387',
  '#f38ba8', '#cba6f7', '#94e2d5', '#f5c2e7',
]

export default function NoteSidebar({
  folderTree,
  tagList,
  stats,
  activeView,
  activeFolderId,
  activeTag,
  onSelectView,
  onSelectFolder,
  onSelectTag,
  onFoldersChanged,
}) {
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])

  async function handleCreateFolder(e) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    try {
      await foldersApi.create({ name: newFolderName.trim() })
      setNewFolderName('')
      setShowNewFolder(false)
      onFoldersChanged()
    } catch (err) {
      console.error('Failed to create folder:', err)
    }
  }

  async function handleCreateTag(e) {
    e.preventDefault()
    if (!newTagName.trim()) return
    try {
      await notes.tags.create({ name: newTagName.trim(), color: newTagColor })
      setNewTagName('')
      setNewTagColor(TAG_COLORS[0])
      setShowNewTag(false)
      onFoldersChanged() // Reloads tags too
    } catch (err) {
      console.error('Failed to create tag:', err)
    }
  }

  const smartViews = [
    { key: null, label: 'All Notes', icon: FileText, count: stats.total },
    { key: 'starred', label: 'Favorites', icon: Star, count: stats.starred },
    { key: 'recent', label: 'Recent', icon: Clock, count: null },
    { key: 'trash', label: 'Trash', icon: Trash2, count: stats.trashed },
  ]

  return (
    <div style={{
      background: 'var(--color-mantle)',
      borderRight: '1px solid var(--color-surface-0)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100%',
    }}>
      {/* Smart Views */}
      <div style={{ padding: '0.75rem 0.5rem 0.5rem' }}>
        {smartViews.map(({ key, label, icon: Icon, count }) => (
          <button
            key={label}
            onClick={() => onSelectView(key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.4rem 0.625rem',
              borderRadius: '6px',
              border: 'none',
              background: (activeView === key && !activeFolderId && !activeTag)
                ? 'var(--color-surface-0)' : 'transparent',
              color: (activeView === key && !activeFolderId && !activeTag)
                ? 'var(--color-text)' : 'var(--color-subtext-0)',
              cursor: 'pointer',
              fontSize: '0.82rem',
              textAlign: 'left',
            }}
          >
            <Icon size={15} />
            <span style={{ flex: 1 }}>{label}</span>
            {count !== null && (
              <span style={{ fontSize: '0.72rem', color: 'var(--color-overlay-0)' }}>{count}</span>
            )}
          </button>
        ))}
      </div>

      <div style={{
        height: '1px',
        background: 'var(--color-surface-0)',
        margin: '0.25rem 0.75rem',
      }} />

      {/* Folders Section */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.25rem 0.625rem',
          marginBottom: '0.25rem',
        }}>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-overlay-0)',
          }}>
            Folders
          </span>
          <button
            onClick={() => setShowNewFolder(!showNewFolder)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-overlay-0)',
              padding: '2px',
              display: 'flex',
            }}
            title="New folder"
          >
            <FolderPlus size={14} />
          </button>
        </div>

        {/* New folder input */}
        {showNewFolder && (
          <form onSubmit={handleCreateFolder} style={{ padding: '0 0.375rem', marginBottom: '0.5rem' }}>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => { if (!newFolderName.trim()) setShowNewFolder(false) }}
              placeholder="Folder name"
              style={{
                fontSize: '0.8rem',
                padding: '0.3rem 0.5rem',
                width: '100%',
              }}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowNewFolder(false) }}
            />
          </form>
        )}

        {/* Folder tree */}
        <FolderTree
          folders={folderTree}
          activeFolderId={activeFolderId}
          onSelectFolder={onSelectFolder}
          onFoldersChanged={onFoldersChanged}
        />

        {/* Tags Section */}
        <div style={{
          height: '1px',
          background: 'var(--color-surface-0)',
          margin: '0.5rem 0.375rem',
        }} />

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.25rem 0.625rem',
          marginBottom: '0.25rem',
        }}>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-overlay-0)',
          }}>
            Tags
          </span>
          <button
            onClick={() => setShowNewTag(!showNewTag)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-overlay-0)',
              padding: '2px',
              display: 'flex',
            }}
            title="New tag"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* New tag form */}
        {showNewTag && (
          <form onSubmit={handleCreateTag} style={{ padding: '0 0.375rem', marginBottom: '0.5rem' }}>
            <input
              autoFocus
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              style={{
                fontSize: '0.8rem',
                padding: '0.3rem 0.5rem',
                width: '100%',
                marginBottom: '0.35rem',
              }}
              onKeyDown={(e) => { if (e.key === 'Escape') setShowNewTag(false) }}
            />
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.35rem' }}>
              {TAG_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewTagColor(color)}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: color,
                    border: newTagColor === color ? '2px solid var(--color-text)' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
            >
              Create Tag
            </button>
          </form>
        )}

        {tagList.length > 0 && (
          <TagFilter
            tags={tagList}
            activeTag={activeTag}
            onSelectTag={onSelectTag}
          />
        )}
      </div>
    </div>
  )
}
