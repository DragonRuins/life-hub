/**
 * LCARSNotes.jsx - LCARS-themed Notes Page
 *
 * Three-panel layout matching the Catppuccin Notes page but fully styled
 * with LCARS visual language: panels, pill buttons, Antonio font, LCARS colors.
 *
 * Shares the TipTap editor (content styles overridden via lcars-notes.css),
 * but all surrounding chrome is LCARS-native.
 *
 * Layout:
 *   Left:   Smart views + folder tree + tag filter
 *   Middle: Note list with search
 *   Right:  Editor (title, toolbar, TipTap, footer)
 *
 * Mobile: Stacked panels with back navigation
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  StickyNote, Star, Clock, Trash2, FolderOpen, Plus, Search,
  ChevronRight, ChevronDown, MoreHorizontal, ArrowLeft, Tag,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote,
  Table, ImagePlus, Paperclip, Link as LinkIcon, Minus,
  AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2, X,
} from 'lucide-react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Table as TipTapTable } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { common, createLowlight } from 'lowlight'

import { notes, folders, attachments } from '../../api/client'
import { formatDate } from '../../utils/formatDate'
import useIsMobile from '../../hooks/useIsMobile'
import LCARSPanel from './LCARSPanel'
import LCARSModal from './LCARSModal'
import AttachmentPicker from '../../pages/notes/AttachmentPicker'
import '../../pages/notes/tiptap.css'
import './lcars-notes.css'

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export default function LCARSNotes() {
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()

  // Data state
  const [noteList, setNoteList] = useState([])
  const [folderTree, setFolderTree] = useState([])
  const [tagList, setTagList] = useState([])
  const [stats, setStats] = useState({ total: 0, starred: 0, trashed: 0 })
  const [activeNote, setActiveNote] = useState(null)
  const [loading, setLoading] = useState(true)

  // URL-driven state
  const activeView = searchParams.get('view') || null
  const activeFolderId = searchParams.get('folder') || null
  const activeNoteId = searchParams.get('note') || null
  const activeTag = searchParams.get('tag') || null
  const searchQuery = searchParams.get('search') || ''

  // Mobile panel state
  const [mobilePanel, setMobilePanel] = useState('list')

  // ── Data Loading ────────────────────────────────────────────

  const loadFolders = useCallback(async () => {
    try {
      const [folderData, tagData, statsData] = await Promise.all([
        folders.list(),
        notes.tags.list(),
        notes.stats(),
      ])
      setFolderTree(folderData)
      setTagList(tagData)
      setStats(statsData)
    } catch (err) {
      console.error('Failed to load folders/tags:', err)
    }
  }, [])

  const loadNotes = useCallback(async () => {
    try {
      const params = {}
      if (activeView === 'starred') params.starred = 'true'
      else if (activeView === 'trash') params.trashed = 'true'
      if (activeFolderId) params.folder_id = activeFolderId
      if (activeTag) params.tag = activeTag
      if (searchQuery) params.search = searchQuery
      const data = await notes.list(params)
      setNoteList(data)
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }, [activeView, activeFolderId, activeTag, searchQuery])

  useEffect(() => { loadFolders() }, [loadFolders])
  useEffect(() => { loadNotes() }, [loadNotes])

  useEffect(() => {
    if (!activeNoteId) { setActiveNote(null); return }
    notes.get(activeNoteId)
      .then(setActiveNote)
      .catch(() => setActiveNote(null))
  }, [activeNoteId])

  // ── URL State Helpers ───────────────────────────────────────

  function setView(view) {
    const next = new URLSearchParams()
    if (view) next.set('view', view)
    setSearchParams(next)
    if (isMobile) setMobilePanel('list')
  }

  function setFolder(folderId) {
    const next = new URLSearchParams()
    if (folderId) next.set('folder', folderId)
    setSearchParams(next)
    if (isMobile) setMobilePanel('list')
  }

  function setTag(tagName) {
    const next = new URLSearchParams()
    if (tagName) next.set('tag', tagName)
    setSearchParams(next)
    if (isMobile) setMobilePanel('list')
  }

  function selectNote(noteId) {
    const next = new URLSearchParams(searchParams)
    if (noteId) next.set('note', noteId)
    else next.delete('note')
    setSearchParams(next)
    if (isMobile) setMobilePanel('editor')
  }

  function setSearch(query) {
    const next = new URLSearchParams(searchParams)
    if (query) next.set('search', query)
    else next.delete('search')
    setSearchParams(next)
  }

  // ── Keyboard Shortcuts ─────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        handleCreateNote()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeFolderId])

  // ── Actions ─────────────────────────────────────────────────

  async function handleCreateNote() {
    try {
      const newNote = await notes.create({
        title: 'Untitled',
        folder_id: activeFolderId ? parseInt(activeFolderId) : null,
      })
      await loadNotes()
      await loadFolders()
      selectNote(newNote.id)
    } catch (err) {
      console.error('Failed to create note:', err)
    }
  }

  async function handleUpdateNote(noteId, data) {
    try {
      const updated = await notes.update(noteId, data)
      setActiveNote(updated)
      await loadNotes()
      if ('is_starred' in data) await loadFolders()
    } catch (err) {
      console.error('Failed to update note:', err)
    }
  }

  async function handleDeleteNote(noteId) {
    if (activeView === 'trash') {
      if (!window.confirm('Permanently delete this note? This cannot be undone.')) return
    }
    try {
      if (activeView === 'trash') {
        await notes.permanentDelete(noteId)
      } else {
        await notes.delete(noteId)
      }
      if (activeNoteId === String(noteId)) selectNote(null)
      await loadNotes()
      await loadFolders()
    } catch (err) {
      console.error('Failed to delete note:', err)
    }
  }

  async function handleRestoreNote(noteId) {
    try {
      await notes.restore(noteId)
      await loadNotes()
      await loadFolders()
    } catch (err) {
      console.error('Failed to restore note:', err)
    }
  }

  async function handleEmptyTrash() {
    if (!window.confirm('Permanently delete all trashed notes? This cannot be undone.')) return
    try {
      await notes.emptyTrash()
      await loadNotes()
      await loadFolders()
      selectNote(null)
    } catch (err) {
      console.error('Failed to empty trash:', err)
    }
  }

  async function handleMoveNote(noteId, folderId) {
    try {
      await notes.move(noteId, folderId)
      await loadNotes()
      await loadFolders()
    } catch (err) {
      console.error('Failed to move note:', err)
    }
  }

  // ── List Title ──────────────────────────────────────────────

  let listTitle = 'All Notes'
  if (activeView === 'starred') listTitle = 'Favorites'
  else if (activeView === 'recent') listTitle = 'Recent'
  else if (activeView === 'trash') listTitle = 'Trash'
  else if (activeTag) listTitle = `Tag: ${activeTag}`
  else if (activeFolderId) {
    const findFolder = (list, id) => {
      for (const f of list) {
        if (String(f.id) === String(id)) return f
        const child = findFolder(f.children || [], id)
        if (child) return child
      }
      return null
    }
    const folder = findFolder(folderTree, activeFolderId)
    if (folder) listTitle = folder.name
  }

  const isTrashView = activeView === 'trash'

  // ── Mobile ──────────────────────────────────────────────────

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 112px)' }}>
        {mobilePanel === 'sidebar' && (
          <LCARSSidebarPanel
            folderTree={folderTree}
            tagList={tagList}
            stats={stats}
            activeView={activeView}
            activeFolderId={activeFolderId}
            activeTag={activeTag}
            onSelectView={setView}
            onSelectFolder={setFolder}
            onSelectTag={setTag}
            onFoldersChanged={loadFolders}
          />
        )}
        {mobilePanel === 'list' && (
          <LCARSNoteListPanel
            notes={noteList}
            loading={loading}
            title={listTitle}
            activeNoteId={activeNoteId}
            isTrashView={isTrashView}
            searchQuery={searchQuery}
            onSearch={setSearch}
            onSelectNote={selectNote}
            onCreateNote={handleCreateNote}
            onRestoreNote={handleRestoreNote}
            onEmptyTrash={handleEmptyTrash}
            onShowSidebar={() => setMobilePanel('sidebar')}
            isMobile
          />
        )}
        {mobilePanel === 'editor' && activeNote && (
          <LCARSEditorPanel
            note={activeNote}
            folderTree={folderTree}
            tagList={tagList}
            isTrashView={isTrashView}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
            onRestore={handleRestoreNote}
            onMove={handleMoveNote}
            onBack={() => setMobilePanel('list')}
            isMobile
          />
        )}
      </div>
    )
  }

  // ── Desktop: Three-Panel Grid ───────────────────────────────

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '230px 280px 1fr',
      height: 'calc(100dvh - 92px)',
      gap: '3px',
    }}>
      <LCARSSidebarPanel
        folderTree={folderTree}
        tagList={tagList}
        stats={stats}
        activeView={activeView}
        activeFolderId={activeFolderId}
        activeTag={activeTag}
        onSelectView={setView}
        onSelectFolder={setFolder}
        onSelectTag={setTag}
        onFoldersChanged={loadFolders}
      />

      <LCARSNoteListPanel
        notes={noteList}
        loading={loading}
        title={listTitle}
        activeNoteId={activeNoteId}
        isTrashView={isTrashView}
        searchQuery={searchQuery}
        onSearch={setSearch}
        onSelectNote={selectNote}
        onCreateNote={handleCreateNote}
        onRestoreNote={handleRestoreNote}
        onEmptyTrash={handleEmptyTrash}
      />

      {activeNote ? (
        <LCARSEditorPanel
          note={activeNote}
          folderTree={folderTree}
          tagList={tagList}
          isTrashView={isTrashView}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
          onRestore={handleRestoreNote}
          onMove={handleMoveNote}
        />
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000000',
          border: '1px solid rgba(102, 102, 136, 0.3)',
          color: 'var(--lcars-gray)',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Select a note or create a new one
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Left Panel: Smart Views + Folder Tree + Tags
// ═══════════════════════════════════════════════════════════════════════════

function LCARSSidebarPanel({
  folderTree, tagList, stats,
  activeView, activeFolderId, activeTag,
  onSelectView, onSelectFolder, onSelectTag, onFoldersChanged,
}) {
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#99CCFF')

  const LCARS_TAG_COLORS = [
    '#99CCFF', '#CC99FF', '#FFCC99', '#FF9966',
    '#999933', '#FF5555', '#AAAAFF', '#CC5599',
  ]

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    try {
      await notes.tags.create({ name: newTagName.trim(), color: newTagColor })
      setNewTagName('')
      setNewTagColor('#99CCFF')
      setShowNewTag(false)
      onFoldersChanged()
    } catch (err) {
      console.error('Failed to create tag:', err)
    }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    try {
      await folders.create({ name: newFolderName.trim() })
      setNewFolderName('')
      setShowNewFolder(false)
      onFoldersChanged()
    } catch (err) {
      console.error('Failed to create folder:', err)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#000000',
      border: '1px solid rgba(102, 102, 136, 0.3)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.5rem 0.75rem',
        background: 'var(--lcars-african-violet)',
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.85rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--lcars-text-on-color)',
      }}>
        Notes Database
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        {/* Smart Views */}
        <div style={{ marginBottom: '0.75rem' }}>
          <SmartViewButton
            label="All Notes"
            icon={StickyNote}
            count={stats.total}
            active={!activeView && !activeFolderId && !activeTag}
            onClick={() => onSelectView(null)}
          />
          <SmartViewButton
            label="Favorites"
            icon={Star}
            count={stats.starred}
            active={activeView === 'starred'}
            onClick={() => onSelectView('starred')}
            color="var(--lcars-sunflower)"
          />
          <SmartViewButton
            label="Recent"
            icon={Clock}
            active={activeView === 'recent'}
            onClick={() => onSelectView('recent')}
            color="var(--lcars-ice)"
          />
          <SmartViewButton
            label="Trash"
            icon={Trash2}
            count={stats.trashed}
            active={activeView === 'trash'}
            onClick={() => onSelectView('trash')}
            color="var(--lcars-tomato)"
          />
        </div>

        {/* Divider */}
        <div style={{ height: '2px', background: 'var(--lcars-gray)', margin: '0.5rem 0', opacity: 0.3 }} />

        {/* Folders */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.25rem 0.5rem',
            marginBottom: '0.25rem',
          }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--lcars-sunflower)',
            }}>
              Folders
            </span>
            <button
              onClick={() => setShowNewFolder(!showNewFolder)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--lcars-sunflower)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          {showNewFolder && (
            <div style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem 0.5rem', marginBottom: '0.25rem' }}>
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') }
                }}
                placeholder="Folder name..."
                style={{
                  flex: 1,
                  padding: '0.25rem 0.4rem',
                  fontSize: '0.75rem',
                  background: '#000000',
                  border: '1px solid var(--lcars-gray)',
                  color: 'var(--lcars-space-white)',
                  borderRadius: '2px',
                }}
              />
              <button
                className="lcars-element button rounded auto"
                onClick={handleCreateFolder}
                style={{
                  background: 'var(--lcars-african-violet)',
                  border: 'none',
                  height: 'auto',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.65rem',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Add
              </button>
            </div>
          )}

          {folderTree.map(folder => (
            <LCARSFolderItem
              key={folder.id}
              folder={folder}
              depth={0}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              onFoldersChanged={onFoldersChanged}
            />
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: '2px', background: 'var(--lcars-gray)', margin: '0.5rem 0', opacity: 0.3 }} />

        {/* Tags */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.25rem 0.5rem',
            marginBottom: '0.25rem',
          }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--lcars-sunflower)',
            }}>
              Tags
            </span>
            <button
              onClick={() => setShowNewTag(!showNewTag)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--lcars-sunflower)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          {showNewTag && (
            <div style={{ padding: '0.25rem 0.5rem', marginBottom: '0.35rem' }}>
              <input
                autoFocus
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTag()
                  if (e.key === 'Escape') { setShowNewTag(false); setNewTagName('') }
                }}
                placeholder="Tag name..."
                style={{
                  width: '100%',
                  padding: '0.25rem 0.4rem',
                  fontSize: '0.75rem',
                  background: '#000000',
                  border: '1px solid var(--lcars-gray)',
                  color: 'var(--lcars-space-white)',
                  borderRadius: '2px',
                  marginBottom: '0.3rem',
                }}
              />
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                {LCARS_TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: color,
                      border: newTagColor === color ? '2px solid var(--lcars-space-white)' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
              <button
                className="lcars-element button rounded auto"
                onClick={handleCreateTag}
                style={{
                  background: 'var(--lcars-african-violet)',
                  border: 'none',
                  height: 'auto',
                  padding: '0.2rem 0.5rem',
                  fontSize: '0.65rem',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                Create
              </button>
            </div>
          )}

          {tagList.length === 0 && !showNewTag ? (
            <div style={{ padding: '0.25rem 0.5rem', color: 'var(--lcars-gray)', fontSize: '0.75rem' }}>
              No tags yet
            </div>
          ) : tagList.map(tag => (
            <button
              key={tag.id}
              onClick={() => onSelectTag(activeTag === tag.name ? null : tag.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                width: '100%',
                padding: '0.3rem 0.5rem',
                background: activeTag === tag.name ? 'rgba(204, 153, 255, 0.12)' : 'transparent',
                border: 'none',
                color: activeTag === tag.name ? 'var(--lcars-african-violet)' : 'var(--lcars-space-white)',
                fontSize: '0.78rem',
                fontFamily: "'JetBrains Mono', monospace",
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: tag.color || 'var(--lcars-african-violet)',
                flexShrink: 0,
              }} />
              {tag.name}
              {tag.note_count > 0 && (
                <span style={{ marginLeft: 'auto', color: 'var(--lcars-gray)', fontSize: '0.7rem' }}>
                  {tag.note_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}


function SmartViewButton({ label, icon: Icon, count, active, onClick, color = 'var(--lcars-african-violet)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        width: '100%',
        padding: '0.4rem 0.5rem',
        background: active ? `${color}22` : 'transparent',
        border: active ? `1px solid ${color}44` : '1px solid transparent',
        borderRadius: '2px',
        color: active ? color : 'var(--lcars-space-white)',
        cursor: 'pointer',
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.8rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        textAlign: 'left',
      }}
    >
      <Icon size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {count !== undefined && (
        <span style={{
          fontSize: '0.7rem',
          fontFamily: "'JetBrains Mono', monospace",
          color: 'var(--lcars-gray)',
        }}>
          {count}
        </span>
      )}
    </button>
  )
}


function LCARSFolderItem({ folder, depth, activeFolderId, onSelectFolder, onFoldersChanged }) {
  const [expanded, setExpanded] = useState(false)
  const isActive = String(folder.id) === String(activeFolderId)
  const hasChildren = folder.children && folder.children.length > 0

  return (
    <div>
      <button
        onClick={() => onSelectFolder(folder.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          width: '100%',
          padding: `0.3rem 0.5rem 0.3rem ${0.5 + depth * 0.75}rem`,
          background: isActive ? 'rgba(204, 153, 255, 0.12)' : 'transparent',
          border: 'none',
          color: isActive ? 'var(--lcars-african-violet)' : 'var(--lcars-space-white)',
          fontSize: '0.78rem',
          fontFamily: "'JetBrains Mono', monospace",
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            style={{ cursor: 'pointer', display: 'flex', flexShrink: 0 }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} />
        )}
        <FolderOpen size={13} style={{ flexShrink: 0, color: 'var(--lcars-sunflower)' }} />
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {folder.name}
        </span>
        {folder.note_count > 0 && (
          <span style={{ fontSize: '0.65rem', color: 'var(--lcars-gray)' }}>{folder.note_count}</span>
        )}
      </button>
      {expanded && hasChildren && folder.children.map(child => (
        <LCARSFolderItem
          key={child.id}
          folder={child}
          depth={depth + 1}
          activeFolderId={activeFolderId}
          onSelectFolder={onSelectFolder}
          onFoldersChanged={onFoldersChanged}
        />
      ))}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Middle Panel: Note List
// ═══════════════════════════════════════════════════════════════════════════

function LCARSNoteListPanel({
  notes: noteList, loading, title, activeNoteId, isTrashView,
  searchQuery, onSearch, onSelectNote, onCreateNote,
  onRestoreNote, onEmptyTrash, onShowSidebar, isMobile,
}) {
  function formatRelativeTime(dateStr) {
    if (!dateStr) return ''
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return formatDate(dateStr)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#000000',
      border: '1px solid rgba(102, 102, 136, 0.3)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.5rem 0.75rem',
        background: 'var(--lcars-ice)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isMobile && onShowSidebar && (
            <button
              onClick={onShowSidebar}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--lcars-text-on-color)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--lcars-text-on-color)',
          }}>
            {title}
          </span>
        </div>
        {!isTrashView && (
          <button
            className="lcars-element button rounded auto"
            onClick={onCreateNote}
            style={{
              background: '#000000',
              border: 'none',
              height: 'auto',
              padding: '0.2rem 0.6rem',
              color: 'var(--lcars-ice)',
              fontSize: '0.7rem',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.3rem',
            }}
          >
            <Plus size={12} /> New
          </button>
        )}
      </div>

      {/* Search */}
      <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid rgba(102, 102, 136, 0.2)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{
            position: 'absolute',
            left: '0.5rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--lcars-gray)',
          }} />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.35rem 0.5rem 0.35rem 1.75rem',
              fontSize: '0.75rem',
              background: 'rgba(102, 102, 136, 0.1)',
              border: '1px solid rgba(102, 102, 136, 0.3)',
              borderRadius: '2px',
              color: 'var(--lcars-space-white)',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Trash actions */}
      {isTrashView && noteList.length > 0 && (
        <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid rgba(102, 102, 136, 0.2)' }}>
          <button
            className="lcars-element button rounded auto"
            onClick={onEmptyTrash}
            style={{
              background: 'var(--lcars-tomato)',
              border: 'none',
              height: 'auto',
              padding: '0.25rem 0.6rem',
              fontSize: '0.7rem',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Empty Trash
          </button>
        </div>
      )}

      {/* Note list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--lcars-gray)', fontSize: '0.8rem' }}>
            Loading...
          </div>
        ) : noteList.length === 0 ? (
          <div style={{
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--lcars-gray)',
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            No notes found
          </div>
        ) : noteList.map((note) => {
          const isActive = String(note.id) === String(activeNoteId)
          return (
            <button
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.5rem 0.75rem',
                background: isActive ? 'rgba(153, 204, 255, 0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--lcars-ice)' : '3px solid transparent',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: '1px solid rgba(102, 102, 136, 0.12)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* Title row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {note.is_starred && (
                  <Star size={11} fill="var(--lcars-sunflower)" style={{ color: 'var(--lcars-sunflower)', flexShrink: 0 }} />
                )}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: isActive ? 'var(--lcars-ice)' : 'var(--lcars-space-white)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {note.title || 'Untitled'}
                </span>
                <span style={{
                  fontSize: '0.65rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  color: 'var(--lcars-gray)',
                  flexShrink: 0,
                }}>
                  {formatRelativeTime(note.updated_at)}
                </span>
              </div>

              {/* Content preview */}
              {note.content_text && (
                <div style={{
                  fontSize: '0.72rem',
                  color: 'var(--lcars-gray)',
                  marginTop: '0.15rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {note.content_text.slice(0, 80)}
                </div>
              )}

              {/* Tags */}
              {note.tags && note.tags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {note.tags.slice(0, 3).map(tag => (
                    <span key={tag.id} style={{
                      fontSize: '0.6rem',
                      padding: '0.05rem 0.35rem',
                      background: 'rgba(204, 153, 255, 0.15)',
                      color: tag.color || 'var(--lcars-african-violet)',
                      fontFamily: "'Antonio', sans-serif",
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Restore button for trash */}
              {isTrashView && (
                <button
                  className="lcars-element button rounded auto"
                  onClick={(e) => { e.stopPropagation(); onRestoreNote(note.id) }}
                  style={{
                    marginTop: '0.3rem',
                    background: 'var(--lcars-green)',
                    border: 'none',
                    height: 'auto',
                    padding: '0.15rem 0.5rem',
                    fontSize: '0.65rem',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  Restore
                </button>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Right Panel: LCARS Editor
// ═══════════════════════════════════════════════════════════════════════════

function LCARSEditorPanel({
  note, folderTree, tagList, isTrashView,
  onUpdate, onDelete, onRestore, onMove, onBack, isMobile,
}) {
  const [title, setTitle] = useState(note?.title || '')
  const [saveStatus, setSaveStatus] = useState('saved')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState('image')
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const saveTimerRef = useRef(null)
  const noteIdRef = useRef(note?.id)
  const latestContentRef = useRef(note?.content_json)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: 'Begin recording...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
      TipTapTable.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight,
    ],
    content: note?.content_json || '',
    editable: !isTrashView,
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      latestContentRef.current = json
      debouncedSave({ content_json: json })
    },
  })

  useEffect(() => {
    setTitle(note?.title || '')
    setSaveStatus('saved')
    noteIdRef.current = note?.id
    latestContentRef.current = note?.content_json

    if (editor) {
      const currentJSON = JSON.stringify(editor.getJSON())
      const newJSON = JSON.stringify(note?.content_json || '')
      if (currentJSON !== newJSON) {
        editor.commands.setContent(note?.content_json || '')
      }
      editor.setEditable(!isTrashView)
    }

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [note?.id, isTrashView])

  const debouncedSave = useCallback((updates) => {
    setSaveStatus('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving')
      try {
        await onUpdate(noteIdRef.current, updates)
        setSaveStatus('saved')
      } catch (err) {
        setSaveStatus('error')
        console.error('Auto-save failed:', err)
      }
    }, 1500)
  }, [onUpdate])

  // Force immediate save (Cmd+S / Ctrl+S)
  const forceSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!editor) return
    setSaveStatus('saving')
    try {
      await onUpdate(noteIdRef.current, {
        title,
        content_json: editor.getJSON(),
      })
      setSaveStatus('saved')
    } catch (err) {
      setSaveStatus('error')
      console.error('Save failed:', err)
    }
  }, [editor, title, onUpdate])

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        forceSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [forceSave])

  function handleTitleChange(e) {
    const newTitle = e.target.value
    setTitle(newTitle)
    debouncedSave({ title: newTitle })
  }

  async function handleStarToggle() {
    await onUpdate(note.id, { is_starred: !note.is_starred })
  }

  async function handleTagToggle(tagId) {
    const currentTagIds = note.tags.map(t => t.id)
    const newTagIds = currentTagIds.includes(tagId)
      ? currentTagIds.filter(id => id !== tagId)
      : [...currentTagIds, tagId]
    await onUpdate(note.id, { tag_ids: newTagIds })
  }

  function handleAttachmentSelect(attachment) {
    if (!editor) return
    const fileUrl = attachments.fileUrl(attachment.id)
    if (attachment.mime_type?.startsWith('image/')) {
      editor.chain().focus().setImage({ src: fileUrl, alt: attachment.filename }).run()
    } else {
      editor.chain().focus()
        .insertContent({
          type: 'text',
          text: attachment.filename,
          marks: [{ type: 'link', attrs: { href: fileUrl } }],
        })
        .run()
    }
  }

  function handleSetLink() {
    if (!editor) return
    if (linkUrl.trim()) {
      let url = linkUrl.trim()
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) url = 'https://' + url
      editor.chain().focus().setLink({ href: url }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  const wordCount = editor
    ? editor.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length
    : 0

  // Save status display
  const statusMap = {
    saved: { text: 'SAVED', color: 'var(--lcars-green)' },
    saving: { text: 'SAVING', color: 'var(--lcars-sunflower)' },
    unsaved: { text: 'UNSAVED', color: 'var(--lcars-sunflower)' },
    error: { text: 'ERROR', color: 'var(--lcars-tomato)' },
  }
  const status = statusMap[saveStatus]

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: '#000000',
      border: '1px solid rgba(102, 102, 136, 0.3)',
      overflow: 'hidden',
    }}>
      {/* Editor Header */}
      <div style={{
        padding: '0.4rem 0.75rem',
        background: 'var(--lcars-sunflower)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
          {isMobile && onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--lcars-text-on-color)',
                cursor: 'pointer',
                padding: '2px',
                display: 'flex',
              }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--lcars-text-on-color)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            Editor
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
          {/* Star */}
          <LCARSSmallButton
            onClick={handleStarToggle}
            active={note.is_starred}
            color="var(--lcars-sunflower)"
          >
            <Star size={12} fill={note.is_starred ? '#000000' : 'none'} />
          </LCARSSmallButton>
          {/* Delete / Restore */}
          {isTrashView ? (
            <LCARSSmallButton onClick={() => onRestore(note.id)} color="var(--lcars-green)">
              Restore
            </LCARSSmallButton>
          ) : (
            <LCARSSmallButton onClick={() => onDelete(note.id)} color="var(--lcars-tomato)">
              <Trash2 size={12} />
            </LCARSSmallButton>
          )}
        </div>
      </div>

      {/* Tag bar */}
      <div style={{
        padding: '0.3rem 0.75rem',
        borderBottom: '1px solid rgba(102, 102, 136, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.3rem',
        flexWrap: 'wrap',
      }}>
        <Tag size={11} style={{ color: 'var(--lcars-gray)', flexShrink: 0 }} />
        {note.tags?.map(tag => (
          <span key={tag.id} style={{
            fontSize: '0.62rem',
            padding: '0.05rem 0.35rem',
            background: 'rgba(204, 153, 255, 0.15)',
            color: tag.color || 'var(--lcars-african-violet)',
            fontFamily: "'Antonio', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            cursor: 'pointer',
          }}
            onClick={() => handleTagToggle(tag.id)}
          >
            {tag.name}
          </span>
        ))}
        {/* Inline tag picker */}
        {tagList?.filter(t => !note.tags?.find(nt => nt.id === t.id)).length > 0 && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) handleTagToggle(parseInt(e.target.value)) }}
            style={{
              fontSize: '0.62rem',
              padding: '0.05rem 0.2rem',
              background: '#000000',
              border: '1px solid var(--lcars-gray)',
              color: 'var(--lcars-gray)',
              borderRadius: '2px',
            }}
          >
            <option value="">+ Tag</option>
            {tagList?.filter(t => !note.tags?.find(nt => nt.id === t.id)).map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Formatting Toolbar */}
      {!isTrashView && editor && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1px',
          padding: '0.3rem 0.5rem',
          borderBottom: '2px solid var(--lcars-sunflower)',
          flexWrap: 'wrap',
          background: 'rgba(102, 102, 136, 0.08)',
        }}>
          <LTB icon={Undo2} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo" />
          <LTB icon={Redo2} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo" />
          <LTBSep />
          <LTB icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold" />
          <LTB icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic" />
          <LTB icon={UnderlineIcon} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline" />
          <LTB icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike" />
          <LTB icon={Code} onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code" />
          <LTB icon={Highlighter} onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight" />
          <LTBSep />
          <LTB icon={Heading1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1" />
          <LTB icon={Heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2" />
          <LTB icon={Heading3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="H3" />
          <LTBSep />
          <LTB icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullets" />
          <LTB icon={ListOrdered} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbers" />
          <LTB icon={ListChecks} onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Tasks" />
          <LTB icon={Quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote" />
          <LTBSep />
          <LTB icon={AlignLeft} onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Left" />
          <LTB icon={AlignCenter} onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Center" />
          <LTB icon={AlignRight} onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Right" />
          <LTBSep />
          <LTB
            icon={() => <span style={{ fontSize: '0.6rem', fontFamily: 'monospace', fontWeight: 700 }}>{'{}'}</span>}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="Code Block"
          />
          <LTB icon={Table} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Table" />
          <LTB icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Rule" />
          <LTB icon={ImagePlus} onClick={() => { setPickerMode('image'); setPickerOpen(true) }} title="Image" />
          <LTB icon={Paperclip} onClick={() => { setPickerMode('file'); setPickerOpen(true) }} title="Attach" />
          <div style={{ position: 'relative' }}>
            <LTB
              icon={LinkIcon}
              onClick={() => {
                if (editor.isActive('link')) {
                  editor.chain().focus().unsetLink().run()
                } else {
                  setLinkUrl(editor.getAttributes('link').href || '')
                  setShowLinkInput(!showLinkInput)
                }
              }}
              active={editor.isActive('link')}
              title="Link"
            />
            {showLinkInput && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setShowLinkInput(false)} />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  zIndex: 51,
                  background: '#000000',
                  border: '1px solid var(--lcars-sunflower)',
                  padding: '0.4rem',
                  display: 'flex',
                  gap: '0.3rem',
                }}>
                  <input
                    autoFocus
                    type="text"
                    placeholder="https://..."
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleSetLink() }
                      if (e.key === 'Escape') setShowLinkInput(false)
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.4rem',
                      width: '180px',
                      background: '#000000',
                      border: '1px solid var(--lcars-gray)',
                      color: 'var(--lcars-space-white)',
                    }}
                  />
                  <button
                    className="lcars-element button rounded auto"
                    onClick={handleSetLink}
                    style={{
                      background: 'var(--lcars-sunflower)',
                      border: 'none',
                      height: 'auto',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.65rem',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    Set
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Title input */}
      <div style={{ padding: '0.75rem 1rem 0' }}>
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          disabled={isTrashView}
          style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            border: 'none',
            background: 'transparent',
            color: 'var(--lcars-space-white)',
            width: '100%',
            padding: 0,
            outline: 'none',
            fontFamily: "'Antonio', sans-serif",
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        />
      </div>

      {/* Editor content */}
      <div className="lcars-editor-content" style={{ flex: 1, padding: '0.75rem 1rem', overflowY: 'auto' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.35rem 0.75rem',
        borderTop: '2px solid var(--lcars-sunflower)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: status.color,
          }} />
          <span style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: status.color,
          }}>
            {status.text}
          </span>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.7rem',
          color: 'var(--lcars-gray)',
        }}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </span>
      </div>

      {/* Attachment picker */}
      <AttachmentPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleAttachmentSelect}
        noteId={note?.id}
        mode={pickerMode}
      />
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════
// Small Helper Components
// ═══════════════════════════════════════════════════════════════════════════

