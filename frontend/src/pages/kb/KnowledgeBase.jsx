/**
 * KnowledgeBase.jsx - Main orchestrator for the Knowledge Base module.
 *
 * Manages the two-column layout (sidebar + content), routes between
 * views (home, article list, reader, editor), and coordinates all
 * data fetching and state management.
 *
 * URL structure:
 *   /kb                 → Home dashboard (or article list if category selected)
 *   /kb/:slug           → Article reader (read mode)
 *   /kb/:slug/edit      → Article editor (edit mode)
 *   /kb/new             → New article editor
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import useIsMobile from '../../hooks/useIsMobile'
import { kb } from '../../api/client'
import KBSidebar from './KBSidebar'
import KBArticleList from './KBArticleList'
import KBArticleReader from './KBArticleReader'
import KBArticleEditor from './KBArticleEditor'
import KBTemplatePickerModal from './KBTemplatePickerModal'

export default function KnowledgeBase() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Determine view from URL
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
  const [articleLoading, setArticleLoading] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalArticles, setTotalArticles] = useState(0)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const searchTimeout = useRef(null)

  // Mobile sidebar toggle
  const [showSidebar, setShowSidebar] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

  // Load categories and stats on mount
  useEffect(() => {
    loadInitialData()
  }, [])

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [categoryId, selectedTagId, selectedStatus])

  // Load articles when filters or page change
  useEffect(() => {
    loadArticles()
  }, [categoryId, selectedTagId, selectedStatus, currentPage])

  // Load article when slug changes
  useEffect(() => {
    if (slug && slug !== 'new') {
      loadArticle(slug)
    } else {
      setCurrentArticle(null)
    }
  }, [slug])

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
      setTotalArticles(data.total)
    } catch (err) {
      console.error('Failed to load articles:', err)
    }
  }

  async function loadArticle(articleSlug) {
    setArticleLoading(true)
    try {
      const art = await kb.articles.get(articleSlug)
      setCurrentArticle(art)
      // Record view for recently viewed list
      kb.articles.recordView(articleSlug).catch(() => {})
    } catch (err) {
      console.error('Failed to load article:', err)
      setCurrentArticle(null)
    } finally {
      setArticleLoading(false)
    }
  }

  // Debounced search handler
  function handleSearchChange(query) {
    setSearchQuery(query)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!query.trim()) {
      setSearchResults(null)
      return
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const data = await kb.search({ q: query })
        setSearchResults(data.results)
      } catch (err) {
        console.error('Search failed:', err)
        setSearchResults([])
      }
    }, 300)
  }

  // Category actions
  async function handleSelectCategory(catId) {
    if (catId === null) {
      setSearchParams({})
    } else {
      setSearchParams({ category: catId })
    }
    navigate(`/kb${catId ? `?category=${catId}` : ''}`)
    if (isMobile) setShowSidebar(false)
  }

  async function handleCreateCategory(data) {
    try {
      await kb.categories.create(data)
      const cats = await kb.categories.list()
      setCategories(cats)
    } catch (err) {
      alert('Failed to create category: ' + err.message)
    }
  }

  // Article actions
  function handleNewArticle() {
    setShowTemplatePicker(true)
  }

  const handleSaveArticle = useCallback(async (data) => {
    if (isNew) {
      // Creating new article
      const created = await kb.articles.create(data)
      // Refresh stats and articles
      const [st, cats] = await Promise.all([kb.stats(), kb.categories.list()])
      setStats(st)
      setCategories(cats)
      // Navigate to the new article
      navigate(`/kb/${created.slug}`)
    } else if (currentArticle) {
      // Updating existing article
      const updated = await kb.articles.update(currentArticle.slug, data)
      setCurrentArticle(updated)
      // If slug changed (title changed), navigate to new URL
      if (updated.slug !== currentArticle.slug) {
        navigate(`/kb/${updated.slug}${isEditing ? '/edit' : ''}`, { replace: true })
      }
    }
  }, [isNew, currentArticle, isEditing, navigate])

  async function handleDeleteArticle() {
    if (!currentArticle) return
    if (!confirm(`Delete "${currentArticle.title}"? This cannot be undone.`)) return

    try {
      await kb.articles.delete(currentArticle.slug)
      setCurrentArticle(null)
      // Refresh data
      const [st, cats] = await Promise.all([kb.stats(), kb.categories.list()])
      setStats(st)
      setCategories(cats)
      await loadArticles()
      navigate('/kb')
    } catch (err) {
      alert('Failed to delete article: ' + err.message)
    }
  }

  // Calculate total article count for sidebar
  const totalArticleCount = stats?.total || 0

  // Determine what to render in the main content area
  function renderContent() {
    // New article editor
    if (isNew) {
      return (
        <KBArticleEditor
          article={null}
          categories={categories}
          onSave={handleSaveArticle}
          onCancel={() => navigate('/kb')}
          isNew={true}
        />
      )
    }

    // Article editor (editing existing)
    if (slug && isEditing && currentArticle) {
      return (
        <KBArticleEditor
          article={currentArticle}
          categories={categories}
          onSave={handleSaveArticle}
          onCancel={() => navigate(`/kb/${slug}`)}
          isNew={false}
        />
      )
    }

    // Article reader
    if (slug && currentArticle && !isEditing) {
      return (
        <KBArticleReader
          article={currentArticle}
          onEdit={() => navigate(`/kb/${slug}/edit`)}
          onDelete={handleDeleteArticle}
          onRestore={(restoredArticle) => {
            setCurrentArticle(restoredArticle)
            if (restoredArticle.slug !== slug) {
              navigate(`/kb/${restoredArticle.slug}`, { replace: true })
            }
          }}
        />
      )
    }

    // Article loading
    if (slug && articleLoading) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-overlay-0)' }}>
          Loading article...
        </div>
      )
    }

    // Search results view
    if (searchResults !== null) {
      return (
        <KBArticleList
          articles={searchResults}
          stats={null}
          isHome={false}
          onNewArticle={handleNewArticle}
          loading={false}
          searchQuery={searchQuery}
        />
      )
    }

    // Home dashboard or article list
    const isHome = !categoryId && !slug
    return (
      <KBArticleList
        articles={articles}
        stats={stats}
        isHome={isHome}
        onNewArticle={handleNewArticle}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        totalArticles={totalArticles}
        onPageChange={setCurrentPage}
      />
    )
  }

  // Mobile layout: full-width content with sidebar toggle
  if (isMobile) {
    const isHome = !categoryId && !slug
    return (
      <div>
        {/* Mobile sidebar toggle */}
        {!slug && (
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="btn btn-ghost"
            style={{ marginBottom: '0.75rem', fontSize: '0.85rem' }}
          >
            {showSidebar ? 'Hide Categories' : 'Show Categories'}
          </button>
        )}

        {/* Mobile sidebar */}
        {showSidebar && !slug && (
          <div className="card" style={{ marginBottom: '1rem', maxHeight: '300px', overflow: 'auto' }}>
            <KBSidebar
              categories={categories}
              selectedCategoryId={categoryId}
              onSelectCategory={handleSelectCategory}
              onCreateCategory={handleCreateCategory}
              onNewArticle={handleNewArticle}
              articleCount={totalArticleCount}
              tags={tags}
              selectedTagId={selectedTagId}
              onSelectTag={setSelectedTagId}
              selectedStatus={selectedStatus}
              onSelectStatus={setSelectedStatus}
              searchQuery={searchQuery}
              onSearchChange={handleSearchChange}
            />
          </div>
        )}

        {/* Content */}
        {renderContent()}

        {/* On mobile home, also show browsable article list below the dashboard */}
        {isHome && !loading && articles.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <KBArticleList
              articles={articles}
              stats={null}
              isHome={false}
              onNewArticle={handleNewArticle}
              loading={false}
              currentPage={currentPage}
              totalPages={totalPages}
              totalArticles={totalArticles}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

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

  // Desktop layout: sidebar + content
  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: '1rem',
        height: 'calc(100dvh - 96px)',
      }}>
        {/* Sidebar */}
        <div className="card" style={{
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <KBSidebar
            categories={categories}
            selectedCategoryId={categoryId}
            onSelectCategory={handleSelectCategory}
            onCreateCategory={handleCreateCategory}
            onNewArticle={handleNewArticle}
            articleCount={totalArticleCount}
            tags={tags}
            selectedTagId={selectedTagId}
            onSelectTag={setSelectedTagId}
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
          />
        </div>

        {/* Main content */}
        <div style={{ overflowY: 'auto', paddingRight: '0.5rem' }}>
          {renderContent()}
        </div>
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
    </>
  )
}
