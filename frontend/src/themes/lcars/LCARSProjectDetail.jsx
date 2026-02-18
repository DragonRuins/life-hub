/**
 * LCARSProjectDetail.jsx - LCARS-native Project Detail Page
 *
 * Replaces the default ProjectDetail when LCARS theme is active.
 * LCARS treatment on the header, tab bar, kanban board, changelog
 * timeline, and settings panels. Reuses existing shared components
 * (KanbanBoard, ChangelogTimeline, TaskDetailModal) which get LCARS
 * styling via CSS overrides in lcars-projects.css.
 *
 * Route: /projects/:slug
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, Github, Globe, Calendar,
  Plus, X, Trash2, Check, Kanban, Clock, Settings,
} from 'lucide-react'
import { projects } from '../../api/client'
import useIsMobile from '../../hooks/useIsMobile'
import KanbanBoard from '../../components/KanbanBoard'
import TaskDetailModal from '../../components/TaskDetailModal'
import ChangelogTimeline from '../../components/ChangelogTimeline'
import LCARSPanel, { LCARSDataRow } from './LCARSPanel'
import LCARSModal from './LCARSModal'
import './lcars-projects.css'

// ── Preset Color Palette ─────────────────────────────────────────
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

const STATUS_COLORS = {
  planning: 'var(--lcars-ice)',
  active: 'var(--lcars-green)',
  paused: 'var(--lcars-sunflower)',
  completed: 'var(--lcars-green)',
  archived: 'var(--lcars-gray)',
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

export default function LCARSProjectDetail() {
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

  // ── Data Loading ──────────────────────────────────────────────
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

  const loadColumns = useCallback(async () => {
    try {
      const data = await projects.columns.list(slug)
      setColumns(data)
    } catch (err) {
      console.error('Failed to load columns:', err)
    }
  }, [slug])

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

  // ── Task Handlers ─────────────────────────────────────────────
  async function handleTaskSave(taskId, updates) {
    try {
      if (updates.column_id !== undefined) {
        const { column_id, ...fieldUpdates } = updates
        if (Object.keys(fieldUpdates).length > 0) {
          await projects.tasks.update(taskId, fieldUpdates)
        }
        await projects.tasks.move(taskId, { column_id })
      } else {
        await projects.tasks.update(taskId, updates)
      }
      await loadColumns()
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

  if (loading) return <LCARSLoadingSkeleton />

  if (!project) {
    return (
      <LCARSPanel title="Not Found" color="var(--lcars-tomato)">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.85rem', color: 'var(--lcars-gray)',
            marginBottom: '1rem',
          }}>
            Project not found in registry.
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/projects')}
          >
            Return to Registry
          </button>
        </div>
      </LCARSPanel>
    )
  }

  const statusColor = STATUS_COLORS[project.status] || 'var(--lcars-gray)'

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Back link */}
        <button
          onClick={() => navigate('/projects')}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            color: 'var(--lcars-ice)',
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.8rem', textTransform: 'uppercase',
            letterSpacing: '0.05em', marginBottom: '0.5rem',
          }}
        >
          <ArrowLeft size={14} />
          Project Registry
        </button>

        {/* Title row */}
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', gap: '1rem',
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              {/* Color indicator */}
              {project.color && (
                <div style={{
                  width: '10px', height: '10px',
                  background: project.color, flexShrink: 0,
                }} />
              )}
              <h1 style={{
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '1.5rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.1em',
                color: 'var(--lcars-space-white)',
              }}>
                {project.name}
              </h1>
              <span style={{
                padding: '0.1rem 0.4rem', background: statusColor,
                color: '#000000', fontFamily: "'Antonio', sans-serif",
                fontSize: '0.6rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                flexShrink: 0,
              }}>
                {project.status}
              </span>
            </div>

            {/* Description */}
            {project.description && (
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.78rem', color: 'var(--lcars-gray)',
                marginTop: '0.375rem', lineHeight: 1.5,
              }}>
                {project.description}
              </div>
            )}

            {/* Info row */}
            <div style={{
              display: 'flex', gap: '1rem', marginTop: '0.5rem',
              flexWrap: 'wrap',
            }}>
              {project.repo_url && (
                <a
                  href={project.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    color: 'var(--lcars-ice)', textDecoration: 'none',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                  }}
                >
                  <Github size={12} />
                  {project.repo_provider || 'Repository'}
                  <ExternalLink size={9} />
                </a>
              )}
              {project.live_url && (
                <a
                  href={project.live_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    color: 'var(--lcars-green)', textDecoration: 'none',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                  }}
                >
                  <Globe size={12} />
                  Live Site
                  <ExternalLink size={9} />
                </a>
              )}
              {project.started_at && (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  color: 'var(--lcars-gray)',
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem',
                }}>
                  <Calendar size={12} />
                  Started {new Date(project.started_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Tech stack badges */}
            {project.tech_stack?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {project.tech_stack.map((ts) => (
                  <span key={ts.id} style={{
                    fontSize: '0.62rem', padding: '0.05rem 0.4rem',
                    background: 'rgba(102, 102, 136, 0.15)',
                    color: 'var(--lcars-ice)',
                    fontFamily: "'Antonio', sans-serif",
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {ts.name}{ts.version ? ` ${ts.version}` : ''}
                  </span>
                ))}
              </div>
            )}

            {/* Tag pills */}
            {project.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap', marginTop: '0.375rem' }}>
                {project.tags.map((tag) => (
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
          </div>

          {/* Delete button */}
          <button
            onClick={handleDeleteProject}
            className="btn btn-danger"
            style={{ fontSize: '0.78rem', flexShrink: 0 }}
            title="Delete project"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* ── LCARS Tab Bar ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '3px', marginBottom: '1.5rem' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.4rem 1rem', border: 'none',
                background: isActive ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)',
                color: isActive ? '#000000' : 'var(--lcars-gray)',
                fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
                fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 400,
                textTransform: 'uppercase', letterSpacing: '0.06em',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(102, 102, 136, 0.4)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? 'var(--lcars-butterscotch)' : 'rgba(102, 102, 136, 0.25)' }}
            >
              <Icon size={14} />
              {!isMobile && tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Tab Content ───────────────────────────────────── */}

      {/* Kanban Tab */}
      {activeTab === 'kanban' && (
        columns.length > 0 ? (
          <div className="lcars-kanban">
            <KanbanBoard
              columns={columns}
              slug={slug}
              onTaskClick={(task) => setSelectedTask(task)}
              onReload={loadColumns}
            />
          </div>
        ) : (
          <LCARSPanel title="No Columns" color="var(--lcars-gray)">
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Kanban size={32} style={{ color: 'var(--lcars-gray)', marginBottom: '0.75rem' }} />
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.85rem', color: 'var(--lcars-gray)',
              }}>
                No columns configured.
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.75rem', color: 'var(--lcars-gray)',
                marginTop: '0.25rem', opacity: 0.6,
              }}>
                Go to Settings tab to add kanban columns.
              </div>
            </div>
          </LCARSPanel>
        )
      )}

      {/* Changelog Tab */}
      {activeTab === 'changelog' && (
        <div className="lcars-changelog">
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
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <LCARSSettingsTab
          project={project}
          allTags={allTags}
          slug={slug}
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
        <div className="lcars-task-modal">
          <TaskDetailModal
            task={selectedTask}
            columns={columns}
            onSave={handleTaskSave}
            onDelete={handleTaskDelete}
            onClose={() => setSelectedTask(null)}
          />
        </div>
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// ── LCARS Settings Tab ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

function LCARSSettingsTab({ project, allTags, slug, onUpdate, onDelete, onReloadProject, onReloadTags }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <LCARSProjectInfoSection project={project} onUpdate={onUpdate} />
      <LCARSTechStackSection project={project} onReload={onReloadProject} />
      <LCARSTagsSection project={project} allTags={allTags} onReload={onReloadProject} onReloadTags={onReloadTags} />
      <LCARSColumnsSection project={project} onReload={onReloadProject} />

      {/* Danger Zone */}
      <LCARSPanel title="Danger Zone" color="var(--lcars-tomato)">
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.78rem', color: 'var(--lcars-gray)',
          marginBottom: '0.75rem', lineHeight: 1.5,
        }}>
          Deleting this project will permanently remove all tasks, columns,
          tech stack, changelog entries, and tag associations.
        </div>
        <button className="btn btn-danger" onClick={onDelete}>
          <Trash2 size={14} /> Delete Project
        </button>
      </LCARSPanel>
    </div>
  )
}