/** LCARS toolbar button */
function LTB({ icon: Icon, onClick, active, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '26px',
        height: '26px',
        border: 'none',
        background: active ? 'var(--lcars-sunflower)' : 'transparent',
        color: disabled
          ? 'rgba(102, 102, 136, 0.3)'
          : active
            ? 'var(--lcars-text-on-color)'
            : 'var(--lcars-space-white)',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        transition: 'all 0.1s ease',
      }}
    >
      {typeof Icon === 'function' && Icon.length === 0
        ? <Icon />
        : <Icon size={14} />
      }
    </button>
  )
}

/** LCARS toolbar separator */
function LTBSep() {
  return (
    <div style={{
      width: '1px',
      height: '16px',
      background: 'rgba(102, 102, 136, 0.3)',
      margin: '0 0.15rem',
    }} />
  )
}

/** Small pill button for header actions */
function LCARSSmallButton({ onClick, children, color, active }) {
  return (
    <button
      className="lcars-element button rounded auto"
      onClick={onClick}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.2rem',
        background: active ? color : '#000000',
        border: 'none',
        height: 'auto',
        padding: '0.15rem 0.4rem',
        color: active ? 'var(--lcars-text-on-color)' : color,
        fontSize: '0.65rem',
      }}
    >
      {children}
    </button>
  )
}
