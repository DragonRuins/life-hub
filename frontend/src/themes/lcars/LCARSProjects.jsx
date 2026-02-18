/**
 * LCARSProjects.jsx - LCARS-native Projects List Page
 *
 * Replaces the default Projects page when LCARS theme is active.
 * Project cards render as LCARSPanel rows, status filter as pill buttons,
 * and tag management in an LCARS panel.
 *
 * Route: /projects
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FolderKanban, Search, X, Tag, Check } from 'lucide-react'
import { projects } from '../../api/client'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'
import LCARSModal from './LCARSModal'
import './lcars-projects.css'

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

const STATUS_FILTERS = [
  { value: '', label: 'Active' },
  { value: 'planning', label: 'Planning' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
]

const STATUS_COLORS = {
  planning: 'var(--lcars-ice)',
  active: 'var(--lcars-green)',
  paused: 'var(--lcars-sunflower)',
  completed: 'var(--lcars-green)',
  archived: 'var(--lcars-gray)',
}

export default function LCARSProjects() {
  const [projectList, setProjectList] = useState([])
  const [tagList, setTagList] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)

  async function loadProjects() {
    try {
      const params = {}
      if (statusFilter === 'all') params.show_all = 'true'
      else if (statusFilter) params.status = statusFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()
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

  useEffect(() => { loadProjects(); loadTags() }, [])
  useEffect(() => { loadProjects() }, [statusFilter, searchQuery])

  async function handleCreateProject(formData) {
    try {
      await projects.create(formData)
      await loadProjects()
      setShowForm(false)
    } catch (err) {
      alert('Failed to create project: ' + err.message)
    }
  }

  return (
    <div style={{ maxWidth: '1000px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem',
      }}>
        <div>
          <h1 style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '1.5rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'var(--lcars-space-white)',
          }}>
            Project Registry
          </h1>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem', color: 'var(--lcars-lilac)', marginTop: '0.25rem',
          }}>
            {projectList.length} project{projectList.length !== 1 ? 's' : ''} registered
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <LCARSActionButton
            onClick={() => setShowTagManager(!showTagManager)}
            color="var(--lcars-african-violet)"
            label={showTagManager ? 'Close Tags' : 'Tags'}
          />
          <LCARSActionButton
            onClick={() => setShowForm(true)}
            color="var(--lcars-butterscotch)"
            label="New Project"
          />
        </div>
      </div>

      {/* Status Filter Pills */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map(f => {
          const isActive = statusFilter === f.value
          return (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              style={{
                padding: '0.3rem 0.75rem', border: 'none',
                background: isActive ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)',
                color: isActive ? '#000000' : 'var(--lcars-gray)',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.75rem', fontWeight: isActive ? 600 : 400,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {f.label}
            </button>
          )
        })}

        {/* Search input */}
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <Search size={14} style={{
            position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--lcars-gray)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '28px', width: '180px',
              background: 'rgba(102, 102, 136, 0.08)',
              border: '1px solid rgba(102, 102, 136, 0.25)',
              borderRadius: 0, color: 'var(--lcars-space-white)',
              fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem',
            }}
          />
        </div>
      </div>

      {/* Tag Manager Panel */}
      {showTagManager && (
        <LCARSPanel
          title="Tag Management"
          color="var(--lcars-african-violet)"
          style={{ marginBottom: '1rem' }}
        >
          <LCARSTagManager
            tags={tagList}
            onReload={() => { loadTags(); loadProjects() }}
          />
        </LCARSPanel>
      )}

      {/* Project List */}
      {loading ? (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.85rem', color: 'var(--lcars-gray)', padding: '2rem 0',
        }}>Loading...</div>
      ) : projectList.length === 0 ? (
        <LCARSPanel title="No Data" color="var(--lcars-gray)">
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <FolderKanban size={32} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.85rem', color: 'var(--lcars-gray)',
            }}>
              {searchQuery || statusFilter ? 'No projects match filters' : 'No projects in registry'}
            </div>
          </div>
        </LCARSPanel>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {projectList.map(project => (
            <LCARSProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {/* New Project Modal */}
      <LCARSModal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Register New Project"
        color="var(--lcars-butterscotch)"
      >
        <LCARSProjectForm
          onSubmit={handleCreateProject}
          onCancel={() => setShowForm(false)}
        />
      </LCARSModal>
    </div>
  )
}


// ── Project Card ────────────────────────────────────────────────

function LCARSProjectCard({ project }) {
  const totalTasks = project.task_count || 0
  const doneTasks = project.done_task_count || 0
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
  const statusColor = STATUS_COLORS[project.status] || 'var(--lcars-gray)'

  return (
    <Link to={`/projects/${project.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        display: 'flex', background: '#000000',
        border: '1px solid rgba(102, 102, 136, 0.3)',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = project.color || statusColor}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(102, 102, 136, 0.3)'}
      >
        {/* Left accent bar */}
        <div style={{ width: '6px', background: project.color || statusColor, flexShrink: 0 }} />

        <div style={{ flex: 1, padding: '0.625rem 0.75rem', minWidth: 0 }}>
          {/* Title + status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.92rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--lcars-space-white)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.name}
            </div>
            <span style={{
              padding: '0.1rem 0.4rem', background: statusColor,
              color: '#000000', fontFamily: "'Antonio', sans-serif",
              fontSize: '0.6rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {project.status}
            </span>
          </div>

          {/* Description */}
          {project.description && (
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.72rem', color: 'var(--lcars-gray)',
              marginTop: '0.25rem', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.description}
            </div>
          )}

          {/* Bottom row: tech stack + tags + progress */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            marginTop: '0.375rem', flexWrap: 'wrap',
          }}>
            {/* Tech stack badges */}
            {project.tech_stack_preview?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                {project.tech_stack_preview.slice(0, 3).map(ts => (
                  <span key={ts.id} style={{
                    fontSize: '0.58rem', padding: '0.05rem 0.35rem',
                    background: 'rgba(102, 102, 136, 0.15)',
                    color: 'var(--lcars-ice)',
                    fontFamily: "'Antonio', sans-serif",
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {ts.name}
                  </span>
                ))}
                {project.tech_stack_count > 3 && (
                  <span style={{ fontSize: '0.58rem', color: 'var(--lcars-gray)' }}>
                    +{project.tech_stack_count - 3}
                  </span>
                )}
              </div>
            )}

            {/* Tags */}
            {project.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.2rem' }}>
                {project.tags.slice(0, 2).map(tag => (
                  <span key={tag.id} style={{
                    fontSize: '0.58rem', padding: '0.05rem 0.35rem',
                    background: `${tag.color || 'var(--lcars-african-violet)'}25`,
                    color: tag.color || 'var(--lcars-african-violet)',
                    fontFamily: "'Antonio', sans-serif",
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {tag.name}
                  </span>
                ))}
              </div>
            )}

            {/* Progress */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <div style={{ width: '50px', height: '4px', background: 'rgba(102, 102, 136, 0.2)' }}>
                <div style={{
                  width: `${progressPct}%`, height: '100%',
                  background: progressPct === 100 ? 'var(--lcars-green)' : 'var(--lcars-ice)',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.65rem', color: 'var(--lcars-gray)', whiteSpace: 'nowrap',
              }}>
                {doneTasks}/{totalTasks}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}


// ── New Project Form (LCARS) ────────────────────────────────────

function LCARSProjectForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: '', description: '', status: 'active',
    color: '#89b4fa', repo_url: '', live_url: '', started_at: '',
  })
  const [saving, setSaving] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await onSubmit(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
        <div>
          <label>Name *</label>
          <input name="name" placeholder="Project name" value={form.name} onChange={handleChange} required />
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

      <div style={{ marginBottom: '0.75rem' }}>
        <label>Description</label>
        <textarea name="description" rows={2} placeholder="Brief summary..." value={form.description} onChange={handleChange} />
      </div>

      <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
        <div>
          <label>Repository URL</label>
          <input name="repo_url" placeholder="https://github.com/..." value={form.repo_url} onChange={handleChange} />
        </div>
        <div>
          <label>Live URL</label>
          <input name="live_url" placeholder="https://..." value={form.live_url} onChange={handleChange} />
        </div>
      </div>

      <div className="form-grid-2col" style={{ marginBottom: '0.75rem' }}>
        <div>
          <label>Started Date</label>
          <input name="started_at" type="date" value={form.started_at} onChange={handleChange} />
        </div>
        <div>
          <label>Color</label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
            {PRESET_COLORS.map(c => (
              <button
                key={c.hex} type="button" title={c.name}
                onClick={() => setForm({ ...form, color: c.hex })}
                style={{
                  width: '20px', height: '20px', borderRadius: 0,
                  background: c.hex, border: 'none', cursor: 'pointer',
                  outline: form.color === c.hex ? '2px solid var(--lcars-space-white)' : '2px solid transparent',
                  outlineOffset: '1px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {form.color === c.hex && <Check size={10} style={{ color: '#000' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim()}>
          {saving ? 'Creating...' : 'Create Project'}
        </button>
      </div>
    </form>
  )
}


// ── Tag Manager (LCARS) ─────────────────────────────────────────

function LCARSTagManager({ tags, onReload }) {
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#89b4fa')

  async function handleCreate(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await projects.tags.create({ name: newName.trim(), color: newColor })
      setNewName('')
      onReload()
    } catch (err) {
      alert('Failed to create tag: ' + err.message)
    }
  }

  async function handleDelete(tagId) {
    if (!confirm('Delete this tag?')) return
    try {
      await projects.tags.delete(tagId)
      onReload()
    } catch (err) {
      alert('Failed to delete tag: ' + err.message)
    }
  }

  return (
    <div>
      {tags.length > 0 && (
        <div style={{ marginBottom: '0.75rem' }}>
          {tags.map(tag => (
            <div key={tag.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.375rem 0',
              borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
            }}>
              <div style={{
                width: '10px', height: '10px',
                background: tag.color || 'var(--lcars-gray)', flexShrink: 0,
              }} />
              <span style={{
                flex: 1, fontFamily: "'Antonio', sans-serif",
                fontSize: '0.82rem', textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--lcars-space-white)',
              }}>
                {tag.name}
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.68rem', color: 'var(--lcars-gray)',
              }}>
                {tag.project_count || 0}
              </span>
              <button
                onClick={() => handleDelete(tag.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--lcars-tomato)', fontSize: '0.7rem',
                  fontFamily: "'Antonio', sans-serif", textTransform: 'uppercase',
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '0.65rem' }}>New Tag</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tag name..." />
        </div>
        <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap', paddingBottom: '0.25rem' }}>
          {PRESET_COLORS.slice(0, 7).map(c => (
            <button
              key={c.hex} type="button"
              onClick={() => setNewColor(c.hex)}
              style={{
                width: '16px', height: '16px', borderRadius: 0,
                background: c.hex, border: 'none', cursor: 'pointer',
                outline: newColor === c.hex ? '1px solid var(--lcars-space-white)' : 'none',
              }}
            />
          ))}
        </div>
        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem' }}>
          <Plus size={14} /> Add
        </button>
      </form>
    </div>
  )
}


// ── LCARS Action Button ─────────────────────────────────────────

function LCARSActionButton({ onClick, color, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.375rem',
        padding: '0.375rem 0.75rem', border: 'none',
        background: 'rgba(102, 102, 136, 0.2)',
        color: 'var(--lcars-gray)',
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.75rem', fontWeight: 500,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        cursor: 'pointer', transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#000000' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102, 102, 136, 0.2)'; e.currentTarget.style.color = 'var(--lcars-gray)' }}
    >
      {label}
    </button>
  )
}
