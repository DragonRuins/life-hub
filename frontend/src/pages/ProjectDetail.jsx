/**
 * Project Detail Page
 *
 * Shows a single project's header info, tech stack, and tags,
 * with a tab bar for Kanban, Changelog, and Settings views.
 * Uses URL slug for routing (e.g., /projects/datacore).
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, Github, Globe, Calendar,
  Plus, X, Trash2, Check, GripVertical, ChevronUp, ChevronDown,
  Kanban, Clock, Settings, FolderKanban,
} from 'lucide-react'
import { projects } from '../api/client'
import useIsMobile from '../hooks/useIsMobile'
import KanbanBoard from '../components/KanbanBoard'
import TaskDetailModal from '../components/TaskDetailModal'
import ChangelogTimeline from '../components/ChangelogTimeline'

// ── Preset Color Palette (same as Projects.jsx) ──────────────────
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

const STATUS_BADGE_COLORS = {
  planning: { bg: 'rgba(137, 180, 250, 0.15)', color: 'var(--color-blue)' },
  active: { bg: 'rgba(166, 227, 161, 0.15)', color: 'var(--color-green)' },
  paused: { bg: 'rgba(249, 226, 175, 0.15)', color: 'var(--color-yellow)' },
  completed: { bg: 'rgba(166, 227, 161, 0.15)', color: 'var(--color-green)' },
  archived: { bg: 'rgba(166, 173, 200, 0.15)', color: 'var(--color-subtext-0)' },
}

const TECH_CATEGORIES = [
  { value: 'language', label: 'Language' },
  { value: 'framework', label: 'Framework' },
  { value: 'database', label: 'Database' },
  { value: 'tool', label: 'Tool' },
  { value: 'platform', label: 'Platform' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
]

const TABS = [
  { id: 'kanban', label: 'Kanban', icon: Kanban },
  { id: 'changelog', label: 'Changelog', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function ProjectDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Data state
  const [project, setProject] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [loading, setLoading] = useState(true)

  // Kanban state
  const [columns, setColumns] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)

  // Changelog state
  const [changelogEntries, setChangelogEntries] = useState([])

  // Tab state
  const [activeTab, setActiveTab] = useState('kanban')

  async function loadProject() {
    try {
      const data = await projects.get(slug)
      setProject(data)
    } catch (err) {
      console.error('Failed to load project:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadTags() {
    try {
      const data = await projects.tags.list()
      setAllTags(data)
    } catch (err) {
      console.error('Failed to load tags:', err)
    }
  }

  // Load columns with tasks for the kanban board
  const loadColumns = useCallback(async () => {
    try {
      const data = await projects.columns.list(slug)
      setColumns(data)
    } catch (err) {
      console.error('Failed to load columns:', err)
    }
  }, [slug])

  // Load changelog entries
  const loadChangelog = useCallback(async () => {
    try {
      const data = await projects.changelog.list(slug)
      setChangelogEntries(data)
    } catch (err) {
      console.error('Failed to load changelog:', err)
    }
  }, [slug])

  useEffect(() => {
    loadProject()
    loadTags()
    loadColumns()
    loadChangelog()
  }, [slug, loadColumns, loadChangelog])

  // ── Task Handlers (for kanban board and task detail modal) ──
  async function handleTaskSave(taskId, updates) {
    try {
      // If column_id changed, use the move endpoint
      if (updates.column_id !== undefined) {
        const { column_id, ...fieldUpdates } = updates
        // Update fields first
        if (Object.keys(fieldUpdates).length > 0) {
          await projects.tasks.update(taskId, fieldUpdates)
        }
        // Then move to new column
        await projects.tasks.move(taskId, { column_id })
      } else {
        await projects.tasks.update(taskId, updates)
      }
      await loadColumns()
      // Refresh the selected task if it's still open
      if (selectedTask && selectedTask.id === taskId) {
        const updated = await projects.tasks.get(taskId)
        setSelectedTask(updated)
      }
    } catch (err) {
      alert('Failed to save task: ' + err.message)
    }
  }

  async function handleTaskDelete(taskId) {
    try {
      await projects.tasks.delete(taskId)
      setSelectedTask(null)
      await loadColumns()
    } catch (err) {
      alert('Failed to delete task: ' + err.message)
    }
  }

  async function handleDeleteProject() {
    if (!confirm(`Delete "${project.name}" and all its data? This cannot be undone.`)) return
    try {
      await projects.delete(slug)
      navigate('/projects')
    } catch (err) {
      alert('Failed to delete project: ' + err.message)
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--color-subtext-0)' }}>Loading...</p>
  }

  if (!project) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: 'var(--color-subtext-0)' }}>Project not found.</p>
        <Link to="/projects" className="btn btn-ghost" style={{ marginTop: '1rem' }}>Back to Projects</Link>
      </div>
    )
  }

  const badge = STATUS_BADGE_COLORS[project.status] || STATUS_BADGE_COLORS.active

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Back link */}
        <Link to="/projects" style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          color: 'var(--color-subtext-0)', textDecoration: 'none', fontSize: '0.8rem',
          marginBottom: '0.75rem',
        }}>
          <ArrowLeft size={14} /> Projects
        </Link>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {project.color && (
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: project.color, flexShrink: 0,
            }} />
          )}
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            {project.name}
          </h1>
          <span style={{
            fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem',
            borderRadius: '9999px', textTransform: 'uppercase', letterSpacing: '0.04em',
            background: badge.bg, color: badge.color,
          }}>
            {project.status}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem', marginTop: '0.375rem', lineHeight: 1.5 }}>
            {project.description}
          </p>
        )}

        {/* Quick info row */}
        <div style={{
          display: 'flex', gap: '1rem', marginTop: '0.75rem',
          flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-subtext-0)',
        }}>
          {project.repo_url && (
            <a href={project.repo_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-blue)', textDecoration: 'none' }}>
              <Github size={14} />
              {project.repo_provider || 'Repository'}
              <ExternalLink size={10} />
            </a>
          )}
          {project.live_url && (
            <a href={project.live_url} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-green)', textDecoration: 'none' }}>
              <Globe size={14} />
              Live Site
              <ExternalLink size={10} />
            </a>
          )}
          {project.started_at && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Calendar size={14} />
              Started {new Date(project.started_at).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Tech stack badges */}
        {project.tech_stack && project.tech_stack.length > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            {project.tech_stack.map((ts) => (
              <span key={ts.id} style={{
                fontSize: '0.7rem', fontWeight: 500, padding: '0.15rem 0.5rem',
                borderRadius: '4px', background: 'var(--color-surface-1)',
                color: 'var(--color-text)',
              }}>
                {ts.name}{ts.version ? ` ${ts.version}` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Tag pills */}
        {project.tags && project.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
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
      </div>

      {/* ── Tab Bar ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '2px', marginBottom: '1.5rem',
        borderBottom: '2px solid var(--color-surface-0)',
      }}>
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--color-blue)' : 'var(--color-subtext-0)',
                background: 'none', border: 'none',
                borderBottom: isActive ? '2px solid var(--color-blue)' : '2px solid transparent',
                marginBottom: '-2px', cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
              }}
            >
              <Icon size={16} />
              {!isMobile && tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Content ───────────────────────────────────── */}
      {activeTab === 'kanban' && (
        columns.length > 0 ? (
          <KanbanBoard
            columns={columns}
            slug={slug}
            onTaskClick={(task) => setSelectedTask(task)}
            onReload={loadColumns}
          />
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Kanban size={40} style={{ color: 'var(--color-overlay-0)', marginBottom: '0.75rem' }} />
            <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.9rem' }}>
              No columns configured yet.
            </p>
            <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              Go to Settings tab to add kanban columns.
            </p>
          </div>
        )
      )}

      {activeTab === 'changelog' && (
        <ChangelogTimeline
          entries={changelogEntries}
          onAdd={async (data) => {
            await projects.changelog.create(slug, data)
            await loadChangelog()
          }}
          onUpdate={async (id, data) => {
            await projects.changelog.update(id, data)
            await loadChangelog()
          }}
          onDelete={async (id) => {
            await projects.changelog.delete(id)
            await loadChangelog()
          }}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsTab
          project={project}
          allTags={allTags}
          onUpdate={async (data) => {
            try {
              await projects.update(slug, data)
              await loadProject()
            } catch (err) {
              alert('Failed to update: ' + err.message)
            }
          }}
          onDelete={handleDeleteProject}
          onReloadProject={() => { loadProject(); loadColumns() }}
          onReloadTags={loadTags}
        />
      )}

      {/* ── Task Detail Modal ─────────────────────────── */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          columns={columns}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// ── Settings Tab ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function SettingsTab({ project, allTags, onUpdate, onDelete, onReloadProject, onReloadTags }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Project Info ─────────────────────────────── */}
      <ProjectInfoSection project={project} onUpdate={onUpdate} />

      {/* ── Tech Stack ───────────────────────────────── */}
      <TechStackSection project={project} onReload={onReloadProject} />

      {/* ── Tags ─────────────────────────────────────── */}
      <TagsSection project={project} allTags={allTags} onReload={onReloadProject} onReloadTags={onReloadTags} />

      {/* ── Kanban Columns ───────────────────────────── */}
      <ColumnsSection project={project} onReload={onReloadProject} />

      {/* ── Danger Zone ──────────────────────────────── */}
      <div className="card" style={{ border: '1px solid var(--color-red)', borderRadius: '8px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-red)', marginBottom: '0.75rem' }}>
          Danger Zone
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)', marginBottom: '0.75rem' }}>
          Deleting this project will permanently remove all tasks, columns, tech stack, changelog entries, and tag associations.
        </p>
        <button className="btn btn-danger" onClick={onDelete}>
          <Trash2 size={14} /> Delete Project
        </button>
      </div>
    </div>
  )
}


// ── Project Info Section ────────────────────────────────────────

function ProjectInfoSection({ project, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})

  function startEdit() {
    setForm({
      name: project.name,
      description: project.description || '',
      status: project.status,
      color: project.color || '#89b4fa',
      repo_url: project.repo_url || '',
      live_url: project.live_url || '',
      started_at: project.started_at || '',
    })
    setEditing(true)
  }

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSave() {
    await onUpdate(form)
    setEditing(false)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Project Info</h3>
        {!editing ? (
          <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={startEdit}>Edit</button>
        ) : (
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={handleSave}>Save</button>
          </div>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-grid-2col">
            <div>
              <label>Name</label>
              <input name="name" value={form.name} onChange={handleChange} />
            </div>
            <div>
              <label>Status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div>
            <label>Description</label>
            <textarea name="description" rows={2} value={form.description} onChange={handleChange} />
          </div>
          <div className="form-grid-2col">
            <div>
              <label>Repository URL</label>
              <input name="repo_url" value={form.repo_url} onChange={handleChange} />
            </div>
            <div>
              <label>Live URL</label>
              <input name="live_url" value={form.live_url} onChange={handleChange} />
            </div>
          </div>
          <div className="form-grid-2col">
            <div>
              <label>Started Date</label>
              <input name="started_at" type="date" value={form.started_at} onChange={handleChange} />
            </div>
            <div>
              <label>Color</label>
              <ColorPickerInline value={form.color} onChange={(c) => setForm({ ...form, color: c })} />
            </div>
          </div>
        </div>
      ) : (
        <div className="form-grid-2col" style={{ gap: '0.5rem' }}>
          <InfoRow label="Name" value={project.name} />
          <InfoRow label="Status" value={project.status} />
          <InfoRow label="Repository" value={project.repo_url} link />
          <InfoRow label="Live URL" value={project.live_url} link />
          <InfoRow label="Started" value={project.started_at ? new Date(project.started_at).toLocaleDateString() : 'Not set'} />
          <InfoRow label="Color" value={project.color} color />
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, link, color }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.125rem' }}>
        {label}
      </div>
      {color ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: value || 'var(--color-overlay-0)' }} />
          <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{value || 'None'}</span>
        </div>
      ) : link && value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" style={{
          fontSize: '0.85rem', color: 'var(--color-blue)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: '0.25rem',
        }}>
          {value} <ExternalLink size={10} />
        </a>
      ) : (
        <span style={{ fontSize: '0.85rem', color: value ? 'var(--color-text)' : 'var(--color-overlay-0)' }}>
          {value || 'Not set'}
        </span>
      )}
    </div>
  )
}


