/**
 * Notes Page - Three-Panel Layout
 *
 * Obsidian-style three-panel notes interface:
 *   Left:   Folder tree + smart views + tag filter
 *   Middle: Note list for selected folder/view
 *   Right:  Note editor (plain textarea for now, TipTap in Phase 3)
 *
 * On mobile (<=768px), panels stack with back navigation:
 *   Sidebar -> Note List -> Editor
 */
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { notes, folders } from '../../api/client'
import useIsMobile from '../../hooks/useIsMobile'
import NoteSidebar from './NoteSidebar'
import NoteList from './NoteList'
import NoteEditor from './NoteEditor'

export default function Notes() {
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()

  // Data state
  const [noteList, setNoteList] = useState([])
  const [folderTree, setFolderTree] = useState([])
  const [tagList, setTagList] = useState([])
  const [stats, setStats] = useState({ total: 0, starred: 0, trashed: 0 })
  const [activeNote, setActiveNote] = useState(null)
  const [loading, setLoading] = useState(true)

  // UI state derived from URL params
  const activeView = searchParams.get('view') || null        // 'starred', 'recent', 'trash'
  const activeFolderId = searchParams.get('folder') || null  // folder ID
  const activeNoteId = searchParams.get('note') || null      // note ID
  const activeTag = searchParams.get('tag') || null          // tag name
  const searchQuery = searchParams.get('search') || ''

  // Mobile panel state: 'sidebar' | 'list' | 'editor'
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
      else if (activeView === 'recent') { /* default sort by updated_at desc */ }

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

  // Load folders/tags once on mount
  useEffect(() => { loadFolders() }, [loadFolders])

  // Reload notes when filters change
  useEffect(() => { loadNotes() }, [loadNotes])

  // Load the active note's full content when selected
  useEffect(() => {
    if (!activeNoteId) {
      setActiveNote(null)
      return
    }
    notes.get(activeNoteId)
      .then(setActiveNote)
      .catch((err) => {
        console.error('Failed to load note:', err)
        setActiveNote(null)
      })
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
      // Refresh the list to show updated title/metadata
      await loadNotes()
      // Refresh stats if starred status changed
      if ('is_starred' in data) await loadFolders()
    } catch (err) {
      console.error('Failed to update note:', err)
    }
  }

  async function handleDeleteNote(noteId) {
    // Confirm permanent deletes (from trash view)
    if (activeView === 'trash') {
      if (!window.confirm('Permanently delete this note? This cannot be undone.')) return
    }
    try {
      if (activeView === 'trash') {
        await notes.permanentDelete(noteId)
      } else {
        await notes.delete(noteId)
      }
      if (activeNoteId === String(noteId)) {
        selectNote(null)
      }
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

  // ── Render ──────────────────────────────────────────────────

  // Determine what title to show in the list header
  let listTitle = 'All Notes'
  if (activeView === 'starred') listTitle = 'Favorites'
  else if (activeView === 'recent') listTitle = 'Recent'
  else if (activeView === 'trash') listTitle = 'Trash'
  else if (activeTag) listTitle = `Tag: ${activeTag}`
  else if (activeFolderId) {
    const findFolder = (folders, id) => {
      for (const f of folders) {
        if (String(f.id) === String(id)) return f
        const child = findFolder(f.children || [], id)
        if (child) return child
      }
      return null
    }
    const folder = findFolder(folderTree, activeFolderId)
    if (folder) listTitle = folder.name
  }

  // Mobile: show one panel at a time
  if (isMobile) {
    return (
      <div style={{ height: 'calc(100dvh - 112px)', display: 'flex', flexDirection: 'column' }}>
        {mobilePanel === 'sidebar' && (
          <NoteSidebar
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
          <NoteList
            notes={noteList}
            loading={loading}
            title={listTitle}
            activeNoteId={activeNoteId}
            isTrashView={activeView === 'trash'}
            searchQuery={searchQuery}
            onSearch={setSearch}
            onSelectNote={selectNote}
            onCreateNote={handleCreateNote}
            onDeleteNote={handleDeleteNote}
            onRestoreNote={handleRestoreNote}
            onEmptyTrash={handleEmptyTrash}
            onShowSidebar={() => setMobilePanel('sidebar')}
            isMobile
          />
        )}
        {mobilePanel === 'editor' && activeNote && (
          <NoteEditor
            note={activeNote}
            folderTree={folderTree}
            tagList={tagList}
            isTrashView={activeView === 'trash'}
            onUpdate={handleUpdateNote}
            onDelete={handleDeleteNote}
            onRestore={handleRestoreNote}
            onMove={handleMoveNote}
            onBack={() => setMobilePanel('list')}
            onTagsChanged={loadFolders}
            isMobile
          />
        )}
      </div>
    )
  }

  // Desktop: three-panel grid
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '240px 300px 1fr',
      height: 'calc(100dvh - 48px)',
      margin: '-2rem',
      overflow: 'hidden',
    }}>
      {/* Left Panel: Folder Tree + Smart Views */}
      <NoteSidebar
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

      {/* Middle Panel: Note List */}
      <NoteList
        notes={noteList}
        loading={loading}
        title={listTitle}
        activeNoteId={activeNoteId}
        isTrashView={activeView === 'trash'}
        searchQuery={searchQuery}
        onSearch={setSearch}
        onSelectNote={selectNote}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        onRestoreNote={handleRestoreNote}
        onEmptyTrash={handleEmptyTrash}
      />

      {/* Right Panel: Note Editor */}
      {activeNote ? (
        <NoteEditor
          note={activeNote}
          folderTree={folderTree}
          tagList={tagList}
          isTrashView={activeView === 'trash'}
          onUpdate={handleUpdateNote}
          onDelete={handleDeleteNote}
          onRestore={handleRestoreNote}
          onMove={handleMoveNote}
          onTagsChanged={loadFolders}
        />
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-crust)',
          color: 'var(--color-subtext-0)',
          fontSize: '0.9rem',
          borderLeft: '1px solid var(--color-surface-0)',
        }}>
          Select a note or create a new one
        </div>
      )}
    </div>
  )
}
