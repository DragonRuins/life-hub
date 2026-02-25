/**
 * LCARSKnowledgeBase.jsx - LCARS Library Computer Access/Retrieval System
 *
 * Full LCARS immersion for the Knowledge Base module. The KB is literally
 * what LCARS stands for — this should feel like querying the Enterprise
 * computer. Uses gold (#FFAA00) as the primary module accent.
 *
 * Layout:
 *   - Left panel (230px): Classification Index (category tree)
 *   - Main content: Database Records list, Data Readout (article), or Editor
 *
 * LCARS Terminology:
 *   - Categories → Classification Index
 *   - Articles → Database Entries
 *   - Tags → Cross-References
 *   - TOC → Section Index
 *   - Backlinks → Reverse References
 *   - Status → Clearance Status
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extension-placeholder'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import { Image as ImageExt } from '@tiptap/extension-image'
import { Link as TipTapLink } from '@tiptap/extension-link'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { Highlight as HighlightExt } from '@tiptap/extension-highlight'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { common, createLowlight } from 'lowlight'
import {
  ArrowLeft, Plus, Edit3, Trash2, Save, FileText,
  ChevronRight, ChevronDown, Folder, FolderOpen,
  Clock, ExternalLink, FolderPlus, BookOpen, History,
  Tag, X, Link2, Bookmark, Search, Download, Upload,
} from 'lucide-react'
import useIsMobile from '../../hooks/useIsMobile'
import KBRevisionHistory from '../../pages/kb/KBRevisionHistory'
import KBTemplatePickerModal from '../../pages/kb/KBTemplatePickerModal'
import KBTableOfContents from '../../pages/kb/KBTableOfContents'
import { kb } from '../../api/client'
import { formatDate } from '../../utils/formatDate'
import LCARSPanel, { LCARSStat } from './LCARSPanel'
import CalloutBlock from '../../components/tiptap-extensions/CalloutBlock'
import { CollapsibleBlock, CollapsibleSummary, CollapsibleContent } from '../../components/tiptap-extensions/CollapsibleBlock'
import MermaidBlock from '../../components/tiptap-extensions/MermaidBlock'
import WikiLink from '../../components/tiptap-extensions/WikiLink'
import '../../components/tiptap-extensions/tiptap-kb-extensions.css'
import './lcars-kb.css'

const lowlight = createLowlight(common)

// LCARS status mapping - Star Trek terminology
const LCARS_STATUS = {
  draft: { label: 'PRELIMINARY', color: 'var(--lcars-gray)' },
  in_progress: { label: 'IN ANALYSIS', color: 'var(--lcars-butterscotch)' },
  published: { label: 'VERIFIED', color: 'var(--lcars-green)' },
  needs_review: { label: 'REVIEW REQUIRED', color: 'var(--lcars-tomato)' },
  outdated: { label: 'DECLASSIFIED', color: 'var(--lcars-ice)' },
}

export default function LCARSKnowledgeBase() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const isEditing = window.location.pathname.endsWith('/edit')
  const isNew = slug === 'new'
  const categoryId = searchParams.get('category') ? parseInt(searchParams.get('category')) : null

  // Data state
  const [categories, setCategories] = useState([])
  const [articles, setArticles] = useState([])
  const [currentArticle, setCurrentArticle] = useState(null)
  const [stats, setStats] = useState(null)
  const [tags, setTags] = useState([])
  const [selectedTagId, setSelectedTagId] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [mobilePanel, setMobilePanel] = useState('list') // 'sidebar' | 'list' | 'article'

  // Editor state
  const [editTitle, setEditTitle] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  const [editStatus, setEditStatus] = useState('draft')
  const [editSourceUrl, setEditSourceUrl] = useState('')
  const [editContent, setEditContent] = useState(null)
  const [editTagIds, setEditTagIds] = useState([])
  const [editParentId, setEditParentId] = useState('')

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const searchTimeoutRef = useRef(null)

  // New category form
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const importRef = useRef(null)

  useEffect(() => { loadInitialData() }, [])
  useEffect(() => { setCurrentPage(1) }, [categoryId, selectedTagId, selectedStatus])
  useEffect(() => { loadArticles() }, [categoryId, selectedTagId, selectedStatus, currentPage])
  useEffect(() => {
    if (slug && slug !== 'new') {
      loadArticle(slug)
      if (isMobile) setMobilePanel('article')
    } else {
      setCurrentArticle(null)
    }
  }, [slug])

  // Populate editor fields when editing
  useEffect(() => {
    if (currentArticle && isEditing) {
      setEditTitle(currentArticle.title)
      setEditCategoryId(currentArticle.category_id || '')
      setEditStatus(currentArticle.status)
      setEditSourceUrl(currentArticle.source_url || '')
      setEditContent(currentArticle.content_json)
      setEditTagIds((currentArticle.tags || []).map(t => t.id))
      setEditParentId(currentArticle.parent_id || '')
    } else if (isNew) {
      setEditTitle('')
      setEditCategoryId(categoryId || '')
      setEditStatus('draft')
      setEditSourceUrl('')
      setEditContent(null)
      setEditTagIds([])
      setEditParentId('')
    }
  }, [currentArticle, isEditing, isNew])

  async function loadInitialData() {
    try {
      const [cats, st, tgs] = await Promise.all([
        kb.categories.list(),
        kb.stats(),
        kb.tags.list().catch(() => []),
      ])
      setCategories(cats)
      setStats(st)
      setTags(tgs)
    } catch (err) {
      console.error('Failed to load KB data:', err)
    } finally {
      setLoading(false)
    }
  }

  async function loadArticles() {
    try {
      const params = { page: currentPage, per_page: 30 }
      if (categoryId) params.category_id = categoryId
      if (selectedTagId) params.tag_id = selectedTagId
      if (selectedStatus) params.status = selectedStatus
      const data = await kb.articles.list(params)
      setArticles(data.articles)
      setTotalPages(data.total_pages)
    } catch (err) {
      console.error('Failed to load articles:', err)
    }
  }

  async function loadArticle(articleSlug) {
    try {
      setCurrentArticle(await kb.articles.get(articleSlug))
      kb.articles.recordView(articleSlug).catch(() => {})
    } catch (err) {
      console.error('Failed to load article:', err)
      setCurrentArticle(null)
    }
  }

  function handleSearchChange(query) {
    setSearchQuery(query)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await kb.search({ q: query })
        setSearchResults(data.results)
      } catch (err) {
        setSearchResults([])
      }
    }, 300)
  }

  async function handleCreateCategory(e) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name) return
    try {
      await kb.categories.create({ name })
      setCategories(await kb.categories.list())
      setNewCategoryName('')
      setShowNewCategory(false)
    } catch (err) {
      alert('Failed to create category: ' + err.message)
    }
  }

  async function handleSaveArticle() {
    const data = {
      title: editTitle.trim() || 'Untitled',
      content_json: editContent,
      category_id: editCategoryId || null,
      parent_id: editParentId || null,
      status: editStatus,
      source_url: editSourceUrl || null,
      tag_ids: editTagIds,
    }
    try {
      if (isNew) {
        const created = await kb.articles.create(data)
        const [st, cats] = await Promise.all([kb.stats(), kb.categories.list()])
        setStats(st)
        setCategories(cats)
        navigate(`/kb/${created.slug}`)
      } else if (currentArticle) {
        const updated = await kb.articles.update(currentArticle.slug, data)
        setCurrentArticle(updated)
        if (updated.slug !== currentArticle.slug) {
          navigate(`/kb/${updated.slug}`, { replace: true })
        } else {
          navigate(`/kb/${updated.slug}`)
        }
      }
    } catch (err) {
      alert('Failed to save: ' + err.message)
    }
  }

  async function handleDeleteArticle() {
    if (!currentArticle) return
    if (!confirm(`Delete "${currentArticle.title}"? This action is irreversible.`)) return
    try {
      await kb.articles.delete(currentArticle.slug)
      setCurrentArticle(null)
      const [st, cats] = await Promise.all([kb.stats(), kb.categories.list()])
      setStats(st)
      setCategories(cats)
      await loadArticles()
      navigate('/kb')
    } catch (err) {
      alert('Failed to delete: ' + err.message)
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const article = await kb.importArticle(file)
      const [st, cats] = await Promise.all([kb.stats(), kb.categories.list()])
      setStats(st)
      setCategories(cats)
      navigate(`/kb/${article.slug}`)
    } catch (err) {
      alert('Import failed: ' + err.message)
    }
    e.target.value = ''
  }

  // Flatten categories for select
  const flatCategories = flattenCategories(categories)

  // ── Render ──────────────────────────────────────────────────────

  // If viewing/editing an article, show full-width content
  if (slug) {
    if (isNew || isEditing) {
      return (
        <LCARSEditorView
          title={editTitle}
          setTitle={setEditTitle}
          categoryId={editCategoryId}
          setCategoryId={setEditCategoryId}
          status={editStatus}
          setStatus={setEditStatus}
          sourceUrl={editSourceUrl}
          setSourceUrl={setEditSourceUrl}
          content={editContent}
          setContent={setEditContent}
          categories={flatCategories}
          onSave={handleSaveArticle}
          onCancel={() => navigate(isNew ? '/kb' : `/kb/${slug}`)}
          isNew={isNew}
          tagIds={editTagIds}
          setTagIds={setEditTagIds}
          parentId={editParentId}
          setParentId={setEditParentId}
          articleId={currentArticle?.id}
        />
      )
    }

    if (currentArticle) {
      return (
        <LCARSArticleView
          article={currentArticle}
          onEdit={() => navigate(`/kb/${slug}/edit`)}
          onDelete={handleDeleteArticle}
          onBack={() => navigate('/kb')}
          onRestore={(restoredArticle) => {
            setCurrentArticle(restoredArticle)
            if (restoredArticle.slug !== slug) {
              navigate(`/kb/${restoredArticle.slug}`, { replace: true })
            }
          }}
        />
      )
    }

    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--lcars-gray)' }}>
        <span style={{ fontFamily: "'Antonio', sans-serif", textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Loading database entry...
        </span>
      </div>
    )
  }

  // Main view: sidebar + article list / home dashboard
  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <h1 style={{
            margin: 0,
            fontFamily: "'Antonio', sans-serif",
            fontSize: '1.5rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--lcars-space-white)',
          }}>
            Library Computer
          </h1>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            color: 'var(--lcars-gold)',
            marginTop: '0.125rem',
          }}>
            LCARS Database Access — {stats?.total || 0} entries indexed
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <input
            ref={importRef}
            type="file"
            accept=".md,.markdown,.txt"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
          <button
            onClick={() => importRef.current?.click()}
            style={{
              background: 'rgba(102,102,136,0.2)',
              border: 'none',
              borderRadius: '999px',
              padding: '0.4rem 0.75rem',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.25rem',
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.78rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--lcars-gray)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--lcars-gold)'; e.currentTarget.style.color = 'var(--lcars-text-on-color)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,102,136,0.2)'; e.currentTarget.style.color = 'var(--lcars-gray)' }}
            title="Import Markdown"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={() => setShowTemplatePicker(true)}
            className="btn btn-primary"
            style={{ fontSize: '0.8rem' }}
          >
            <Plus size={14} /> New Entry
          </button>
        </div>
      </div>

      {/* Mobile panel toggle */}
      {isMobile && (
        <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem' }}>
          {['sidebar', 'list'].map(panel => (
            <button
              className="lcars-element button rounded auto"
              key={panel}
              onClick={() => setMobilePanel(panel)}
              style={{
                background: mobilePanel === panel ? 'var(--lcars-gold)' : 'rgba(102,102,136,0.2)',
                border: 'none',
                height: 'auto',
                padding: '0.35rem 0.75rem',
                fontSize: '0.72rem',
                color: mobilePanel === panel ? 'var(--lcars-text-on-color)' : 'var(--lcars-gray)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {panel === 'sidebar' ? 'Classifications' : 'Entries'}
            </button>
          ))}
        </div>
      )}

      {/* Two-column layout */}
      <div style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: '230px 1fr',
        gap: '0.75rem',
      }}>
        {/* Left panel: Classification Index */}
        {(!isMobile || mobilePanel === 'sidebar') && (
          <LCARSPanel
            title="Classification Index"
            color="var(--lcars-gold)"
            noPadding
            style={{ alignSelf: 'start' }}
            headerRight={
              <button
                onClick={() => setShowNewCategory(!showNewCategory)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--lcars-text-on-color)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  display: 'flex',
                }}
              >
                <FolderPlus size={14} />
              </button>
            }
          >
            {showNewCategory && (
              <form onSubmit={handleCreateCategory} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(102,102,136,0.15)' }}>
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="Classification name..."
                  style={{
                    width: '100%',
                    padding: '0.3rem 0.5rem',
                    fontSize: '0.78rem',
                    background: '#000',
                    border: '1px solid var(--lcars-gray)',
                    borderRadius: '2px',
                    color: 'var(--lcars-space-white)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  onKeyDown={e => { if (e.key === 'Escape') setShowNewCategory(false) }}
                />
              </form>
            )}

            {/* Search bar */}
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(102,102,136,0.15)' }}>
              <input
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Search database..."
                style={{
                  width: '100%',
                  padding: '0.3rem 0.5rem',
                  fontSize: '0.75rem',
                  background: '#000',
                  border: '1px solid var(--lcars-gray)',
                  borderRadius: '2px',
                  color: 'var(--lcars-space-white)',
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: 'none',
                }}
              />
            </div>

            {/* All entries link */}
            <div
              onClick={() => navigate('/kb')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.4rem 0.75rem',
                cursor: 'pointer',
                borderLeft: !categoryId ? '3px solid var(--lcars-gold)' : '3px solid transparent',
                background: !categoryId ? 'rgba(255, 170, 0, 0.08)' : 'transparent',
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.78rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: !categoryId ? 'var(--lcars-gold)' : 'var(--lcars-gray)',
              }}
            >
              <BookOpen size={13} />
              All Entries
              <span style={{
                marginLeft: 'auto',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.68rem',
                color: 'var(--lcars-gray)',
              }}>
                {stats?.total || 0}
              </span>
            </div>

            {/* Category tree */}
            <LCARSCategoryTree
              categories={categories}
              selectedId={categoryId}
              onSelect={(id) => navigate(id ? `/kb?category=${id}` : '/kb')}
              depth={0}
            />

            {/* Cross-References (tags) */}
            {tags.length > 0 && (
              <div style={{
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(102,102,136,0.15)',
              }}>
                <div style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--lcars-gold)',
                  padding: '0 0.75rem',
                  marginBottom: '0.375rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}>
                  <Tag size={11} /> Cross-References
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', padding: '0 0.75rem 0.5rem' }}>
                  {tags.map(tag => {
                    const isActive = selectedTagId === tag.id
                    return (
                      <button
                        className="lcars-element button rounded auto"
                        key={tag.id}
                        onClick={() => setSelectedTagId(isActive ? null : tag.id)}
                        style={{
                          background: isActive
                            ? 'rgba(255, 170, 0, 0.15)'
                            : 'rgba(102,102,136,0.1)',
                          color: isActive
                            ? 'var(--lcars-gold)'
                            : 'var(--lcars-gray)',
                          border: isActive
                            ? '1px solid var(--lcars-gold)'
                            : '1px solid transparent',
                          height: 'auto',
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.68rem',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tag.name}
                        {tag.article_count > 0 && (
                          <span style={{ marginLeft: '0.25rem', opacity: 0.7 }}>{tag.article_count}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Clearance Status filter */}
            <div style={{
              marginTop: '0.5rem',
              paddingTop: '0.5rem',
              borderTop: '1px solid rgba(102,102,136,0.15)',
            }}>
              <div style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.68rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--lcars-gold)',
                padding: '0 0.75rem',
                marginBottom: '0.375rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}>
                Clearance Status
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', padding: '0 0.5rem 0.5rem' }}>
                {Object.entries(LCARS_STATUS).map(([value, st]) => {
                  const isActive = selectedStatus === value
                  return (
                    <button
                      key={value}
                      onClick={() => setSelectedStatus(isActive ? null : value)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.25rem 0.375rem',
                        background: isActive ? 'rgba(255, 170, 0, 0.08)' : 'transparent',
                        border: 'none',
                        borderLeft: isActive ? `2px solid ${st.color}` : '2px solid transparent',
                        cursor: 'pointer',
                        fontFamily: "'Antonio', sans-serif",
                        fontSize: '0.68rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: isActive ? st.color : 'var(--lcars-gray)',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: st.color, flexShrink: 0,
                      }} />
                      {st.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </LCARSPanel>
        )}

        {/* Right panel: content */}
        {(!isMobile || mobilePanel === 'list') && (
          <div>
            {searchResults !== null ? (
              <LCARSArticleList articles={searchResults} categoryId={null} searchQuery={searchQuery} />
            ) : !categoryId ? (
              <>
                <LCARSHomeDashboard stats={stats} recentArticles={stats?.recent || []} />
                {/* On mobile, also show browsable article list below the dashboard */}
                {articles.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <LCARSArticleList
                      articles={articles}
                      categoryId={null}
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </div>
                )}
              </>
            ) : (
              <LCARSArticleList
                articles={articles}
                categoryId={categoryId}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        )}
      </div>

      {/* Template picker modal */}
      {showTemplatePicker && (
        <KBTemplatePickerModal
          onSelect={(article) => {
            setShowTemplatePicker(false)
            navigate(`/kb/${article.slug}/edit`)
          }}
          onBlank={() => {
            setShowTemplatePicker(false)
            navigate('/kb/new')
          }}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
    </div>
  )
}


// ── LCARS Category Tree ───────────────────────────────────────────

function LCARSCategoryTree({ categories, selectedId, onSelect, depth }) {
  return (
    <div>
      {categories.map(cat => (
        <LCARSCategoryNode key={cat.id} category={cat} selectedId={selectedId} onSelect={onSelect} depth={depth} />
      ))}
    </div>
  )
}

function LCARSCategoryNode({ category, selectedId, onSelect, depth }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isSelected = selectedId === category.id
  const hasChildren = category.children && category.children.length > 0

  return (
    <div>
      <div
        onClick={() => onSelect(category.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.35rem 0.75rem',
          paddingLeft: `${depth * 0.75 + 0.75}rem`,
          cursor: 'pointer',
          borderLeft: isSelected ? '3px solid var(--lcars-gold)' : '3px solid transparent',
          background: isSelected ? 'rgba(255, 170, 0, 0.08)' : 'transparent',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.76rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: isSelected ? 'var(--lcars-gold)' : 'var(--lcars-gray)',
        }}
      >
        {hasChildren ? (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        ) : (
          <span style={{ width: 12 }} />
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {category.name}
        </span>
        {category.article_count > 0 && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.65rem',
            color: 'var(--lcars-gray)',
          }}>
            {category.article_count}
          </span>
        )}
      </div>
      {expanded && hasChildren && (
        <LCARSCategoryTree categories={category.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
      )}
    </div>
  )
}


// ── LCARS Home Dashboard ──────────────────────────────────────────

function LCARSHomeDashboard({ stats, recentArticles }) {
  const [recentViews, setRecentViews] = useState([])
  const [bookmarks, setBookmarks] = useState([])

  useEffect(() => {
    kb.recentViews(10).then(setRecentViews).catch(() => {})
    kb.bookmarks.list().then(setBookmarks).catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Stats panel */}
      <LCARSPanel title="Database Metrics" color="var(--lcars-gold)">
        <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap' }}>
          <LCARSStat label="Total Entries" value={stats.total} color="var(--lcars-gold)" />
          <LCARSStat label="Verified" value={stats.by_status?.published || 0} color="var(--lcars-green)" />
          <LCARSStat label="Preliminary" value={stats.by_status?.draft || 0} color="var(--lcars-gray)" />
          <LCARSStat label="Classifications" value={stats.categories_count} color="var(--lcars-ice)" />
        </div>
      </LCARSPanel>

      {/* Recent access log */}
      <LCARSPanel title="Recent Access Log" color="var(--lcars-gold)">
        <LCARSDashboardArticleList articles={recentArticles} emptyText="No database entries recorded. Create first entry to begin." />
      </LCARSPanel>

      {/* Bookmarked entries */}
      {bookmarks.length > 0 && (
        <LCARSPanel title="Bookmarked Entries" color="var(--lcars-gold)">
          <LCARSDashboardArticleList articles={bookmarks} />
        </LCARSPanel>
      )}

      {/* Recently accessed */}
      {recentViews.length > 0 && (
        <LCARSPanel title="Recently Accessed" color="var(--lcars-gold)">
          <LCARSDashboardArticleList articles={recentViews} />
        </LCARSPanel>
      )}
    </div>
  )
}

/** Shared LCARS article list used by dashboard panels. */
function LCARSDashboardArticleList({ articles, emptyText }) {
  if (!articles || articles.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '1.5rem',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.82rem',
        color: 'var(--lcars-gray)',
      }}>
        {emptyText || 'No entries.'}
      </div>
    )
  }

  return (
    <div>
      {articles.map(article => {
        const st = LCARS_STATUS[article.status] || LCARS_STATUS.draft
        return (
          <Link
            key={article.id}
            to={`/kb/${article.slug}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.5rem',
              borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
              textDecoration: 'none',
              gap: '0.75rem',
            }}
          >
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.82rem',
              color: 'var(--lcars-space-white)',
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {article.title}
            </span>
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.6rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--lcars-text-on-color)',
              background: st.color,
              padding: '0.1rem 0.4rem',
              borderRadius: '999px',
              whiteSpace: 'nowrap',
            }}>
              {st.label}
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.68rem',
              color: 'var(--lcars-gray)',
              whiteSpace: 'nowrap',
            }}>
              {article.updated_at ? formatDate(article.updated_at) : ''}
            </span>
          </Link>
        )
      })}
    </div>
  )
}


// ── LCARS Article List ────────────────────────────────────────────

function LCARSArticleList({ articles, categoryId, searchQuery = '', currentPage = 1, totalPages = 1, onPageChange }) {
  const navigate = useNavigate()
  const panelTitle = searchQuery
    ? `Search Results — ${articles.length} match${articles.length !== 1 ? 'es' : ''}`
    : 'Database Records'

  return (
    <LCARSPanel title={panelTitle} color="var(--lcars-gold)" noPadding>
      {articles.length > 0 ? (
        <div>
          {articles.map(article => {
            const st = LCARS_STATUS[article.status] || LCARS_STATUS.draft
            const preview = article.content_text
              ? article.content_text.substring(0, 100) + (article.content_text.length > 100 ? '...' : '')
              : ''
            return (
              <Link
                key={article.id}
                to={`/kb/${article.slug}`}
                style={{
                  display: 'block',
                  padding: '0.75rem 1rem',
                  borderBottom: '1px solid rgba(102, 102, 136, 0.15)',
                  textDecoration: 'none',
                  borderLeft: '4px solid var(--lcars-gold)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 170, 0, 0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--lcars-space-white)',
                  }}>
                    {article.title}
                  </span>
                  <span style={{
                    fontFamily: "'Antonio', sans-serif",
                    fontSize: '0.58rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--lcars-text-on-color)',
                    background: st.color,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap',
                  }}>
                    {st.label}
                  </span>
                </div>
                {preview && (
                  <p style={{
                    margin: '0.25rem 0 0',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.72rem',
                    color: 'var(--lcars-gray)',
                    lineHeight: 1.4,
                  }}>
                    {preview}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          color: 'var(--lcars-gray)',
        }}>
          No entries found in this classification.
          <div style={{ marginTop: '0.75rem' }}>
            <Link to="/kb/new" className="btn btn-primary" style={{ fontSize: '0.78rem', textDecoration: 'none' }}>
              <Plus size={14} /> Create Entry
            </Link>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          padding: '0.75rem',
          borderTop: '1px solid rgba(102,102,136,0.15)',
        }}>
          <button
            className="lcars-element button rounded auto"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            style={{
              background: currentPage <= 1 ? 'rgba(102,102,136,0.1)' : 'rgba(255,170,0,0.15)',
              border: 'none',
              height: 'auto',
              padding: '0.3rem 0.75rem',
              fontSize: '0.72rem',
              color: currentPage <= 1 ? 'var(--lcars-gray)' : 'var(--lcars-gold)',
              opacity: currentPage <= 1 ? 0.5 : 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Prev
          </button>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.72rem',
            color: 'var(--lcars-gray)',
          }}>
            {currentPage} / {totalPages}
          </span>
          <button
            className="lcars-element button rounded auto"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            style={{
              background: currentPage >= totalPages ? 'rgba(102,102,136,0.1)' : 'rgba(255,170,0,0.15)',
              border: 'none',
              height: 'auto',
              padding: '0.3rem 0.75rem',
              fontSize: '0.72rem',
              color: currentPage >= totalPages ? 'var(--lcars-gray)' : 'var(--lcars-gold)',
              opacity: currentPage >= totalPages ? 0.5 : 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Next
          </button>
        </div>
      )}
    </LCARSPanel>
  )
}


// ── LCARS Article View ────────────────────────────────────────────

function LCARSArticleView({ article, onEdit, onDelete, onBack, onRestore }) {
  const st = LCARS_STATUS[article.status] || LCARS_STATUS.draft
  const [showRevisions, setShowRevisions] = useState(false)
  const [backlinks, setBacklinks] = useState([])
  const [subPages, setSubPages] = useState([])
  const [isBookmarked, setIsBookmarked] = useState(false)
  const contentRef = useRef(null)
  const isMobile = useIsMobile()

  // Load backlinks, sub-pages, and bookmark state
  useEffect(() => {
    if (article?.slug) {
      kb.articles.backlinks(article.slug).then(setBacklinks).catch(() => setBacklinks([]))
      kb.articles.subPages(article.slug).then(setSubPages).catch(() => setSubPages([]))
      kb.bookmarks.list()
        .then(bms => setIsBookmarked(bms.some(b => b.id === article.id)))
        .catch(() => {})
    }
  }, [article?.slug])

  async function handleToggleBookmark() {
    try {
      const result = await kb.articles.toggleBookmark(article.slug)
      setIsBookmarked(result.bookmarked)
    } catch (err) {
      console.error('Failed to toggle bookmark:', err)
    }
  }

  async function handleExport() {
    try {
      const response = await kb.exportArticle(article.slug)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${article.slug}.md`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export:', err)
    }
  }

  // Read-only TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: false }),
      TableRow, TableHeader, TableCell,
      ImageExt.configure({ inline: false, allowBase64: false }),
      TipTapLink.configure({ openOnClick: true }),
      Underline, HighlightExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList, TaskItem.configure({ nested: true }),
      CalloutBlock,
      CollapsibleBlock, CollapsibleSummary, CollapsibleContent,
      MermaidBlock,
      WikiLink,
    ],
    content: article.content_json || null,
    editable: false,
  }, [article.slug])

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Back nav */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--lcars-ice)',
          fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
          textTransform: 'uppercase', letterSpacing: '0.05em',
          padding: 0, marginBottom: '0.75rem',
        }}
      >
        <ArrowLeft size={14} /> Library Computer
      </button>

      {/* Parent article link (for sub-entries) */}
      {article.parent_article && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          fontFamily: "'Antonio', sans-serif", fontSize: '0.72rem',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--lcars-gray)', marginBottom: '0.5rem',
        }}>
          <FileText size={12} />
          <span>Sub-Entry of</span>
          <Link
            to={`/kb/${article.parent_article.slug}`}
            style={{ color: 'var(--lcars-gold)', textDecoration: 'none' }}
          >
            {article.parent_article.title}
          </Link>
        </div>
      )}

      {/* Breadcrumb */}
      {article.breadcrumb && article.breadcrumb.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.375rem',
          fontFamily: "'Antonio', sans-serif", fontSize: '0.72rem',
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: 'var(--lcars-gray)', marginBottom: '0.75rem',
        }}>
          {article.breadcrumb.map((crumb, i) => (
            <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {i > 0 && <span style={{ color: 'var(--lcars-gold)' }}>&gt;</span>}
              <Link
                to={`/kb?category=${crumb.id}`}
                style={{ color: 'var(--lcars-gray)', textDecoration: 'none' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--lcars-gold)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--lcars-gray)'}
              >
                {crumb.name}
              </Link>
            </span>
          ))}
        </div>
      )}

      {/* Article header panel */}
      <LCARSPanel title="Data Readout" color="var(--lcars-gold)" style={{ marginBottom: '0.75rem' }}>
        <div className="lcars-kb-scanner">
          <h1 style={{
            margin: 0,
            fontFamily: "'Antonio', sans-serif",
            fontSize: '1.4rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--lcars-space-white)',
          }}>
            {article.title}
          </h1>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.625rem' }}>
              <button
                onClick={handleToggleBookmark}
                style={{
                  background: isBookmarked ? 'rgba(255, 170, 0, 0.2)' : 'rgba(102,102,136,0.2)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.3rem 0.5rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  color: isBookmarked ? 'var(--lcars-gold)' : 'var(--lcars-gray)',
                }}
                onMouseEnter={e => { if (!isBookmarked) { e.currentTarget.style.background = 'var(--lcars-gold)'; e.currentTarget.style.color = 'var(--lcars-text-on-color)' } }}
                onMouseLeave={e => { if (!isBookmarked) { e.currentTarget.style.background = 'rgba(102,102,136,0.2)'; e.currentTarget.style.color = 'var(--lcars-gray)' } }}
                title={isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
              >
                <Bookmark size={12} fill={isBookmarked ? 'currentColor' : 'none'} />
              </button>
              <button
                onClick={handleExport}
                style={{
                  background: 'rgba(102,102,136,0.2)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.3rem 0.5rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  color: 'var(--lcars-gray)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lcars-gold)'; e.currentTarget.style.color = 'var(--lcars-text-on-color)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,102,136,0.2)'; e.currentTarget.style.color = 'var(--lcars-gray)' }}
                title="Export Markdown"
              >
                <Download size={12} />
              </button>
              <button
                onClick={() => setShowRevisions(true)}
                style={{
                  background: 'rgba(102,102,136,0.2)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.3rem 0.5rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  color: 'var(--lcars-gray)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lcars-gold)'; e.currentTarget.style.color = 'var(--lcars-text-on-color)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,102,136,0.2)'; e.currentTarget.style.color = 'var(--lcars-gray)' }}
                title="Revision Log"
              >
                <History size={12} />
              </button>
              <button
                onClick={onEdit}
                style={{
                  background: 'rgba(102,102,136,0.2)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.3rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--lcars-ice)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lcars-ice)'; e.currentTarget.style.color = 'var(--lcars-text-on-color)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,102,136,0.2)'; e.currentTarget.style.color = 'var(--lcars-ice)' }}
              >
                <Edit3 size={12} /> Modify
              </button>
              <button
                onClick={onDelete}
                style={{
                  background: 'rgba(102,102,136,0.2)',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.3rem 0.5rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  color: 'var(--lcars-gray)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--lcars-tomato)'; e.currentTarget.style.color = 'var(--lcars-text-on-color)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,102,136,0.2)'; e.currentTarget.style.color = 'var(--lcars-gray)' }}
              >
                <Trash2 size={12} />
              </button>
          </div>

          {/* Metadata row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            marginTop: '0.75rem', flexWrap: 'wrap',
          }}>
            <span style={{
              fontFamily: "'Antonio', sans-serif",
              fontSize: '0.6rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: 'var(--lcars-text-on-color)', background: st.color,
              padding: '0.1rem 0.4rem', borderRadius: '999px',
            }}>
              {st.label}
            </span>
            {article.updated_at && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.72rem', color: 'var(--lcars-gray)',
                display: 'flex', alignItems: 'center', gap: '0.25rem',
              }}>
                <Clock size={12} /> {formatDate(article.updated_at)}
              </span>
            )}
            {article.source_url && (
              <a href={article.source_url} target="_blank" rel="noopener noreferrer"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.72rem', color: 'var(--lcars-ice)',
                  display: 'flex', alignItems: 'center', gap: '0.25rem',
                  textDecoration: 'none',
                }}>
                <ExternalLink size={12} /> Source
              </a>
            )}
            {/* Tags */}
            {article.tags && article.tags.length > 0 && article.tags.map(tag => (
              <span key={tag.id} style={{
                fontFamily: "'Antonio', sans-serif",
                fontSize: '0.6rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.04em',
                color: 'var(--lcars-gold)',
                background: 'rgba(255, 170, 0, 0.12)',
                border: '1px solid rgba(255, 170, 0, 0.3)',
                padding: '0.1rem 0.4rem', borderRadius: '999px',
              }}>
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      </LCARSPanel>

      {/* Article content with floating TOC */}
      <div style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 170px',
        gap: '0.75rem',
        alignItems: 'start',
      }}>
        <div ref={contentRef} className="lcars-kb-content" style={{
          background: '#000',
          border: '1px solid rgba(102, 102, 136, 0.3)',
          borderLeft: '6px solid var(--lcars-gold)',
          padding: '1.5rem',
          minHeight: '200px',
          minWidth: 0,
        }}>
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <p style={{ color: 'var(--lcars-gray)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.85rem' }}>
              No data recorded for this entry.
            </p>
          )}
        </div>

        {/* Section Index (desktop only) */}
        {!isMobile && (
          <KBTableOfContents contentRef={contentRef} isLCARS={true} />
        )}
      </div>

      {/* Sub-Entries */}
      {subPages.length > 0 && (
        <LCARSPanel
          title={`Sub-Entries — ${subPages.length}`}
          color="var(--lcars-gold)"
          style={{ marginTop: '0.75rem' }}
          noPadding
        >
          {subPages.map(sp => {
            const spSt = LCARS_STATUS[sp.status] || LCARS_STATUS.draft
            return (
              <Link
                key={sp.id}
                to={`/kb/${sp.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid rgba(102,102,136,0.15)',
                  borderLeft: '4px solid var(--lcars-gold)',
                  textDecoration: 'none',
                  gap: '0.75rem',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 170, 0, 0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--lcars-space-white)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {sp.title}
                </span>
                <span style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.58rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--lcars-text-on-color)',
                  background: spSt.color,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                }}>
                  {spSt.label}
                </span>
              </Link>
            )
          })}
        </LCARSPanel>
      )}

      {/* Reverse References (backlinks) */}
      {backlinks.length > 0 && (
        <LCARSPanel
          title="Reverse References"
          color="var(--lcars-gold)"
          style={{ marginTop: '0.75rem' }}
          noPadding
        >
          {backlinks.map(bl => {
            const blSt = LCARS_STATUS[bl.status] || LCARS_STATUS.draft
            return (
              <Link
                key={bl.id}
                to={`/kb/${bl.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  borderBottom: '1px solid rgba(102,102,136,0.15)',
                  borderLeft: '4px solid var(--lcars-gold)',
                  textDecoration: 'none',
                  gap: '0.75rem',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 170, 0, 0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: 'var(--lcars-space-white)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                }}>
                  {bl.title}
                </span>
                <span style={{
                  fontFamily: "'Antonio', sans-serif",
                  fontSize: '0.58rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--lcars-text-on-color)',
                  background: blSt.color,
                  padding: '0.1rem 0.4rem',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                }}>
                  {blSt.label}
                </span>
              </Link>
            )
          })}
        </LCARSPanel>
      )}

      {/* Revision History slide-out */}
      {showRevisions && (
        <KBRevisionHistory
          articleSlug={article.slug}
          onClose={() => setShowRevisions(false)}
          onRestore={(restoredArticle) => {
            setShowRevisions(false)
            if (onRestore) onRestore(restoredArticle)
          }}
        />
      )}
    </div>
  )
}


