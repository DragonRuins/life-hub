/**
 * ChangelogTimeline — Vertical timeline for project milestones/releases.
 *
 * Shows entries in reverse chronological order with type-based icons
 * and colors. Supports adding, editing, and deleting entries, plus
 * filtering by entry type.
 *
 * Props:
 *   entries    - Array of changelog entry objects
 *   onAdd      - (data) => Promise — create a new entry
 *   onUpdate   - (id, data) => Promise — update an entry
 *   onDelete   - (id) => Promise — delete an entry
 */
import { useState } from 'react'
import {
  Plus, X, Trash2, Edit2, Check,
  Rocket, Flag, Sparkles, Bug, FileText, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react'

// Entry type configuration: icon, color, label
const ENTRY_TYPES = [
  { value: 'release', label: 'Release', icon: Rocket, color: 'var(--color-green)' },
  { value: 'milestone', label: 'Milestone', icon: Flag, color: 'var(--color-blue)' },
  { value: 'feature', label: 'Feature', icon: Sparkles, color: 'var(--color-mauve)' },
  { value: 'fix', label: 'Fix', icon: Bug, color: 'var(--color-peach)' },
  { value: 'note', label: 'Note', icon: FileText, color: 'var(--color-subtext-0)' },
  { value: 'breaking_change', label: 'Breaking Change', icon: AlertTriangle, color: 'var(--color-red)' },
]

const TYPE_MAP = Object.fromEntries(ENTRY_TYPES.map(t => [t.value, t]))

function getTypeConfig(entryType) {
  return TYPE_MAP[entryType] || TYPE_MAP.note
}

export default function ChangelogTimeline({ entries, onAdd, onUpdate, onDelete }) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [editingId, setEditingId] = useState(null)

  const filteredEntries = filterType
    ? entries.filter(e => e.entry_type === filterType)
    : entries

  return (
    <div>
      {/* ── Header: Add button + Filter ──────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1rem', gap: '0.5rem', flexWrap: 'wrap',
      }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.8rem' }}
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel' : 'Add Entry'}
        </button>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{ fontSize: '0.8rem', width: 'auto', minWidth: '140px' }}
        >
          <option value="">All Types</option>
          {ENTRY_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* ── Add Entry Form ────────────────────────────── */}
      {showAddForm && (
        <AddEntryForm
          onSubmit={async (data) => {
            await onAdd(data)
            setShowAddForm(false)
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* ── Timeline ──────────────────────────────────── */}
      {filteredEntries.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
            {entries.length === 0
              ? 'No changelog entries yet. Add your first milestone or release.'
              : 'No entries match this filter.'}
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute', left: '7px', top: '8px', bottom: '8px',
            width: '2px', background: 'var(--color-surface-0)',
          }} />

          {filteredEntries.map((entry) => (
            <TimelineEntry
              key={entry.id}
              entry={entry}
              isEditing={editingId === entry.id}
              onStartEdit={() => setEditingId(entry.id)}
              onCancelEdit={() => setEditingId(null)}
              onUpdate={async (data) => {
                await onUpdate(entry.id, data)
                setEditingId(null)
              }}
              onDelete={() => onDelete(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}


// ── Add Entry Form ──────────────────────────────────────────────

function AddEntryForm({ onSubmit, onCancel }) {
  const [entryType, setEntryType] = useState('feature')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onSubmit({
        entry_type: entryType,
        title: title.trim(),
        description: description.trim() || null,
        version: version.trim() || null,
        entry_date: entryDate,
      })
    } catch (err) {
      alert('Failed to add entry: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1rem' }}>
      <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
        <div>
          <label>Type</label>
          <select value={entryType} onChange={(e) => setEntryType(e.target.value)}>
            {ENTRY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />
        </div>
      </div>

      <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
        <div>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What changed?" required />
        </div>
        <div>
          <label>Version (optional)</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.2.0" />
        </div>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <label>Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details about this change..."
          rows={2}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }} disabled={saving || !title.trim()}>
          {saving ? 'Adding...' : 'Add Entry'}
        </button>
      </div>
    </form>
  )
}


// ── Timeline Entry ──────────────────────────────────────────────

function TimelineEntry({ entry, isEditing, onStartEdit, onCancelEdit, onUpdate, onDelete }) {
  const typeConfig = getTypeConfig(entry.entry_type)
  const Icon = typeConfig.icon
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
      {/* Timeline dot */}
      <div style={{
        position: 'absolute', left: '-1.5rem', top: '0.375rem',
        width: '16px', height: '16px', borderRadius: '50%',
        background: 'var(--color-crust)',
        border: `2px solid ${typeConfig.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1,
      }}>
        <Icon size={8} style={{ color: typeConfig.color }} />
      </div>

      {isEditing ? (
        <EditEntryForm
          entry={entry}
          onSave={onUpdate}
          onCancel={onCancelEdit}
        />
      ) : (
        <div className="card" style={{ padding: '0.75rem 1rem' }}>
          {/* Header row: date + type badge + version + actions */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            flexWrap: 'wrap', marginBottom: '0.25rem',
          }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', fontFamily: 'var(--font-mono)' }}>
              {new Date(entry.entry_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
            <span style={{
              fontSize: '0.6rem', fontWeight: 600, padding: '0.1rem 0.35rem',
              borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.03em',
              background: `color-mix(in srgb, ${typeConfig.color} 15%, transparent)`,
              color: typeConfig.color,
            }}>
              {typeConfig.label}
            </span>
            {entry.version && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 600, padding: '0.1rem 0.35rem',
                borderRadius: '4px', background: 'var(--color-surface-1)',
                color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
              }}>
                v{entry.version}
              </span>
            )}

            {/* Spacer + actions */}
            <div style={{ flex: 1 }} />
            <button
              onClick={onStartEdit}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-overlay-0)', padding: '0.125rem', display: 'flex',
              }}
              title="Edit"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete "${entry.title}"?`)) onDelete()
              }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-overlay-0)', padding: '0.125rem', display: 'flex',
              }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Title */}
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {entry.title}
          </div>

          {/* Description (expandable) */}
          {entry.description && (
            <div style={{ marginTop: '0.25rem' }}>
              <div style={{
                fontSize: '0.8rem', color: 'var(--color-subtext-0)', lineHeight: 1.5,
                ...(!expanded ? {
                  overflow: 'hidden', textOverflow: 'ellipsis',
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                } : {}),
              }}>
                {entry.description}
              </div>
              {entry.description.length > 120 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-blue)', fontSize: '0.7rem', padding: '0.125rem 0',
                    display: 'flex', alignItems: 'center', gap: '0.15rem',
                  }}
                >
                  {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  {expanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}


// ── Edit Entry Form (inline) ────────────────────────────────────

function EditEntryForm({ entry, onSave, onCancel }) {
  const [entryType, setEntryType] = useState(entry.entry_type)
  const [title, setTitle] = useState(entry.title)
  const [description, setDescription] = useState(entry.description || '')
  const [version, setVersion] = useState(entry.version || '')
  const [entryDate, setEntryDate] = useState(entry.entry_date || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onSave({
        entry_type: entryType,
        title: title.trim(),
        description: description.trim() || null,
        version: version.trim() || null,
        entry_date: entryDate,
      })
    } catch (err) {
      alert('Failed to update: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '0.75rem 1rem', border: '1px solid var(--color-blue)' }}>
      <div className="form-grid-2col" style={{ marginBottom: '0.5rem' }}>
        <div>
          <label style={{ fontSize: '0.65rem' }}>Type</label>
          <select value={entryType} onChange={(e) => setEntryType(e.target.value)} style={{ fontSize: '0.8rem' }}>
            {ENTRY_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.65rem' }}>Date</label>
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} style={{ fontSize: '0.8rem' }} />
        </div>
      </div>
      <div className="form-grid-2col" style={{ marginBottom: '0.5rem' }}>
        <div>
          <label style={{ fontSize: '0.65rem' }}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: '0.8rem' }} required />
        </div>
        <div>
          <label style={{ fontSize: '0.65rem' }}>Version</label>
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.2.0" style={{ fontSize: '0.8rem' }} />
        </div>
      </div>
      <div style={{ marginBottom: '0.5rem' }}>
        <label style={{ fontSize: '0.65rem' }}>Description</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ fontSize: '0.8rem' }} />
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }} disabled={saving}>
          <Check size={12} /> {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
