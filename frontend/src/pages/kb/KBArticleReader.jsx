/**
 * KBArticleReader - Full-width rendered article view.
 *
 * Displays a published article in read mode with:
 * - Title and metadata header
 * - Breadcrumb navigation
 * - Rendered TipTap content (with KB extensions for callouts, collapsibles, Mermaid)
 * - Status badge
 * - Edit/Delete actions
 * - Revision history slide-out panel (Phase 2)
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Edit3, Trash2, Clock, ExternalLink, Tag, History, Link2, Bookmark, Download, Upload, FileText } from 'lucide-react'
import useIsMobile from '../../hooks/useIsMobile'
import { kb } from '../../api/client'
import TipTapEditor from '../notes/TipTapEditor'
import KBRevisionHistory from './KBRevisionHistory'
import KBTableOfContents from './KBTableOfContents'
import './kb-print.css'

const STATUS_STYLES = {
  draft: { label: 'Draft', color: 'var(--color-overlay-0)' },
  in_progress: { label: 'In Progress', color: 'var(--color-yellow)' },
  published: { label: 'Published', color: 'var(--color-green)' },
  needs_review: { label: 'Needs Review', color: 'var(--color-peach)' },
  outdated: { label: 'Outdated', color: 'var(--color-red)' },
}

export default function KBArticleReader({ article, onEdit, onDelete, onRestore }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const status = STATUS_STYLES[article.status] || STATUS_STYLES.draft
  const [showRevisions, setShowRevisions] = useState(false)
  const [backlinks, setBacklinks] = useState([])
  const [subPages, setSubPages] = useState([])
  const [isBookmarked, setIsBookmarked] = useState(false)
  const contentRef = useRef(null)

  // Load backlinks and bookmark state when article changes
  useEffect(() => {
    if (article?.slug) {
      kb.articles.backlinks(article.slug).then(setBacklinks).catch(() => setBacklinks([]))
      kb.articles.subPages(article.slug).then(setSubPages).catch(() => setSubPages([]))
      // Check if bookmarked by fetching all bookmarks and checking
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

  const updatedDate = article.updated_at
    ? new Date(article.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Back navigation */}
      <button
        onClick={() => navigate('/kb')}
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
          marginBottom: '0.75rem',
        }}
      >
        <ArrowLeft size={16} /> Knowledge Base
      </button>

      {/* Parent article link (for sub-pages) */}
      {article.parent_article && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.8rem',
          color: 'var(--color-overlay-0)',
          marginBottom: '0.5rem',
        }}>
          <FileText size={13} />
          <span>Sub-page of</span>
          <Link
            to={`/kb/${article.parent_article.slug}`}
            style={{ color: 'var(--color-blue)', textDecoration: 'none' }}
          >
            {article.parent_article.title}
          </Link>
        </div>
      )}

      {/* Breadcrumb */}
      {article.breadcrumb && article.breadcrumb.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.78rem',
          color: 'var(--color-overlay-0)',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
        }}>
          {article.breadcrumb.map((crumb, i) => (
            <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {i > 0 && <span>/</span>}
              <span
                onClick={() => navigate(`/kb?category=${crumb.id}`)}
                style={{ cursor: 'pointer', color: 'var(--color-subtext-0)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--color-blue)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-subtext-0)'}
              >
                {crumb.name}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Article header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3 }}>
          {article.title}
        </h1>
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginTop: '0.75rem',
        }}>
          <button
            onClick={handleToggleBookmark}
            className="btn btn-ghost"
            style={{
              fontSize: '0.8rem',
              padding: '0.375rem 0.75rem',
              color: isBookmarked ? 'var(--color-yellow)' : undefined,
            }}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            <Bookmark size={14} fill={isBookmarked ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={handleExport}
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
            title="Export as Markdown"
          >
            <Download size={14} />
          </button>
          <button
            onClick={() => setShowRevisions(true)}
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
            title="Revision history"
          >
            <History size={14} />
          </button>
          <button onClick={onEdit} className="btn btn-ghost" style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}>
            <Edit3 size={14} /> Edit
          </button>
          <button
            onClick={onDelete}
            className="btn btn-danger"
            style={{ fontSize: '0.8rem', padding: '0.375rem 0.75rem' }}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Metadata row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginTop: '0.75rem',
          fontSize: '0.8rem',
          color: 'var(--color-overlay-0)',
          flexWrap: 'wrap',
        }}>
          {/* Status badge */}
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: status.color,
            border: `1px solid ${status.color}`,
            borderRadius: '999px',
            padding: '0.15rem 0.5rem',
          }}>
            {status.label}
          </span>

          {updatedDate && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={13} /> Updated {updatedDate}
            </span>
          )}

          {article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                color: 'var(--color-blue)',
                textDecoration: 'none',
              }}
            >
              <ExternalLink size={13} /> Source
            </a>
          )}
        </div>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            marginTop: '0.625rem',
            flexWrap: 'wrap',
          }}>
            <Tag size={13} style={{ color: 'var(--color-overlay-0)' }} />
            {article.tags.map(t => (
              <span key={t.id} style={{
                background: t.color ? `${t.color}22` : 'var(--color-surface-0)',
                color: t.color || 'var(--color-subtext-0)',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                fontSize: '0.75rem',
              }}>
                {t.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--color-surface-0)', marginBottom: '1.5rem' }} />

      {/* Article content with floating TOC */}
      <div style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 180px',
        gap: '1.5rem',
        alignItems: 'start',
      }}>
        <div ref={contentRef} className="tiptap-content" style={{ fontSize: '0.95rem', lineHeight: 1.7, minWidth: 0 }}>
          <TipTapEditor
            content={article.content_json}
            onUpdate={() => {}}
            editable={false}
            enableKBExtensions={true}
          />
        </div>

        {/* Table of Contents (desktop only) */}
        {!isMobile && (
          <KBTableOfContents contentRef={contentRef} />
        )}
      </div>

      {/* Sub-pages */}
      {subPages.length > 0 && (
        <div style={{
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--color-surface-0)',
        }}>
          <h3 style={{
            margin: '0 0 0.75rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--color-overlay-0)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <FileText size={14} /> Sub-pages ({subPages.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {subPages.map(sp => (
              <Link
                key={sp.id}
                to={`/kb/${sp.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--color-surface-0)',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: 'var(--color-text)',
                  fontSize: '0.85rem',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface-0)'}
              >
                <span style={{ fontWeight: 500 }}>{sp.title}</span>
                <span style={{
                  fontSize: '0.7rem',
                  color: STATUS_STYLES[sp.status]?.color || 'var(--color-overlay-0)',
                  textTransform: 'capitalize',
                }}>
                  {STATUS_STYLES[sp.status]?.label || sp.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Referenced By (backlinks) */}
      {backlinks.length > 0 && (
        <div style={{
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid var(--color-surface-0)',
        }}>
          <h3 style={{
            margin: '0 0 0.75rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--color-overlay-0)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}>
            <Link2 size={14} /> Referenced By
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {backlinks.map(bl => (
              <Link
                key={bl.id}
                to={`/kb/${bl.slug}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--color-surface-0)',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  color: 'var(--color-text)',
                  fontSize: '0.85rem',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(137, 180, 250, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-surface-0)'}
              >
                <span style={{ fontWeight: 500 }}>{bl.title}</span>
                <span style={{
                  fontSize: '0.7rem',
                  color: 'var(--color-overlay-0)',
                  textTransform: 'capitalize',
                }}>
                  {bl.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Revision History slide-out */}
      {showRevisions && (
        <KBRevisionHistory
          articleSlug={article.slug}
          onClose={() => setShowRevisions(false)}
          onRestore={(revisionData) => {
            setShowRevisions(false)
            if (onRestore) onRestore(revisionData)
          }}
        />
      )}
    </div>
  )
}