// ── Tech Stack Section ──────────────────────────────────────────

function TechStackSection({ project, onReload }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('framework')
  const [newVersion, setNewVersion] = useState('')

  async function handleAdd(e) {
    e.preventDefault()
    if (!newName.trim()) return
    try {
      await projects.techStack.add(project.slug, {
        name: newName.trim(),
        category: newCategory,
        version: newVersion.trim() || null,
      })
      setNewName('')
      setNewVersion('')
      setShowAdd(false)
      await onReload()
    } catch (err) {
      alert('Failed to add: ' + err.message)
    }
  }

  async function handleDelete(techId) {
    try {
      await projects.techStack.delete(techId)
      await onReload()
    } catch (err) {
      alert('Failed to remove: ' + err.message)
    }
  }

  // Group tech stack by category
  const grouped = {}
  for (const tech of (project.tech_stack || [])) {
    const cat = tech.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(tech)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Tech Stack</h3>
        <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? 'Cancel' : 'Add'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 120px' }}>
            <label style={{ fontSize: '0.7rem' }}>Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="React" required style={{ fontSize: '0.85rem' }} />
          </div>
          <div style={{ flex: '0 1 120px' }}>
            <label style={{ fontSize: '0.7rem' }}>Category</label>
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ fontSize: '0.85rem' }}>
              {TECH_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 80px' }}>
            <label style={{ fontSize: '0.7rem' }}>Version</label>
            <input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="19" style={{ fontSize: '0.85rem' }} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }}>Add</button>
        </form>
      )}

      {Object.keys(grouped).length === 0 ? (
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.8rem' }}>No technologies added yet.</p>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} style={{ marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-subtext-0)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
              {category}
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {items.map((tech) => (
                <span key={tech.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  fontSize: '0.75rem', padding: '0.2rem 0.5rem',
                  borderRadius: '4px', background: 'var(--color-surface-1)',
                }}>
                  {tech.name}{tech.version ? ` ${tech.version}` : ''}
                  <button
                    onClick={() => handleDelete(tech.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--color-overlay-0)', padding: '0 2px', display: 'flex',
                    }}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}


// ── Tags Section ────────────────────────────────────────────────

function TagsSection({ project, allTags, onReload, onReloadTags }) {
  const assignedIds = new Set((project.tags || []).map(t => t.id))
  const unassigned = allTags.filter(t => !assignedIds.has(t.id))

  async function handleAssign(tagId) {
    try {
      await projects.tags.assign(project.slug, tagId)
      await onReload()
    } catch (err) {
      alert('Failed to assign tag: ' + err.message)
    }
  }

  async function handleRemove(tagId) {
    try {
      await projects.tags.remove(project.slug, tagId)
      await onReload()
    } catch (err) {
      alert('Failed to remove tag: ' + err.message)
    }
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.75rem' }}>Tags</h3>

      {/* Assigned tags */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {(project.tags || []).map((tag) => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            fontSize: '0.75rem', fontWeight: 500, padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            background: tag.color ? `${tag.color}22` : 'var(--color-surface-1)',
            color: tag.color || 'var(--color-subtext-0)',
            border: `1px solid ${tag.color ? tag.color + '44' : 'var(--color-surface-2)'}`,
          }}>
            {tag.name}
            <button onClick={() => handleRemove(tag.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'inherit', padding: '0 2px', display: 'flex', opacity: 0.7,
            }}>
              <X size={10} />
            </button>
          </span>
        ))}
        {(project.tags || []).length === 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>No tags assigned.</span>
        )}
      </div>

      {/* Add tag dropdown */}
      {unassigned.length > 0 && (
        <div>
          <label style={{ fontSize: '0.7rem' }}>Add Tag</label>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {unassigned.map((tag) => (
              <button
                key={tag.id}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
                onClick={() => handleAssign(tag.id)}
              >
                <Plus size={10} /> {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ── Kanban Columns Section ──────────────────────────────────────

function ColumnsSection({ project, onReload }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newColumnName, setNewColumnName] = useState('')

  async function handleAddColumn(e) {
    e.preventDefault()
    if (!newColumnName.trim()) return
    try {
      await projects.columns.create(project.slug, { name: newColumnName.trim() })
      setNewColumnName('')
      setShowAdd(false)
      await onReload()
    } catch (err) {
      alert('Failed to add column: ' + err.message)
    }
  }

  async function handleUpdateColumn(columnId, data) {
    try {
      await projects.columns.update(columnId, data)
      await onReload()
    } catch (err) {
      alert('Failed to update column: ' + err.message)
    }
  }

  async function handleDeleteColumn(columnId, columnName, taskCount) {
    if (taskCount > 0) {
      alert(`Cannot delete "${columnName}" — it has ${taskCount} task(s). Move or delete them first.`)
      return
    }
    if (!confirm(`Delete column "${columnName}"?`)) return
    try {
      await projects.columns.delete(columnId)
      await onReload()
    } catch (err) {
      alert('Failed to delete column: ' + err.message)
    }
  }

  const columns = project.columns || []

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Kanban Columns</h3>
        <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? <X size={14} /> : <Plus size={14} />}
          {showAdd ? 'Cancel' : 'Add Column'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAddColumn} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            placeholder="Column name..."
            required
            style={{ flex: 1, fontSize: '0.85rem' }}
          />
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }}>Add</button>
        </form>
      )}

      {columns.length === 0 ? (
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.8rem' }}>No columns configured.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {columns.map((col) => (
            <ColumnRow
              key={col.id}
              column={col}
              onUpdate={handleUpdateColumn}
              onDelete={() => handleDeleteColumn(col.id, col.name, col.task_count)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ColumnRow({ column, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(column.name)
  const [wipLimit, setWipLimit] = useState(column.wip_limit || '')

  function handleSave() {
    onUpdate(column.id, {
      name: name.trim() || column.name,
      wip_limit: wipLimit ? parseInt(wipLimit) : null,
    })
    setEditing(false)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.375rem 0.5rem', background: 'var(--color-surface-0)',
      borderRadius: '6px',
    }}>
      {/* Color dot */}
      <div style={{
        width: '10px', height: '10px', borderRadius: '50%',
        background: column.color || 'var(--color-overlay-0)', flexShrink: 0,
      }} />

      {editing ? (
        <>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1, fontSize: '0.8rem' }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <input
            value={wipLimit}
            onChange={(e) => setWipLimit(e.target.value)}
            placeholder="WIP"
            type="number"
            style={{ width: '60px', fontSize: '0.8rem' }}
          />
          <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }} onClick={handleSave}>Save</button>
          <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }} onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: '0.85rem' }}>{column.name}</span>
          {column.is_done_column && (
            <span style={{
              fontSize: '0.6rem', fontWeight: 600, padding: '0.1rem 0.3rem',
              borderRadius: '4px', background: 'rgba(166, 227, 161, 0.15)', color: 'var(--color-green)',
            }}>DONE</span>
          )}
          {column.wip_limit && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-subtext-0)' }}>
              WIP: {column.wip_limit}
            </span>
          )}
          <span style={{ fontSize: '0.7rem', color: 'var(--color-overlay-0)' }}>
            {column.task_count} task{column.task_count !== 1 ? 's' : ''}
          </span>
          <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }} onClick={() => setEditing(true)}>Edit</button>
          <button className="btn btn-danger" style={{ fontSize: '0.7rem', padding: '0.15rem 0.3rem' }} onClick={onDelete}>
            <Trash2 size={10} />
          </button>
        </>
      )}
    </div>
  )
}


// ── Inline Color Picker (small version for forms) ───────────────

function ColorPickerInline({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.name}
          onClick={() => onChange(c.hex)}
          style={{
            width: '22px', height: '22px', borderRadius: '50%',
            background: c.hex, border: 'none', cursor: 'pointer',
            outline: value === c.hex ? '2px solid var(--color-text)' : '2px solid transparent',
            outlineOffset: '2px', transition: 'outline 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {value === c.hex && <Check size={10} style={{ color: '#1e1e2e' }} />}
        </button>
      ))}
    </div>
  )
}
