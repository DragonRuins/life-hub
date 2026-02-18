/**
 * Projects Page
 *
 * Shows all projects as cards in a grid layout with status filtering,
 * search, and tag management. Click a card to view the project detail.
 * Completed/archived projects are filtered out by default.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FolderKanban, Search, X, ChevronDown, ChevronRight, Tag, Check, ExternalLink } from 'lucide-react'
import { projects } from '../api/client'
import useIsMobile from '../hooks/useIsMobile'

// ── Preset Color Palette (Catppuccin Mocha) ──────────────────────
const PRESET_COLORS = [
  { hex: '#89b4fa', name: 'Blue' },
  { hex: '#a6e3a1', name: 'Green' },
  { hex: '#fab387', name: 'Peach' },
  { hex: '#f38ba8', name: 'Red' },
  { hex: '#cba6f7', name: 'Mauve' },
  { hex: '#f9e2af', name: 'Yellow' },
  { hex: '#94e2d5', name: 'Teal' },
  { hex: '#89dceb', name: 'Sky' },
  { hex: '#b4befe', name: 'Lavender' },
  { hex: '#f2cdcd', name: 'Flamingo' },
  { hex: '#f5e0dc', name: 'Rosewater' },
  { hex: '#74c7ec', name: 'Sapphire' },
  { hex: '#eba0ac', name: 'Maroon' },
  { hex: '#a6adc8', name: 'Gray' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Active' },
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active Only' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'All Statuses' },
]

const STATUS_BADGE_COLORS = {
  planning: { bg: 'rgba(137, 180, 250, 0.15)', color: 'var(--color-blue)' },
  active: { bg: 'rgba(166, 227, 161, 0.15)', color: 'var(--color-green)' },
  paused: { bg: 'rgba(249, 226, 175, 0.15)', color: 'var(--color-yellow)' },
  completed: { bg: 'rgba(166, 227, 161, 0.15)', color: 'var(--color-green)' },
  archived: { bg: 'rgba(166, 173, 200, 0.15)', color: 'var(--color-subtext-0)' },
}

export default function Projects() {
  const isMobile = useIsMobile()

  // Data state
  const [projectList, setProjectList] = useState([])
  const [tagList, setTagList] = useState([])
  const [loading, setLoading] = useState(true)

  // Filter state
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // UI state
  const [showForm, setShowForm] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)

  async function loadProjects() {
    try {
      const params = {}
      if (statusFilter === 'all') {
        params.show_all = 'true'
      } else if (statusFilter) {
        params.status = statusFilter
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim()
      }
      const data = await projects.list(params)
      setProjectList(data)
    } catch (err) {
      console.error('Failed to load projects:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadTags() {
    try {
      const data = await projects.tags.list()
      setTagList(data)
    } catch (err) {
      console.error('Failed to load tags:', err)
    }
  }

  useEffect(() => {
    loadProjects()
    loadTags()
  }, [])

  // Reload when filters change
  useEffect(() => {
    loadProjects()
  }, [statusFilter, searchQuery])

  async function handleCreateProject(formData) {
    try {
      await projects.create(formData)
      await loadProjects()
      setShowForm(false)
    } catch (err) {
      alert('Failed to create project: ' + err.message)
    }
  }

  async function handleCreateTag(tagData) {
    try {
      await projects.tags.create(tagData)
      await loadTags()
    } catch (err) {
      alert('Failed to create tag: ' + err.message)
    }
  }

  async function handleUpdateTag(tagId, tagData) {
    try {
      await projects.tags.update(tagId, tagData)
      await loadTags()
    } catch (err) {
      alert('Failed to update tag: ' + err.message)
    }
  }

  async function handleDeleteTag(tagId) {
    if (!confirm('Delete this tag? It will be removed from all projects.')) return
    try {
      await projects.tags.delete(tagId)
      await loadTags()
      await loadProjects()
    } catch (err) {
      alert('Failed to delete tag: ' + err.message)
    }
  }

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em' }}>Projects</h1>
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Track your software projects and tasks
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Project'}
        </button>
      </div>

      {/* ── New Project Form ──────────────────────────────── */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <ProjectForm onSubmit={handleCreateProject} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* ── Filter Bar ────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '0.75rem', marginBottom: '1.25rem',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: '140px' }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div style={{ position: 'relative', flex: isMobile ? '1' : '0 1 280px' }}>
          <Search size={16} style={{
            position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--color-overlay-0)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', width: '100%' }}
          />
        </div>

        <button
          className="btn btn-ghost"
          onClick={() => setShowTagManager(!showTagManager)}
          style={{ marginLeft: 'auto', fontSize: '0.8rem' }}
        >
          <Tag size={14} />
          Manage Tags
          {showTagManager ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* ── Tag Manager (collapsible) ─────────────────────── */}
      {showTagManager && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <TagManager
            tags={tagList}
            onCreate={handleCreateTag}
            onUpdate={handleUpdateTag}
            onDelete={handleDeleteTag}
          />
        </div>
      )}

      {/* ── Project Cards Grid ────────────────────────────── */}
      {loading ? (
        <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
      ) : projectList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <FolderKanban size={40} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-subtext-0)' }}>
            {searchQuery || statusFilter ? 'No projects match your filters.' : 'No projects yet. Create your first one!'}
          </p>
        </div>
      ) : (
        <div className="card-grid">
          {projectList.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// ── Project Card ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function ProjectCard({ project }) {
  const totalTasks = project.task_count || 0
  const doneTasks = project.done_task_count || 0
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const badge = STATUS_BADGE_COLORS[project.status] || STATUS_BADGE_COLORS.active

  return (
    <Link to={`/projects/${project.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
        {/* Color bar on left edge */}
        {project.color && (
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px',
            background: project.color, borderRadius: '8px 0 0 8px',
          }} />
        )}

        <div style={{ paddingLeft: project.color ? '0.5rem' : 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, flex: 1, lineHeight: 1.3 }}>
              {project.name}
            </h3>
            <span style={{
              fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
              borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.04em',
              background: badge.bg, color: badge.color, flexShrink: 0,
            }}>
              {project.status}
            </span>
          </div>

          {/* Description preview */}
          {project.description && (
            <p style={{
              fontSize: '0.8rem', color: 'var(--color-subtext-0)',
              marginBottom: '0.5rem', lineHeight: 1.4,
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {project.description}
            </p>
          )}

          {/* Tech stack preview */}
          {project.tech_stack_preview && project.tech_stack_preview.length > 0 && (
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {project.tech_stack_preview.map((ts) => (
                <span key={ts.id} style={{
                  fontSize: '0.65rem', fontWeight: 500, padding: '0.1rem 0.4rem',
                  borderRadius: '4px', background: 'var(--color-surface-1)',
                  color: 'var(--color-subtext-0)',
                }}>
                  {ts.name}
                </span>
              ))}
              {project.tech_stack_count > 4 && (
                <span style={{
                  fontSize: '0.65rem', color: 'var(--color-overlay-0)',
                  padding: '0.1rem 0.25rem',
                }}>
                  +{project.tech_stack_count - 4}
                </span>
              )}
            </div>
          )}

          {/* Tags */}
          {project.tags && project.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              {project.tags.map((tag) => (
                <span key={tag.id} style={{
                  fontSize: '0.65rem', fontWeight: 500, padding: '0.1rem 0.4rem',
                  borderRadius: '9999px',
                  background: tag.color ? `${tag.color}22` : 'var(--color-surface-1)',
                  color: tag.color || 'var(--color-subtext-0)',
                  border: `1px solid ${tag.color ? tag.color + '44' : 'var(--color-surface-2)'}`,
                }}>
                  {tag.name}
                </span>
              ))}
            </div>
          )}

          {/* Task progress bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{
              flex: 1, height: '4px', background: 'var(--color-surface-1)',
              borderRadius: '2px', overflow: 'hidden',
            }}>
              <div style={{
                width: `${progressPct}%`, height: '100%',
                background: progressPct === 100 ? 'var(--color-green)' : 'var(--color-blue)',
                borderRadius: '2px', transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)', whiteSpace: 'nowrap' }}>
              {doneTasks}/{totalTasks} tasks
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}


// ══════════════════════════════════════════════════════════════════
// ── New Project Form ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function ProjectForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'active',
    color: '#89b4fa',
    repo_url: '',
    live_url: '',
    started_at: '',
  })

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>New Project</h3>

      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Name *</label>
          <input name="name" placeholder="My Project" value={form.name} onChange={handleChange} required />
        </div>
        <div>
          <label>Status</label>
          <select name="status" value={form.status} onChange={handleChange}>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label>Description</label>
        <textarea
          name="description" rows={2} placeholder="Brief project summary..."
          value={form.description} onChange={handleChange}
        />
      </div>

      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Repository URL</label>
          <input name="repo_url" placeholder="https://github.com/user/repo" value={form.repo_url} onChange={handleChange} />
        </div>
        <div>
          <label>Live URL</label>
          <input name="live_url" placeholder="https://example.com" value={form.live_url} onChange={handleChange} />
        </div>
      </div>

      <div className="form-grid-2col" style={{ marginBottom: '1rem' }}>
        <div>
          <label>Started Date</label>
          <input name="started_at" type="date" value={form.started_at} onChange={handleChange} />
        </div>
        <div>
          <label>Color</label>
          <ColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary">Create Project</button>
      </div>
    </form>
  )
}


// ══════════════════════════════════════════════════════════════════
// ── Color Picker ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.name}
          onClick={() => onChange(c.hex)}
          style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: c.hex, border: 'none', cursor: 'pointer',
            outline: value === c.hex ? '2px solid var(--color-text)' : '2px solid transparent',
            outlineOffset: '2px', transition: 'outline 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {value === c.hex && <Check size={12} style={{ color: '#1e1e2e' }} />}
        </button>
      ))}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// ── Tag Manager ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function TagManager({ tags, onCreate, onUpdate, onDelete }) {
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#89b4fa')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')

  function handleCreate(e) {
    e.preventDefault()
    if (!newTagName.trim()) return
    onCreate({ name: newTagName.trim(), color: newTagColor })
    setNewTagName('')
  }

  function startEdit(tag) {
    setEditingId(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color || '#89b4fa')
  }

  function handleSaveEdit() {
    if (!editName.trim()) return
    onUpdate(editingId, { name: editName.trim(), color: editColor })
    setEditingId(null)
  }

  return (
    <div>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>
        Project Tags
      </h3>

      {/* Existing tags */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginBottom: '1rem' }}>
          {tags.map((tag) => (
            <div key={tag.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.375rem 0.5rem', background: 'var(--color-surface-0)',
              borderRadius: '6px',
            }}>
              {editingId === tag.id ? (
                <>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{ flex: 1, fontSize: '0.8rem' }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }} onClick={handleSaveEdit}>Save</button>
                  <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }} onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: tag.color || 'var(--color-overlay-0)', flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, fontSize: '0.85rem' }}>{tag.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-subtext-0)' }}>
                    {tag.project_count || 0} project{tag.project_count !== 1 ? 's' : ''}
                  </span>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                    onClick={() => startEdit(tag)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
                    onClick={() => onDelete(tag.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add new tag */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 150px' }}>
          <label style={{ fontSize: '0.75rem' }}>New Tag</label>
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="Tag name..."
            style={{ fontSize: '0.85rem' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem' }}>Color</label>
          <ColorPicker value={newTagColor} onChange={setNewTagColor} />
        </div>
        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }}>
          <Plus size={14} /> Add Tag
        </button>
      </form>
    </div>
  )
}
