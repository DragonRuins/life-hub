/**
 * TaskDetailModal — Full task editor in a centered modal overlay.
 *
 * Two-panel layout on desktop (description left, metadata right),
 * stacks vertically on mobile. Uses lightweight TipTap (StarterKit only)
 * for the description editor. Saves on explicit "Save" button click.
 *
 * Props:
 *   task       - Task object to edit (or null to hide)
 *   columns    - Array of kanban columns (for column dropdown)
 *   onSave     - (taskId, updates) => Promise — persist changes
 *   onDelete   - (taskId) => Promise — delete the task
 *   onClose    - () => void — close modal
 */
import { useState, useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import {
  X, Trash2, Calendar, Clock, Tag, Flag, Columns3,
  Save, AlertCircle,
} from 'lucide-react'
import useIsMobile from '../hooks/useIsMobile'

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'var(--color-overlay-0)' },
  { value: 'normal', label: 'Normal', color: 'var(--color-blue)' },
  { value: 'high', label: 'High', color: 'var(--color-peach)' },
  { value: 'critical', label: 'Critical', color: 'var(--color-red)' },
]

export default function TaskDetailModal({ task, columns, onSave, onDelete, onClose }) {
  const isMobile = useIsMobile()

  // ── Local form state ──────────────────────────────────────
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('normal')
  const [columnId, setColumnId] = useState(null)
  const [dueDate, setDueDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [labelsText, setLabelsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // ── TipTap Editor (lightweight: StarterKit only) ──────────
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Add a description...' }),
    ],
    content: '',
    onUpdate: () => setDirty(true),
  })

  // ── Sync form state when task prop changes ────────────────
  useEffect(() => {
    if (!task) return

    setTitle(task.title || '')
    setPriority(task.priority || 'normal')
    setColumnId(task.column_id)
    setDueDate(task.due_date || '')
    setEstimatedHours(task.estimated_hours ?? '')
    setLabelsText((task.labels || []).join(', '))
    setDirty(false)

    // Set editor content
    if (editor) {
      const newContent = task.description_json || ''
      const currentJSON = JSON.stringify(editor.getJSON())
      const incoming = JSON.stringify(newContent)
      if (currentJSON !== incoming) {
        editor.commands.setContent(newContent || '')
      }
    }
  }, [task, editor])

  // ── Close on Escape ────────────────────────────────────────
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // ── Save handler ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!task || saving) return
    setSaving(true)

    // Parse labels from comma-separated text
    const labels = labelsText
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean)

    const updates = {
      title: title.trim(),
      priority,
      due_date: dueDate || null,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
      labels,
      description_json: editor ? editor.getJSON() : task.description_json,
    }

    // Include column_id if it changed — parent handles the move API call
    if (columnId !== task.column_id) {
      updates.column_id = columnId
    }

    try {
      await onSave(task.id, updates)
      setDirty(false)
    } catch (err) {
      console.error('Failed to save task:', err)
    } finally {
      setSaving(false)
    }
  }, [task, title, priority, dueDate, estimatedHours, labelsText, columnId, editor, saving, onSave])

  // ── Delete handler ────────────────────────────────────────
  async function handleDelete() {
    if (!task) return
    if (!confirm(`Delete task "${task.title}"?`)) return
    await onDelete(task.id)
  }

  if (!task) return null

  const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date()

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        pointerEvents: 'none',
      }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            pointerEvents: 'auto',
            background: 'var(--color-base)',
            border: '1px solid var(--color-surface-0)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: 'min(800px, calc(100vw - 2rem))',
            maxHeight: 'min(85dvh, 700px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* ── Top Bar ──────────────────────────────────── */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1rem',
            borderBottom: '1px solid var(--color-surface-0)',
            flexShrink: 0,
          }}>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
              style={{
                flex: 1, fontSize: '1rem', fontWeight: 600,
                background: 'transparent', border: 'none',
                color: 'var(--color-text)', outline: 'none',
                padding: '0.125rem 0',
              }}
              placeholder="Task title..."
            />
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            >
              <Save size={14} />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-subtext-0)', display: 'flex', padding: '0.25rem',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── Body (two-panel or stacked) ──────────────── */}
          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            flex: 1,
            overflow: 'hidden',
          }}>
            {/* Left: Description Editor */}
            <div style={{
              flex: isMobile ? 'none' : '1 1 60%',
              padding: '1rem',
              overflow: 'auto',
              borderRight: isMobile ? 'none' : '1px solid var(--color-surface-0)',
              borderBottom: isMobile ? '1px solid var(--color-surface-0)' : 'none',
              minHeight: isMobile ? '150px' : 'auto',
            }}>
              <label style={{
                fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-subtext-0)',
                textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem',
                display: 'block',
              }}>
                Description
              </label>
              <div className="task-tiptap-editor">
                <EditorContent editor={editor} />
              </div>
            </div>

            {/* Right: Metadata Fields */}
            <div style={{
              flex: isMobile ? 'none' : '0 0 40%',
              padding: '1rem',
              overflow: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.875rem',
            }}>
              {/* Priority */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Flag size={12} /> Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => { setPriority(e.target.value); setDirty(true) }}
                  style={{ fontSize: '0.85rem' }}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              {/* Column */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Columns3 size={12} /> Column
                </label>
                <select
                  value={columnId || ''}
                  onChange={(e) => { setColumnId(parseInt(e.target.value)); setDirty(true) }}
                  style={{ fontSize: '0.85rem' }}
                >
                  {columns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name}{col.is_done_column ? ' (Done)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  color: isOverdue ? 'var(--color-red)' : undefined,
                }}>
                  <Calendar size={12} /> Due Date
                  {isOverdue && <AlertCircle size={11} style={{ color: 'var(--color-red)' }} />}
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => { setDueDate(e.target.value); setDirty(true) }}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {/* Estimated Hours */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={12} /> Estimated Hours
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimatedHours}
                  onChange={(e) => { setEstimatedHours(e.target.value); setDirty(true) }}
                  placeholder="0"
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {/* Labels */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Tag size={12} /> Labels
                </label>
                <input
                  value={labelsText}
                  onChange={(e) => { setLabelsText(e.target.value); setDirty(true) }}
                  placeholder="bug, feature, ui..."
                  style={{ fontSize: '0.85rem' }}
                />
                <span style={{
                  fontSize: '0.65rem', color: 'var(--color-overlay-0)', marginTop: '0.2rem', display: 'block',
                }}>
                  Comma-separated
                </span>
              </div>

              {/* Timestamps (read-only) */}
              <div style={{
                marginTop: 'auto', paddingTop: '0.75rem',
                borderTop: '1px solid var(--color-surface-0)',
                fontSize: '0.7rem', color: 'var(--color-overlay-0)',
                display: 'flex', flexDirection: 'column', gap: '0.2rem',
              }}>
                <span>Created: {new Date(task.created_at).toLocaleString()}</span>
                {task.completed_at && (
                  <span style={{ color: 'var(--color-green)' }}>
                    Completed: {new Date(task.completed_at).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={handleDelete}
                className="btn btn-danger"
                style={{ fontSize: '0.8rem', marginTop: '0.25rem', alignSelf: 'flex-start' }}
              >
                <Trash2 size={14} /> Delete Task
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* TipTap minimal styles for the task editor */}
      <style>{`
        .task-tiptap-editor .ProseMirror {
          outline: none;
          min-height: 120px;
          font-size: 0.875rem;
          line-height: 1.6;
          color: var(--color-text);
        }
        .task-tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--color-overlay-0);
          pointer-events: none;
          height: 0;
        }
        .task-tiptap-editor .ProseMirror h1,
        .task-tiptap-editor .ProseMirror h2,
        .task-tiptap-editor .ProseMirror h3 {
          font-weight: 600;
          margin: 0.75em 0 0.25em;
          line-height: 1.3;
        }
        .task-tiptap-editor .ProseMirror h1 { font-size: 1.2em; }
        .task-tiptap-editor .ProseMirror h2 { font-size: 1.05em; }
        .task-tiptap-editor .ProseMirror h3 { font-size: 0.95em; }
        .task-tiptap-editor .ProseMirror ul,
        .task-tiptap-editor .ProseMirror ol {
          padding-left: 1.2em;
          margin: 0.5em 0;
        }
        .task-tiptap-editor .ProseMirror li { margin: 0.15em 0; }
        .task-tiptap-editor .ProseMirror code {
          background: var(--color-surface-0);
          padding: 0.1em 0.3em;
          border-radius: 3px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.85em;
        }
        .task-tiptap-editor .ProseMirror pre {
          background: var(--color-mantle);
          border: 1px solid var(--color-surface-0);
          border-radius: 6px;
          padding: 0.75em;
          margin: 0.5em 0;
          overflow-x: auto;
        }
        .task-tiptap-editor .ProseMirror pre code {
          background: none;
          padding: 0;
        }
        .task-tiptap-editor .ProseMirror blockquote {
          border-left: 3px solid var(--color-surface-1);
          padding-left: 0.75em;
          margin: 0.5em 0;
          color: var(--color-subtext-0);
        }
        .task-tiptap-editor .ProseMirror strong { font-weight: 600; }
        .task-tiptap-editor .ProseMirror hr {
          border: none;
          border-top: 1px solid var(--color-surface-0);
          margin: 1em 0;
        }
      `}</style>
    </>
  )
}
