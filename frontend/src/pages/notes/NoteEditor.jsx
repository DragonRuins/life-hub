/**
 * NoteEditor - Right panel of the three-panel layout
 *
 * Displays the note title, formatting toolbar, TipTap WYSIWYG editor,
 * and a footer with save status.
 *
 * Features:
 *   - TipTap rich text editor with full formatting
 *   - Auto-save with 1.5s debounce
 *   - Star toggle, tag management, folder selector
 *   - Save status indicator (Saved / Saving / Unsaved / Error)
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Image } from '@tiptap/extension-image'
import { Link } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight } from '@tiptap/extension-highlight'
import { common, createLowlight } from 'lowlight'

import NoteEditorHeader from './NoteEditorHeader'
import NoteEditorFooter from './NoteEditorFooter'
import EditorToolbar from './EditorToolbar'
import AttachmentPicker from './AttachmentPicker'
import { attachments } from '../../api/client'
import './tiptap.css'

const SAVE_DELAY = 1500 // ms after last keystroke

export default function NoteEditor({
  note,
  folderTree,
  tagList,
  isTrashView,
  onUpdate,
  onDelete,
  onRestore,
  onMove,
  onBack,
  onTagsChanged,
  isMobile,
}) {
  const [title, setTitle] = useState(note?.title || '')
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'unsaved' | 'error'
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState('image') // 'image' | 'file'

  const saveTimerRef = useRef(null)
  const noteIdRef = useRef(note?.id)
  const latestContentRef = useRef(note?.content_json)

  // Create the TipTap editor instance here so both toolbar and editor share it
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: 'Start writing...' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
      Table.configure({ resizable: true }),
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

  // Reset state when note changes
  useEffect(() => {
    setTitle(note?.title || '')
    setSaveStatus('saved')
    noteIdRef.current = note?.id
    latestContentRef.current = note?.content_json

    // Update editor content for the new note
    if (editor) {
      const currentJSON = JSON.stringify(editor.getJSON())
      const newJSON = JSON.stringify(note?.content_json || '')
      if (currentJSON !== newJSON) {
        editor.commands.setContent(note?.content_json || '')
      }
      editor.setEditable(!isTrashView)
    }

    // Flush any pending save for the previous note
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [note?.id, isTrashView])

  // Debounced save function
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
    }, SAVE_DELAY)
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

  // Keyboard shortcuts
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

  // Handle attachment selection from the picker
  function handleAttachmentSelect(attachment) {
    if (!editor) return
    const fileUrl = attachments.fileUrl(attachment.id)

    if (attachment.mime_type?.startsWith('image/')) {
      // Insert image into editor
      editor.chain().focus().setImage({ src: fileUrl, alt: attachment.filename }).run()
    } else {
      // Insert document as a link
      editor.chain().focus()
        .insertContent({
          type: 'text',
          text: attachment.filename,
          marks: [{ type: 'link', attrs: { href: fileUrl } }],
        })
        .run()
    }
  }

  // Count words from the editor's text content
  const wordCount = editor
    ? editor.state.doc.textContent.trim().split(/\s+/).filter(Boolean).length
    : 0

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--color-base)',
      borderLeft: isMobile ? 'none' : '1px solid var(--color-surface-0)',
    }}>
      {/* Metadata header: star, folder, tags, actions */}
      <NoteEditorHeader
        note={note}
        tagList={tagList}
        folderTree={folderTree}
        isTrashView={isTrashView}
        onStarToggle={handleStarToggle}
        onTagToggle={handleTagToggle}
        onDelete={() => onDelete(note.id)}
        onRestore={() => onRestore(note.id)}
        onMove={onMove}
        onBack={onBack}
        isMobile={isMobile}
      />

      {/* Formatting toolbar */}
      {!isTrashView && (
        <EditorToolbar
          editor={editor}
          onImageClick={() => { setPickerMode('image'); setPickerOpen(true) }}
          onAttachClick={() => { setPickerMode('file'); setPickerOpen(true) }}
        />
      )}

      {/* Title input */}
      <div style={{ padding: '0.75rem 1.25rem 0' }}>
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="Untitled"
          disabled={isTrashView}
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            border: 'none',
            background: 'transparent',
            color: 'var(--color-text)',
            width: '100%',
            padding: 0,
            outline: 'none',
            letterSpacing: '-0.02em',
          }}
        />
      </div>

      {/* TipTap Editor */}
      <div style={{ flex: 1, padding: '0.75rem 1.25rem', overflowY: 'auto' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Footer: save status + word count */}
      <NoteEditorFooter
        saveStatus={saveStatus}
        wordCount={wordCount}
        updatedAt={note?.updated_at}
      />

      {/* Attachment picker modal */}
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