// ── Project Info Section (LCARS) ────────────────────────────────

function LCARSProjectInfoSection({ project, onUpdate }) {
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
    <LCARSPanel title="Project Info" color="var(--lcars-butterscotch)">
      <div style={{
        display: 'flex', justifyContent: 'flex-end',
        marginBottom: '0.75rem',
      }}>
        {!editing ? (
          <LCARSTextButton label="Edit" onClick={startEdit} color="var(--lcars-ice)" />
        ) : (
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <LCARSTextButton label="Cancel" onClick={() => setEditing(false)} color="var(--lcars-gray)" />
            <LCARSTextButton label="Save" onClick={handleSave} color="var(--lcars-green)" />
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
              <LCARSColorPicker value={form.color} onChange={(c) => setForm({ ...form, color: c })} />
            </div>
          </div>
        </div>
      ) : (
        <div className="form-grid-2col" style={{ gap: '0.5rem' }}>
          <LCARSInfoField label="Name" value={project.name} />
          <LCARSInfoField label="Status" value={project.status} />
          <LCARSInfoField label="Repository" value={project.repo_url} link />
          <LCARSInfoField label="Live URL" value={project.live_url} link />
          <LCARSInfoField label="Started" value={project.started_at ? new Date(project.started_at).toLocaleDateString() : 'Not set'} />
          <LCARSInfoField label="Color" value={project.color} color />
        </div>
      )}
    </LCARSPanel>
  )
}


