/**
 * KBArticleList - Displays a list of KB articles as cards.
 *
 * When no article is selected, this serves as the main content view.
 * Supports filtering by category, status, and search.
 * Also serves as the KB home dashboard when selectedCategoryId is null.
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FileText, Clock, Tag, Plus, Bookmark, Eye, Upload, ChevronLeft, ChevronRight } from 'lucide-react'
import { kb } from '../../api/client'

// Status label and color mapping
const STATUS_STYLES = {
  draft: { label: 'Draft', color: 'var(--color-overlay-0)' },
  in_progress: { label: 'In Progress', color: 'var(--color-yellow)' },
  published: { label: 'Published', color: 'var(--color-green)' },
  needs_review: { label: 'Needs Review', color: 'var(--color-peach)' },
  outdated: { label: 'Outdated', color: 'var(--color-red)' },
}

export default function KBArticleList({
  articles,
  stats,
  isHome,
  onNewArticle,
  loading,
  searchQuery = '',
  currentPage = 1,
  totalPages = 1,
  totalArticles = 0,
  onPageChange,
}) {
  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-overlay-0)' }}>
        Loading...
      </div>
    )
  }

  // KB Home Dashboard view
  if (isHome && stats) {
    return <KBHomeDashboard stats={stats} onNewArticle={onNewArticle} />
  }

  // Article list view
  if (!articles || articles.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '3rem 1rem',
        color: 'var(--color-overlay-0)',
      }}>
        <FileText size={40} strokeWidth={1.2} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
        <p style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>No articles found</p>
        <button onClick={onNewArticle} className="btn btn-primary">
          <Plus size={16} /> Create Article
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Article count / search header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
      }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-overlay-0)' }}>
          {searchQuery
            ? `${articles.length} result${articles.length !== 1 ? 's' : ''} for "${searchQuery}"`
            : `${totalArticles || articles.length} article${(totalArticles || articles.length) !== 1 ? 's' : ''}`
          }
        </span>
        <button onClick={onNewArticle} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}>
          <Plus size={14} /> New Article
        </button>
      </div>

      {/* Article cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {articles.map(article => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && onPageChange && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginTop: '1rem',
          fontSize: '0.8rem',
        }}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="btn btn-ghost"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ color: 'var(--color-overlay-0)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="btn btn-ghost"
            style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

function ArticleCard({ article }) {
  const status = STATUS_STYLES[article.status] || STATUS_STYLES.draft
  const updatedDate = article.updated_at ? new Date(article.updated_at).toLocaleDateString() : ''

  // Use search headline if available (from full-text search), otherwise fallback to content_text
  const preview = article.headline
    ? article.headline
    : article.content_text
      ? article.content_text.substring(0, 150) + (article.content_text.length > 150 ? '...' : '')
      : 'No content yet'
  const hasHighlight = !!article.headline

  return (
    <Link
      to={`/kb/${article.slug}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-surface-1)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-surface-0)'}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {article.title}
            </h3>
            {hasHighlight ? (
              <p
                style={{
                  margin: '0.375rem 0 0',
                  fontSize: '0.82rem',
                  color: 'var(--color-subtext-0)',
                  lineHeight: 1.5,
                }}
                dangerouslySetInnerHTML={{
                  __html: preview
                    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
                    .replace(/&lt;&lt;/g, '<mark style="background:rgba(137,180,250,0.2);color:var(--color-text);padding:0 2px;border-radius:2px">')
                    .replace(/&gt;&gt;/g, '</mark>')
                }}
              />
            ) : (
              <p style={{
                margin: '0.375rem 0 0',
                fontSize: '0.82rem',
                color: 'var(--color-subtext-0)',
                lineHeight: 1.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {preview}
              </p>
            )}
          </div>

          {/* Status badge */}
          <span style={{
            fontSize: '0.7rem',
            fontWeight: 600,
            color: status.color,
            border: `1px solid ${status.color}`,
            borderRadius: '999px',
            padding: '0.15rem 0.5rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {status.label}
          </span>
        </div>

        {/* Meta row: date + tags */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--color-overlay-0)',
        }}>
          {updatedDate && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={12} /> {updatedDate}
            </span>
          )}
          {article.tags && article.tags.length > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
              <Tag size={12} />
              {article.tags.slice(0, 3).map(t => (
                <span key={t.id} style={{
                  background: t.color ? `${t.color}22` : 'var(--color-surface-0)',
                  color: t.color || 'var(--color-subtext-0)',
                  padding: '0.05rem 0.35rem',
                  borderRadius: '999px',
                  fontSize: '0.7rem',
                }}>
                  {t.name}
                </span>
              ))}
              {article.tags.length > 3 && (
                <span style={{ color: 'var(--color-overlay-0)' }}>+{article.tags.length - 3}</span>
              )}
            </span>
          )}
          {article.sub_page_count > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <FileText size={12} /> {article.sub_page_count} sub-page{article.sub_page_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

/**
 * KBHomeDashboard - The landing view when no category/article is selected.
 * Shows stats, recently updated, recently viewed, and bookmarked articles.
 */
function KBHomeDashboard({ stats, onNewArticle }) {
  const navigate = useNavigate()
  const [recentViews, setRecentViews] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const importRef = useRef(null)

  useEffect(() => {
    kb.recentViews(10).then(setRecentViews).catch(() => {})
    kb.bookmarks.list().then(setBookmarks).catch(() => {})
  }, [])

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const article = await kb.importArticle(file)
      navigate(`/kb/${article.slug}`)
    } catch (err) {
      alert('Import failed: ' + err.message)
    }
    e.target.value = ''
  }

  return (
    <div>
      {/* Stats row */}
      <div className="card-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Total Articles" value={stats.total} color="var(--color-blue)" />
        <StatCard label="Published" value={stats.by_status?.published || 0} color="var(--color-green)" />
        <StatCard label="Drafts" value={stats.by_status?.draft || 0} color="var(--color-overlay-0)" />
        <StatCard label="Categories" value={stats.categories_count} color="var(--color-mauve)" />
      </div>

      {/* Two-column: recently updated + bookmarks */}
      <div style={{ display: 'grid', gridTemplateColumns: bookmarks.length > 0 ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
        {/* Recently updated */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Recently Updated</h3>
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
                className="btn btn-ghost"
                style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
                title="Import Markdown"
              >
                <Upload size={14} /> Import
              </button>
              <button onClick={onNewArticle} className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}>
                <Plus size={14} /> New Article
              </button>
            </div>
          </div>

          {stats.recent && stats.recent.length > 0 ? (
            <DashboardArticleList articles={stats.recent} />
          ) : (
            <p style={{ color: 'var(--color-overlay-0)', fontSize: '0.85rem', margin: 0 }}>
              No articles yet. Create your first one to get started.
            </p>
          )}
        </div>

        {/* Bookmarks */}
        {bookmarks.length > 0 && (
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{
              margin: '0 0 1rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }}>
              <Bookmark size={15} /> Bookmarks
            </h3>
            <DashboardArticleList articles={bookmarks} />
          </div>
        )}
      </div>

      {/* Recently viewed */}
      {recentViews.length > 0 && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h3 style={{
            margin: '0 0 1rem',
            fontSize: '0.95rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <Eye size={15} /> Recently Viewed
          </h3>
          <DashboardArticleList articles={recentViews} />
        </div>
      )}
    </div>
  )
}

/** Shared article link list used by dashboard sections. */
function DashboardArticleList({ articles }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {articles.map(article => (
        <Link
          key={article.id}
          to={`/kb/${article.slug}`}
          style={{
            textDecoration: 'none',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.625rem',
            borderRadius: '6px',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{article.title}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)' }}>
            {article.updated_at ? new Date(article.updated_at).toLocaleDateString() : ''}
          </span>
        </Link>
      ))}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="card" style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-overlay-0)', marginTop: '0.25rem' }}>
        {label}
      </div>
    </div>
  )
}
