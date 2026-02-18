/**
 * TipTapEditor - WYSIWYG editor wrapper
 *
 * Configures all TipTap extensions and renders the editor.
 * This component is shared between Catppuccin and LCARS themes
 * (only the surrounding chrome differs; editor content is styled via CSS).
 *
 * Extensions included:
 *   - StarterKit (bold, italic, strike, code, paragraphs, headings,
 *     lists, blockquote, horizontal rule, undo/redo)
 *   - TaskList + TaskItem (interactive checklists)
 *   - CodeBlockLowlight (syntax-highlighted code blocks)
 *   - Table, TableRow, TableHeader, TableCell
 *   - Image (inline images from attachments)
 *   - Link (internal note links + external URLs)
 *   - Underline, TextAlign, Highlight
 *   - Placeholder
 */
import { useEffect } from 'react'
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

import './tiptap.css'

const lowlight = createLowlight(common)

export default function TipTapEditor({ content, onUpdate, editable = true }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable the default code block — we use CodeBlockLowlight instead
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true, // Allow nested checklists
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: false,
        allowBase64: false, // Force server-uploaded URLs
      }),
      Link.configure({
        openOnClick: false,  // Don't navigate while editing
        autolink: true,      // Auto-detect URLs
        HTMLAttributes: {
          rel: 'noopener noreferrer',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON())
    },
  })

  // Sync editable state when it changes (e.g., trash view)
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  // Update content when the note changes (different note selected)
  useEffect(() => {
    if (editor && content !== undefined) {
      // Only reset content if the document structure actually differs
      // (prevents cursor jumping during auto-save round-trips)
      const currentJSON = JSON.stringify(editor.getJSON())
      const newJSON = JSON.stringify(content)
      if (currentJSON !== newJSON) {
        editor.commands.setContent(content || '')
      }
    }
  }, [editor, content])

  if (!editor) return null

  return <EditorContent editor={editor} />
}

