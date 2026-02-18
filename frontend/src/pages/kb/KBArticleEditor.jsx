/**
 * KBArticleEditor - Article creation and editing page.
 *
 * Uses the shared TipTapEditor component with a form wrapper for
 * title, category, status, source URL, and metadata fields.
 * Auto-saves content on a 1500ms debounce (same pattern as Notes).
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, CheckCircle, AlertCircle, Loader, FileText, X, Tag } from 'lucide-react'
import { kb } from '../../api/client'
import TipTapEditor from '../notes/TipTapEditor'

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'published', label: 'Published' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'outdated', label: 'Outdated' },
]

export default function KBArticleEditor({
  article,       // Existing article (null for new)
  categories,    // Category tree for picker
  onSave,        // (data) => Promise - create or update
  onCancel,      // () => void
  isNew,         // Boolean - creating new article
}) {
  const navigate = useNavigate()
  const [title, setTitle] = useState(article?.title || '')
  const [categoryId, setCategoryId] = useState(article?.category_id || '')
  const [status, setStatus] = useState(article?.status || 'draft')
  const [sourceUrl, setSourceUrl] = useState(article?.source_url || '')
  const [parentId, setParentId] = useState(article?.parent_id || '')
  const [contentJson, setContentJson] = useState(article?.content_json || null)
  const [saveStatus, setSaveStatus] = useState('saved') // saved, saving, unsaved, error
  const saveTimeout = useRef(null)
  const isMounted = useRef(true)
  const [allArticles, setAllArticles] = useState([])

  // Use a ref for onSave so auto-save always uses the latest callback,
  // avoiding stale closure issues with TipTap's captured onUpdate
  const onSaveRef = useRef(onSave)
  useEffect(() => { onSaveRef.current = onSave }, [onSave])

  // Skip auto-save on initial TipTap onUpdate (fires during content sync on mount)
  const initializedRef = useRef(false)
  useEffect(() => {
    const timer = setTimeout(() => { initializedRef.current = true }, 500)
    return () => clearTimeout(timer)
  }, [])

  // Tag state
  const [allTags, setAllTags] = useState([])
  const [selectedTagIds, setSelectedTagIds] = useState(
    () => (article?.tags || []).map(t => t.id)
  )
  const [newTagInput, setNewTagInput] = useState('')

  useEffect(() => {
    return () => { isMounted.current = false }
  }, [])

  // Load all available tags and articles (for parent selector)
  useEffect(() => {
    kb.tags.list().then(setAllTags).catch(() => {})
    kb.articles.list({ per_page: 0 }).then(data => setAllArticles(data.articles)).catch(() => {})
  }, [])

  // Flatten categories for a <select> dropdown
  const flatCategories = flattenCategories(categories)

  // Auto-save handler (debounced 1500ms, only for existing articles)
  const handleContentUpdate = useCallback((json) => {
    setContentJson(json)

    // Skip auto-save on initial TipTap mount (content sync fires onUpdate)
    if (!initializedRef.current) return

    if (!isNew && article) {
      setSaveStatus('unsaved')
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(async () => {
        try {
          setSaveStatus('saving')
          // Use ref to always get the latest onSave callback
          await onSaveRef.current({ content_json: json })
          if (isMounted.current) setSaveStatus('saved')
        } catch (err) {
          console.error('Auto-save failed:', err)
          if (isMounted.current) setSaveStatus('error')
        }
      }, 1500)
    }
  }, [isNew, article])

  // Manual save (Ctrl+S or button click)
  const handleManualSave = useCallback(async () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    const data = {
      title: title.trim() || 'Untitled',
      content_json: contentJson,
      category_id: categoryId || null,
      parent_id: parentId || null,
      status,
      source_url: sourceUrl || null,
      tag_ids: selectedTagIds,
    }

    try {
      setSaveStatus('saving')
      await onSaveRef.current(data)
      if (isMounted.current) setSaveStatus('saved')
    } catch (err) {
      console.error('Save failed:', err)
      if (isMounted.current) setSaveStatus('error')
    }
  }, [contentJson, title, categoryId, status, sourceUrl, parentId, selectedTagIds])

  // Handle Ctrl+S
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleManualSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleManualSave])

  const saveStatusIcon = {
    saved: <CheckCircle size={14} style={{ color: 'var(--color-green)' }} />,
    saving: <Loader size={14} style={{ color: 'var(--color-yellow)', animation: 'spin 1s linear infinite' }} />,
    unsaved: <AlertCircle size={14} style={{ color: 'var(--color-yellow)' }} />,
    error: <AlertCircle size={14} style={{ color: 'var(--color-red)' }} />,
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={onCancel}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            background: 'none',
            border: 'none',
            color: 'var(--color-blue)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            padding: 0,
          }}
        >
          <ArrowLeft size={16} /> {isNew ? 'Knowledge Base' : 'Back to Article'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Save status */}
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            color: 'var(--color-overlay-0)',
          }}>
            {saveStatusIcon[saveStatus]}
            {saveStatus === 'saved' && 'Saved'}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'unsaved' && 'Unsaved'}
            {saveStatus === 'error' && 'Error'}
          </span>

          {!isNew && article && (
            <button
              onClick={async () => {
                const name = prompt('Template name:', article.title)
                if (!name) return
                try {
                  await kb.templates.saveAs(article.slug, { template_name: name })
                  alert('Template saved!')
                } catch (err) {
                  alert('Failed to save template: ' + err.message)
                }
              }}
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
              title="Save as template"
            >
              <FileText size={14} />
            </button>
          )}

          <button
            onClick={handleManualSave}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
          >
            <Save size={14} /> {isNew ? 'Create Article' : 'Save'}
          </button>
        </div>
      </div>

      {/* Title input */}
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Article title..."
        style={{
          width: '100%',
          fontSize: '1.5rem',
          fontWeight: 700,
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--color-surface-0)',
          color: 'var(--color-text)',
          padding: '0.5rem 0',
          marginBottom: '1rem',
          outline: 'none',
        }}
      />

      {/* Metadata fields */}
      <div className="form-grid-3col" style={{ marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', display: 'block', marginBottom: '0.25rem' }}>
            Category
          </label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{
              width: '100%',
              padding: '0.375rem 0.5rem',
              fontSize: '0.85rem',
              background: 'var(--color-mantle)',
              border: '1px solid var(--color-surface-0)',
              borderRadius: '6px',
              color: 'var(--color-text)',
            }}
          >
            <option value="">No Category</option>
            {flatCategories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {'  '.repeat(cat.depth)}{cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', display: 'block', marginBottom: '0.25rem' }}>
            Status
          </label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{
              width: '100%',
              padding: '0.375rem 0.5rem',
              fontSize: '0.85rem',
              background: 'var(--color-mantle)',
              border: '1px solid var(--color-surface-0)',
              borderRadius: '6px',
              color: 'var(--color-text)',
            }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', display: 'block', marginBottom: '0.25rem' }}>
            Source URL
          </label>
          <input
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://..."
            style={{
              width: '100%',
              padding: '0.375rem 0.5rem',
              fontSize: '0.85rem',
              background: 'var(--color-mantle)',
              border: '1px solid var(--color-surface-0)',
              borderRadius: '6px',
              color: 'var(--color-text)',
            }}
          />
        </div>
      </div>

      {/* Parent article (sub-page of) */}
      {(() => {
        // Only show if article has no sub-pages (can't become a sub-page if it has children)
        const currentId = article?.id
        const eligibleParents = allArticles.filter(a =>
          a.id !== currentId && !a.parent_id
        )
        if (eligibleParents.length === 0 && !parentId) return null
        return (
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', display: 'block', marginBottom: '0.25rem' }}>
              Sub-page of
            </label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              style={{
                maxWidth: '300px',
                padding: '0.375rem 0.5rem',
                fontSize: '0.85rem',
                background: 'var(--color-mantle)',
                border: '1px solid var(--color-surface-0)',
                borderRadius: '6px',
                color: 'var(--color-text)',
              }}
            >
              <option value="">None (top-level article)</option>
              {eligibleParents.map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>
        )
      })()}

      {/* Tag input */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', display: 'block', marginBottom: '0.375rem' }}>
          Tags
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
          {selectedTagIds.map(id => {
            const tag = allTags.find(t => t.id === id)
            if (!tag) return null
            return (
              <span key={id} style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                background: tag.color ? `${tag.color}22` : 'var(--color-surface-0)',
                color: tag.color || 'var(--color-subtext-0)',
                padding: '0.2rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
              }}>
                {tag.name}
                <button
                  onClick={() => setSelectedTagIds(prev => prev.filter(i => i !== id))}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'inherit', padding: 0, display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            )
          })}
          {/* Add tag dropdown/input */}
          <div style={{ position: 'relative' }}>
            <input
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newTagInput.trim()) {
                  e.preventDefault()
                  const name = newTagInput.trim()
                  // Check if tag already exists
                  let tag = allTags.find(t => t.name.toLowerCase() === name.toLowerCase())
                  if (!tag) {
                    try {
                      tag = await kb.tags.create({ name })
                      setAllTags(prev => [...prev, tag])
                    } catch (err) {
                      return
                    }
                  }
                  if (!selectedTagIds.includes(tag.id)) {
                    setSelectedTagIds(prev => [...prev, tag.id])
                  }
                  setNewTagInput('')
                }
              }}
              placeholder="Add tag..."
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.78rem',
                background: 'var(--color-mantle)',
                border: '1px solid var(--color-surface-0)',
                borderRadius: '6px',
                color: 'var(--color-text)',
                width: '120px',
                outline: 'none',
              }}
            />
            {/* Tag suggestions dropdown */}
            {newTagInput.trim() && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 10,
                background: 'var(--color-base)',
                border: '1px solid var(--color-surface-0)',
                borderRadius: '6px',
                marginTop: '2px',
                maxHeight: '150px',
                overflow: 'auto',
                minWidth: '160px',
              }}>
                {allTags
                  .filter(t =>
                    t.name.toLowerCase().includes(newTagInput.toLowerCase()) &&
                    !selectedTagIds.includes(t.id)
                  )
                  .slice(0, 8)
                  .map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setSelectedTagIds(prev => [...prev, t.id])
                        setNewTagInput('')
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.375rem 0.5rem',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--color-text)',
                        fontSize: '0.78rem',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-0)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Tag size={12} style={{ color: t.color || 'var(--color-overlay-0)', marginRight: '0.375rem' }} />
                      {t.name}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TipTap editor */}
      <div className="card" style={{ padding: '1rem', minHeight: '400px' }}>
        <TipTapEditor
          content={contentJson}
          onUpdate={handleContentUpdate}
          editable={true}
          enableKBExtensions={true}
        />
      </div>
    </div>
  )
}

/**
 * Flatten a nested category tree into a flat list with depth indicators.
 * Used for the category <select> dropdown.
 */
function flattenCategories(categories, depth = 0) {
  const result = []
  for (const cat of (categories || [])) {
    result.push({ id: cat.id, name: cat.name, depth })
    if (cat.children && cat.children.length > 0) {
      result.push(...flattenCategories(cat.children, depth + 1))
    }
  }
  return result
}