// ── Tech Stack Section (LCARS) ──────────────────────────────────

function LCARSTechStackSection({ project, onReload }) {
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
    <LCARSPanel title="Tech Stack" color="var(--lcars-ice)">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <LCARSTextButton
          label={showAdd ? 'Cancel' : 'Add'}
          onClick={() => setShowAdd(!showAdd)}
          color={showAdd ? 'var(--lcars-gray)' : 'var(--lcars-ice)'}
        />
      </div>

      {showAdd && (
        <form
          onSubmit={handleAdd}
          style={{
            display: 'flex', gap: '0.5rem', marginBottom: '0.75rem',
            flexWrap: 'wrap', alignItems: 'flex-end',
          }}
        >
          <div style={{ flex: '1 1 120px' }}>
            <label style={{ fontSize: '0.65rem' }}>Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="React" required />
          </div>
          <div style={{ flex: '0 1 120px' }}>
            <label style={{ fontSize: '0.65rem' }}>Category</label>
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {TECH_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div style={{ flex: '0 1 80px' }}>
            <label style={{ fontSize: '0.65rem' }}>Version</label>
            <input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="19" />
          </div>
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem' }}>Add</button>
        </form>
      )}

      {Object.keys(grouped).length === 0 ? (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8rem', color: 'var(--lcars-gray)',
        }}>
          No technologies added yet.
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category} style={{ marginBottom: '0.5rem' }}>
            <div style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.7rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--lcars-sunflower)', marginBottom: '0.25rem',
            }}>
              {category}
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
              {items.map((tech) => (
                <span key={tech.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                  fontSize: '0.72rem', padding: '0.15rem 0.4rem',
                  background: 'rgba(102, 102, 136, 0.12)',
                  color: 'var(--lcars-ice)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {tech.name}{tech.version ? ` ${tech.version}` : ''}
                  <button
                    onClick={() => handleDelete(tech.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--lcars-gray)', padding: '0 2px', display: 'flex',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-tomato)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </LCARSPanel>
  )
}


// ── Tags Section (LCARS) ────────────────────────────────────────

function LCARSTagsSection({ project, allTags, onReload, onReloadTags }) {
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
    <LCARSPanel title="Tags" color="var(--lcars-african-violet)">
      {/* Assigned tags */}
      <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {(project.tags || []).map((tag) => (
          <span key={tag.id} style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
            fontSize: '0.72rem', fontWeight: 500, padding: '0.15rem 0.4rem',
            background: `${tag.color || 'var(--lcars-african-violet)'}25`,
            color: tag.color || 'var(--lcars-african-violet)',
            fontFamily: "'Antonio', sans-serif",
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {tag.name}
            <button
              onClick={() => handleRemove(tag.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'inherit', padding: '0 2px', display: 'flex', opacity: 0.7,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
              <X size={10} />
            </button>
          </span>
        ))}
        {(project.tags || []).length === 0 && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem', color: 'var(--lcars-gray)',
          }}>
            No tags assigned.
          </span>
        )}
      </div>

      {/* Unassigned tags to add */}
      {unassigned.length > 0 && (
        <div>
          <div style={{
            fontFamily: "'Antonio', sans-serif",
            fontSize: '0.65rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.06em',
            color: 'var(--lcars-gray)', marginBottom: '0.25rem',
          }}>
            Add Tag
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {unassigned.map((tag) => (
              <button
                key={tag.id}
                onClick={() => handleAssign(tag.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.2rem',
                  padding: '0.15rem 0.4rem', border: 'none', cursor: 'pointer',
                  background: 'rgba(102, 102, 136, 0.15)',
                  color: 'var(--lcars-gray)',
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.68rem', textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = (tag.color || 'var(--lcars-african-violet)') + '40'
                  e.currentTarget.style.color = tag.color || 'var(--lcars-african-violet)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(102, 102, 136, 0.15)'
                  e.currentTarget.style.color = 'var(--lcars-gray)'
                }}
              >
                <Plus size={10} /> {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </LCARSPanel>
  )
}


// ── Kanban Columns Section (LCARS) ──────────────────────────────

function LCARSColumnsSection({ project, onReload }) {
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
    <LCARSPanel title="Kanban Columns" color="var(--lcars-sunflower)">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
        <LCARSTextButton
          label={showAdd ? 'Cancel' : 'Add Column'}
          onClick={() => setShowAdd(!showAdd)}
          color={showAdd ? 'var(--lcars-gray)' : 'var(--lcars-sunflower)'}
        />
      </div>

      {showAdd && (
        <form onSubmit={handleAddColumn} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input
            value={newColumnName}
            onChange={(e) => setNewColumnName(e.target.value)}
            placeholder="Column name..."
            required
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" style={{ fontSize: '0.78rem' }}>Add</button>
        </form>
      )}

      {columns.length === 0 ? (
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8rem', color: 'var(--lcars-gray)',
        }}>
          No columns configured.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {columns.map((col) => (
            <LCARSColumnRow
              key={col.id}
              column={col}
              onUpdate={handleUpdateColumn}
              onDelete={() => handleDeleteColumn(col.id, col.name, col.task_count)}
            />
          ))}
        </div>
      )}
    </LCARSPanel>
  )
}


function LCARSColumnRow({ column, onUpdate, onDelete }) {
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
      padding: '0.375rem 0.5rem',
      background: 'rgba(102, 102, 136, 0.06)',
      border: '1px solid rgba(102, 102, 136, 0.15)',
    }}>
      {/* Color indicator */}
      <div style={{
        width: '8px', height: '8px',
        background: column.color || 'var(--lcars-gray)', flexShrink: 0,
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
            style={{ width: '50px', fontSize: '0.8rem' }}
          />
          <LCARSTextButton label="Save" onClick={handleSave} color="var(--lcars-green)" />
          <LCARSTextButton label="Cancel" onClick={() => setEditing(false)} color="var(--lcars-gray)" />
        </>
      ) : (
        <>
          <span style={{
            flex: 1, fontFamily: "'Antonio', sans-serif",
            fontSize: '0.82rem', textTransform: 'uppercase',
            letterSpacing: '0.04em', color: 'var(--lcars-space-white)',
          }}>
            {column.name}
          </span>
          {column.is_done_column && (
            <span style={{
              fontSize: '0.55rem', fontWeight: 600, padding: '0.05rem 0.3rem',
              background: 'rgba(153, 153, 51, 0.25)', color: 'var(--lcars-green)',
              fontFamily: "'Antonio', sans-serif", textTransform: 'uppercase',
            }}>
              DONE
            </span>
          )}
          {column.wip_limit && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.68rem', color: 'var(--lcars-gray)',
            }}>
              WIP: {column.wip_limit}
            </span>
          )}
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.68rem', color: 'var(--lcars-gray)', opacity: 0.6,
          }}>
            {column.task_count} task{column.task_count !== 1 ? 's' : ''}
          </span>
          <LCARSTextButton label="Edit" onClick={() => setEditing(true)} color="var(--lcars-ice)" />
          <button
            onClick={onDelete}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--lcars-gray)', padding: '0.15rem', display: 'flex',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-tomato)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
          >
            <Trash2 size={12} />
          </button>
        </>
      )}
    </div>
  )
}


