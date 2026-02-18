/**
 * EditorToolbar - Formatting toolbar for the TipTap editor
 *
 * Groups controls into logical sections:
 *   Text formatting | Headings | Lists | Insert (code, table, image, link)
 *
 * Each button reflects its active state from the editor.
 */
import { useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Highlighter, Code,
  Heading1, Heading2, Heading3,
  List, ListOrdered, ListChecks, Quote,
  Table, ImagePlus, Paperclip, Link as LinkIcon, Minus,
  AlignLeft, AlignCenter, AlignRight,
  Undo2, Redo2,
} from 'lucide-react'

export default function EditorToolbar({ editor, onImageClick, onAttachClick }) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  if (!editor) return null

  function handleSetLink() {
    if (linkUrl.trim()) {
      let url = linkUrl.trim()
      // Add protocol if missing
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
        url = 'https://' + url
      }
      editor.chain().focus().setLink({ href: url }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  function handleInsertTable() {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1px',
      padding: '0.35rem 0.75rem',
      borderBottom: '1px solid var(--color-surface-0)',
      flexWrap: 'wrap',
      background: 'var(--color-mantle)',
    }}>
      {/* Undo / Redo */}
      <ToolbarButton
        icon={Undo2}
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo"
      />
      <ToolbarButton
        icon={Redo2}
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo"
      />

      <Separator />

      {/* Text Formatting */}
      <ToolbarButton
        icon={Bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Bold"
      />
      <ToolbarButton
        icon={Italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Italic"
      />
      <ToolbarButton
        icon={UnderlineIcon}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Underline"
      />
      <ToolbarButton
        icon={Strikethrough}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Strikethrough"
      />
      <ToolbarButton
        icon={Code}
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Inline code"
      />
      <ToolbarButton
        icon={Highlighter}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        active={editor.isActive('highlight')}
        title="Highlight"
      />

      <Separator />

      {/* Headings */}
      <ToolbarButton
        icon={Heading1}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        active={editor.isActive('heading', { level: 1 })}
        title="Heading 1"
      />
      <ToolbarButton
        icon={Heading2}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive('heading', { level: 2 })}
        title="Heading 2"
      />
      <ToolbarButton
        icon={Heading3}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive('heading', { level: 3 })}
        title="Heading 3"
      />

      <Separator />

      {/* Lists */}
      <ToolbarButton
        icon={List}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Bullet list"
      />
      <ToolbarButton
        icon={ListOrdered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Numbered list"
      />
      <ToolbarButton
        icon={ListChecks}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        title="Checklist"
      />
      <ToolbarButton
        icon={Quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive('blockquote')}
        title="Blockquote"
      />

      <Separator />

      {/* Text Alignment */}
      <ToolbarButton
        icon={AlignLeft}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        active={editor.isActive({ textAlign: 'left' })}
        title="Align left"
      />
      <ToolbarButton
        icon={AlignCenter}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        active={editor.isActive({ textAlign: 'center' })}
        title="Align center"
      />
      <ToolbarButton
        icon={AlignRight}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        active={editor.isActive({ textAlign: 'right' })}
        title="Align right"
      />

      <Separator />

      {/* Insert blocks */}
      <ToolbarButton
        icon={() => <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 700 }}>{'{}'}</span>}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        active={editor.isActive('codeBlock')}
        title="Code block"
      />
      <ToolbarButton
        icon={Table}
        onClick={handleInsertTable}
        active={editor.isActive('table')}
        title="Insert table"
      />
      <ToolbarButton
        icon={Minus}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal rule"
      />
      <ToolbarButton
        icon={ImagePlus}
        onClick={onImageClick}
        title="Insert image"
      />
      <ToolbarButton
        icon={Paperclip}
        onClick={onAttachClick}
        title="Attach file"
      />

      {/* Link button with inline input */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
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
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 50 }}
              onClick={() => setShowLinkInput(false)}
            />
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              zIndex: 51,
              background: 'var(--color-surface-0)',
              border: '1px solid var(--color-surface-1)',
              borderRadius: '6px',
              padding: '0.4rem',
              display: 'flex',
              gap: '0.3rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
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
                  fontSize: '0.78rem',
                  padding: '0.25rem 0.4rem',
                  width: '200px',
                }}
              />
              <button
                onClick={handleSetLink}
                style={{
                  background: 'var(--color-blue)',
                  color: 'var(--color-crust)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                Set
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}


function ToolbarButton({ icon: Icon, onClick, active, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '28px',
        height: '28px',
        borderRadius: '4px',
        border: 'none',
        background: active ? 'var(--color-surface-1)' : 'transparent',
        color: disabled
          ? 'var(--color-surface-1)'
          : active
            ? 'var(--color-blue)'
            : 'var(--color-subtext-0)',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
      }}
    >
      {typeof Icon === 'function' && Icon.length === 0
        ? <Icon />
        : <Icon size={15} />
      }
    </button>
  )
}


function Separator() {
  return (
    <div style={{
      width: '1px',
      height: '18px',
      background: 'var(--color-surface-1)',
      margin: '0 0.25rem',
    }} />
  )
}
