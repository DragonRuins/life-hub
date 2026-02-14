/**
 * Notes Page
 *
 * Full notes management with:
 *   - Create/edit/delete notes
 *   - Search across titles, content, and tags
 *   - Filter by category
 *   - Pin important notes to the top
 */
import { useState, useEffect } from 'react'
import { Plus, Search, Pin, Trash2, X, Pencil, Tag } from 'lucide-react'
import { notes } from '../api/client'

export default function Notes() {
  const [noteList, setNoteList] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingNote, setEditingNote] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('')

  async function loadNotes() {
    try {
      const params = {}
      if (searchQuery) params.search = searchQuery
      if (activeCategory) params.category = activeCategory

      const [noteData, catData] = await Promise.all([
        notes.list(params),
        notes.categories(),
      ])
      setNoteList(noteData)
      setCategories(catData)
    } catch (err) {
      console.error('Failed to load notes:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadNotes() }, [searchQuery, activeCategory])

  async function handleSave(formData) {
    try {
      if (editingNote) {
        await notes.update(editingNote.id, formData)
      } else {
        await notes.create(formData)
      }
      await loadNotes()
      setShowForm(false)
      setEditingNote(null)
    } catch (err) {
      alert('Failed to save note: ' + err.message)
    }
  }

  async function handleDelete(noteId) {
    if (!window.confirm('Delete this note?')) return
    try {
      await notes.delete(noteId)
      await loadNotes()
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  async function handleTogglePin(note) {
    try {
      await notes.update(note.id, { is_pinned: !note.is_pinned })
      await loadNotes()
    } catch (err) {
      alert('Failed to update: ' + err.message)
    }
  }

  function startEdit(note) {
    setEditingNote(note)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingNote(null)
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Notes</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {noteList.length} note{noteList.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingNote(null); setShowForm(!showForm) }}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Note'}
        </button>
      </div>

      {/* Search and Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-overlay-0)',
            }}
          />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>

        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={`btn ${!activeCategory ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveCategory('')}
              style={{ fontSize: '0.78rem', padding: '0.375rem 0.75rem' }}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`btn ${activeCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveCategory(cat)}
                style={{ fontSize: '0.78rem', padding: '0.375rem 0.75rem' }}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Note Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <NoteForm
            note={editingNote}
            categories={categories}
            onSubmit={handleSave}
            onCancel={cancelForm}
          />
        </div>
      )}

      {/* Notes List */}
      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
      ) : noteList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>
            {searchQuery || activeCategory ? 'No notes match your search.' : 'No notes yet. Create your first one!'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {noteList.map((note) => (
            <div
              key={note.id}
              className="card"
              style={{
                cursor: 'pointer',
                borderLeft: note.is_pinned ? '3px solid var(--color-yellow)' : undefined,
              }}
              onClick={() => startEdit(note)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                  {note.is_pinned && <Pin size={14} style={{ color: 'var(--color-yellow)', flexShrink: 0 }} />}
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.title}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleTogglePin(note)}
                    style={{ padding: '0.25rem', border: 'none' }}
                    title={note.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin size={14} style={{ color: note.is_pinned ? 'var(--color-yellow)' : 'var(--color-overlay-0)' }} />
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(note.id)}
                    style={{ padding: '0.25rem' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p style={{
                fontSize: '0.83rem',
                color: 'var(--color-subtext-0)',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.5,
              }}>
                {note.content}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                {note.category && (
                  <span style={{
                    fontSize: '0.7rem', padding: '0.125rem 0.5rem', borderRadius: '4px',
                    background: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)',
                  }}>
                    {note.category}
                  </span>
                )}
                {note.tags?.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '0.7rem', padding: '0.125rem 0.5rem', borderRadius: '4px',
                      background: 'var(--color-surface-0)', color: 'var(--color-overlay-1)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


function NoteForm({ note, categories, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    title: note?.title || '',
    content: note?.content || '',
    category: note?.category || 'general',
    tags: note?.tags?.join(', ') || '',
    is_pinned: note?.is_pinned || false,
  })

  function handleChange(e) {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm({ ...form, [e.target.name]: value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean).join(','),
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
        {note ? 'Edit Note' : 'New Note'}
      </h3>

      <div style={{ marginBottom: '1rem' }}>
        <label>Title *</label>
        <input name="title" placeholder="Note title" value={form.title} onChange={handleChange} required />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Content *</label>
        <textarea name="content" rows={6} placeholder="Write your note..." value={form.content} onChange={handleChange} required />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div>
          <label>Category</label>
          <input name="category" placeholder="general" value={form.category} onChange={handleChange} list="category-list" />
          <datalist id="category-list">
            {categories.map((cat) => <option key={cat} value={cat} />)}
          </datalist>
        </div>
        <div>
          <label>Tags (comma-separated)</label>
          <input name="tags" placeholder="recipe, dinner, quick" value={form.tags} onChange={handleChange} />
        </div>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" name="is_pinned" checked={form.is_pinned} onChange={handleChange} style={{ width: 'auto' }} />
          <span style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.875rem' }}>Pin this note</span>
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">{note ? 'Save Changes' : 'Create Note'}</button>
      </div>
    </form>
  )
}