// ══════════════════════════════════════════════════════════════════
// ── Shared Sub-components ──────────────────────────────────────
// ══════════════════════════════════════════════════════════════════

/** LCARS-styled info field for read-only display */
function LCARSInfoField({ label, value, link, color }) {
  return (
    <div>
      <div style={{
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.65rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em',
        color: 'var(--lcars-gray)', marginBottom: '0.125rem',
      }}>
        {label}
      </div>
      {color ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ width: '12px', height: '12px', background: value || 'var(--lcars-gray)' }} />
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.8rem', color: 'var(--lcars-space-white)',
          }}>
            {value || 'None'}
          </span>
        </div>
      ) : link && value ? (
        <a href={value} target="_blank" rel="noopener noreferrer" style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8rem', color: 'var(--lcars-ice)', textDecoration: 'none',
          display: 'flex', alignItems: 'center', gap: '0.25rem',
        }}>
          {value} <ExternalLink size={10} />
        </a>
      ) : (
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.8rem',
          color: value && value !== 'Not set' ? 'var(--lcars-space-white)' : 'var(--lcars-gray)',
        }}>
          {value || 'Not set'}
        </span>
      )}
    </div>
  )
}


/** LCARS squared color picker */
function LCARSColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingTop: '0.25rem' }}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          title={c.name}
          onClick={() => onChange(c.hex)}
          style={{
            width: '20px', height: '20px', borderRadius: 0,
            background: c.hex, border: 'none', cursor: 'pointer',
            outline: value === c.hex ? '2px solid var(--lcars-space-white)' : '2px solid transparent',
            outlineOffset: '1px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {value === c.hex && <Check size={10} style={{ color: '#000' }} />}
        </button>
      ))}
    </div>
  )
}