// ── LCARS Editor View ─────────────────────────────────────────────

function LCARSEditorView({
  title, setTitle, categoryId, setCategoryId, status, setStatus,
  sourceUrl, setSourceUrl, content, setContent,
  categories, onSave, onCancel, isNew,
  tagIds = [], setTagIds,
  parentId = '', setParentId, articleId,
}) {
  // Tag state
  const [allTags, setAllTags] = useState([])
  const [newTagInput, setNewTagInput] = useState('')
  const [allArticles, setAllArticles] = useState([])

  useEffect(() => {
    kb.tags.list().then(setAllTags).catch(() => {})
    kb.articles.list({ per_page: 0 }).then(data => setAllArticles(data.articles)).catch(() => {})
  }, [])
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: 'Begin recording database entry...' }),
      CodeBlockLowlight.configure({ lowlight }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      ImageExt.configure({ inline: false, allowBase64: false }),
      TipTapLink.configure({ openOnClick: false, autolink: true }),
      Underline, HighlightExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList, TaskItem.configure({ nested: true }),
      CalloutBlock,
      CollapsibleBlock, CollapsibleSummary, CollapsibleContent,
      MermaidBlock,
      WikiLink,
    ],
    content: content,
    onUpdate: ({ editor }) => {
      setContent(editor.getJSON())
    },
  }, [])

  // Ctrl+S
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        onSave()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onSave])

  const STATUS_OPTIONS = [
    { value: 'draft', label: 'Preliminary' },
    { value: 'in_progress', label: 'In Analysis' },
    { value: 'published', label: 'Verified' },
    { value: 'needs_review', label: 'Review Required' },
    { value: 'outdated', label: 'Declassified' },
  ]

  return (
    <div style={{ maxWidth: '900px' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <button
          onClick={onCancel}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--lcars-ice)',
            fontFamily: "'Antonio', sans-serif", fontSize: '0.8rem',
            textTransform: 'uppercase', letterSpacing: '0.05em', padding: 0,
          }}
        >
          <ArrowLeft size={14} /> {isNew ? 'Library Computer' : 'Cancel'}
        </button>
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          {!isNew && (
            <button
              onClick={async () => {
                const name = prompt('Template designation:', title)
                if (!name) return
                try {
                  // We need the current slug from the URL
                  const slug = window.location.pathname.split('/kb/')[1]?.split('/')[0]
                  if (slug) {
                    await kb.templates.saveAs(slug, { template_name: name })
                    alert('Template saved to database.')
                  }
                } catch (err) {
                  alert('Failed to save template: ' + err.message)
                }
              }}
              style={{
                background: 'rgba(102,102,136,0.2)',
                border: 'none',
                borderRadius: '999px',
                padding: '0.4rem 0.5rem',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                color: 'var(--lcars-gray)',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--lcars-gold)'; e.currentTarget.style.color = 'var(--lcars-text-on-color)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(102,102,136,0.2)'; e.currentTarget.style.color = 'var(--lcars-gray)' }}
              title="Save as Template"
            >
              <FileText size={14} />
            </button>
          )}
          <button
            className="lcars-element button rounded auto"
            onClick={onSave}
            style={{
              background: 'var(--lcars-gold)',
              border: 'none',
              height: 'auto',
              padding: '0.4rem 1rem',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              fontSize: '0.8rem',
            }}
          >
            <Save size={14} /> {isNew ? 'Create Entry' : 'Save Entry'}
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="ENTRY DESIGNATION..."
        style={{
          width: '100%',
          fontSize: '1.3rem',
          fontFamily: "'Antonio', sans-serif",
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          background: 'transparent',
          border: 'none',
          borderBottom: '2px solid var(--lcars-gold)',
          color: 'var(--lcars-space-white)',
          padding: '0.5rem 0',
          marginBottom: '0.75rem',
          outline: 'none',
        }}
      />

      {/* Metadata fields */}
      <div className="form-grid-3col" style={{ marginBottom: '0.75rem' }}>
        <div>
          <label style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '0.68rem',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--lcars-gold)', display: 'block', marginBottom: '0.25rem',
          }}>
            Classification
          </label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            style={{
              width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem',
              background: '#000', border: '1px solid var(--lcars-gray)',
              borderRadius: '2px', color: 'var(--lcars-space-white)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <option value="">Unclassified</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{'  '.repeat(cat.depth)}{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '0.68rem',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--lcars-gold)', display: 'block', marginBottom: '0.25rem',
          }}>
            Clearance Status
          </label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{
              width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem',
              background: '#000', border: '1px solid var(--lcars-gray)',
              borderRadius: '2px', color: 'var(--lcars-space-white)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{
            fontFamily: "'Antonio', sans-serif", fontSize: '0.68rem',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--lcars-gold)', display: 'block', marginBottom: '0.25rem',
          }}>
            Source Reference
          </label>
          <input
            value={sourceUrl}
            onChange={e => setSourceUrl(e.target.value)}
            placeholder="https://..."
            style={{
              width: '100%', padding: '0.35rem 0.5rem', fontSize: '0.8rem',
              background: '#000', border: '1px solid var(--lcars-gray)',
              borderRadius: '2px', color: 'var(--lcars-space-white)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          />
        </div>
      </div>

      {/* Parent article (sub-page of) */}
      {(() => {
        const eligibleParents = allArticles.filter(a =>
          a.id !== articleId && !a.parent_id
        )
        if (eligibleParents.length === 0 && !parentId) return null
        return (
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{
              fontFamily: "'Antonio', sans-serif", fontSize: '0.68rem',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--lcars-gold)', display: 'block', marginBottom: '0.25rem',
            }}>
              Sub-Entry Of
            </label>
            <select
              value={parentId}
              onChange={e => setParentId(e.target.value)}
              style={{
                maxWidth: '300px', padding: '0.35rem 0.5rem', fontSize: '0.8rem',
                background: '#000', border: '1px solid var(--lcars-gray)',
                borderRadius: '2px', color: 'var(--lcars-space-white)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <option value="">None (top-level entry)</option>
              {eligibleParents.map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>
        )
      })()}

      {/* Cross-References (tags) */}
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{
          fontFamily: "'Antonio', sans-serif", fontSize: '0.68rem',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--lcars-gold)', display: 'block', marginBottom: '0.375rem',
        }}>
          Cross-References
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
          {tagIds.map(id => {
            const tag = allTags.find(t => t.id === id)
            if (!tag) return null
            return (
              <span key={id} style={{
                display: 'flex', alignItems: 'center', gap: '0.25rem',
                background: 'rgba(255, 170, 0, 0.12)',
                color: 'var(--lcars-gold)',
                padding: '0.2rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.72rem',
                fontFamily: "'Antonio', sans-serif",
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                {tag.name}
                <button
                  onClick={() => setTagIds(prev => prev.filter(i => i !== id))}
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
          <div style={{ position: 'relative' }}>
            <input
              value={newTagInput}
              onChange={e => setNewTagInput(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newTagInput.trim()) {
                  e.preventDefault()
                  const name = newTagInput.trim()
                  let tag = allTags.find(t => t.name.toLowerCase() === name.toLowerCase())
                  if (!tag) {
                    try {
                      tag = await kb.tags.create({ name })
                      setAllTags(prev => [...prev, tag])
                    } catch (err) {
                      return
                    }
                  }
                  if (!tagIds.includes(tag.id)) {
                    setTagIds(prev => [...prev, tag.id])
                  }
                  setNewTagInput('')
                }
              }}
              placeholder="Add reference..."
              style={{
                padding: '0.2rem 0.5rem',
                fontSize: '0.75rem',
                background: '#000',
                border: '1px solid var(--lcars-gray)',
                borderRadius: '2px',
                color: 'var(--lcars-space-white)',
                fontFamily: "'JetBrains Mono', monospace",
                width: '130px',
                outline: 'none',
              }}
            />
            {newTagInput.trim() && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                zIndex: 10,
                background: '#000',
                border: '1px solid var(--lcars-gray)',
                marginTop: '2px',
                maxHeight: '150px',
                overflow: 'auto',
                minWidth: '160px',
              }}>
                {allTags
                  .filter(t =>
                    t.name.toLowerCase().includes(newTagInput.toLowerCase()) &&
                    !tagIds.includes(t.id)
                  )
                  .slice(0, 8)
                  .map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setTagIds(prev => [...prev, t.id])
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
                        color: 'var(--lcars-space-white)',
                        fontSize: '0.75rem',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,170,0,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Tag size={11} style={{ color: 'var(--lcars-gold)', marginRight: '0.375rem' }} />
                      {t.name}
                    </button>
                  ))
                }
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="lcars-kb-content" style={{
        background: '#000',
        border: '1px solid rgba(102, 102, 136, 0.3)',
        borderLeft: '6px solid var(--lcars-gold)',
        padding: '1rem',
        minHeight: '400px',
      }}>
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>
  )
}


// ── Utilities ─────────────────────────────────────────────────────

function flattenCategories(categories, depth = 0) {
  const result = []
  for (const cat of (categories || [])) {
    result.push({ id: cat.id, name: cat.name, depth })
    if (cat.children?.length > 0) {
      result.push(...flattenCategories(cat.children, depth + 1))
    }
  }
  return result
}