/** LCARS text-style button (uppercase, Antonio font, no background) */
function LCARSTextButton({ label, onClick, color = 'var(--lcars-ice)' }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: "'Antonio', sans-serif",
        fontSize: '0.72rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        color, padding: '0.15rem 0.35rem',
        transition: 'filter 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.3)'}
      onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
    >
      {label}
    </button>
  )
}


/** LCARS loading skeleton */
function LCARSLoadingSkeleton() {
  return (
    <div style={{ maxWidth: '1200px' }}>
      <div style={{ height: '1rem', width: '120px', background: 'rgba(102, 102, 136, 0.15)', marginBottom: '0.5rem' }} />
      <div style={{ height: '1.5rem', width: '350px', background: 'rgba(102, 102, 136, 0.2)', marginBottom: '0.375rem' }} />
      <div style={{ height: '0.8rem', width: '250px', background: 'rgba(102, 102, 136, 0.1)', marginBottom: '1.5rem' }} />
      <div style={{ display: 'flex', gap: '3px', marginBottom: '1.5rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '32px', width: '100px', background: 'rgba(102, 102, 136, 0.15)' }} />
        ))}
      </div>
      <div style={{ height: '300px', background: 'rgba(102, 102, 136, 0.06)', border: '1px solid rgba(102, 102, 136, 0.15)' }} />
    </div>
  )
}
