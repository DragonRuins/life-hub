/**
 * KBSidebar - Left sidebar for the Knowledge Base.
 *
 * Contains: category tree, "All Articles" link, "New Category" button,
 * and "New Article" button.
 */
import { useState } from 'react'
import { Plus, BookOpen, FolderPlus, Tag, Search, Filter } from 'lucide-react'
import KBCategoryTree from './KBCategoryTree'

const STATUS_FILTERS = [
  { value: 'draft', label: 'Draft', color: 'var(--color-overlay-0)' },
  { value: 'in_progress', label: 'In Progress', color: 'var(--color-yellow)' },
  { value: 'published', label: 'Published', color: 'var(--color-green)' },
  { value: 'needs_review', label: 'Needs Review', color: 'var(--color-peach)' },
  { value: 'outdated', label: 'Outdated', color: 'var(--color-red)' },
]

export default function KBSidebar({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onNewArticle,
  articleCount,
  tags = [],
  selectedTagId,
  onSelectTag,
  selectedStatus,
  onSelectStatus,
  searchQuery = '',
  onSearchChange,
}) {
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  function handleCreateCategory(e) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name) return
    onCreateCategory({ name })
    setNewCategoryName('')
    setShowNewCategory(false)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem',
        borderBottom: '1px solid var(--color-surface-0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text)' }}>
          Categories
        </span>
        <button
          onClick={() => setShowNewCategory(!showNewCategory)}
          title="New Category"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-overlay-0)',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            borderRadius: '4px',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-blue)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-overlay-0)'}
        >
          <FolderPlus size={16} />
        </button>
      </div>

      {/* New category input */}
      {showNewCategory && (
        <form onSubmit={handleCreateCategory} style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--color-surface-0)' }}>
          <input
            autoFocus
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            placeholder="Category name..."
            style={{
              width: '100%',
              padding: '0.375rem 0.5rem',
              fontSize: '0.8rem',
              background: 'var(--color-mantle)',
              border: '1px solid var(--color-surface-0)',
              borderRadius: '6px',
              color: 'var(--color-text)',
              outline: 'none',
            }}
            onKeyDown={e => { if (e.key === 'Escape') setShowNewCategory(false) }}
          />
        </form>
      )}

      {/* Search bar */}
      {onSearchChange && (
        <div style={{ padding: '0.5rem 0.75rem 0', borderBottom: '1px solid var(--color-surface-0)' }}>
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <Search size={13} style={{
              position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-overlay-0)', pointerEvents: 'none',
            }} />
            <input
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="Search articles..."
              style={{
                width: '100%',
                padding: '0.375rem 0.5rem 0.375rem 1.75rem',
                fontSize: '0.78rem',
                background: 'var(--color-mantle)',
                border: '1px solid var(--color-surface-0)',
                borderRadius: '6px',
                color: 'var(--color-text)',
                outline: 'none',
              }}
            />
          </div>
        </div>
      )}

      {/* Scrollable tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.25rem' }}>
        {/* "All Articles" link */}
        <div
          onClick={() => onSelectCategory(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.375rem 0.5rem',
            cursor: 'pointer',
            borderRadius: '6px',
            background: selectedCategoryId === null ? 'rgba(137, 180, 250, 0.1)' : 'transparent',
            color: selectedCategoryId === null ? 'var(--color-blue)' : 'var(--color-subtext-0)',
            fontWeight: selectedCategoryId === null ? 600 : 400,
            fontSize: '0.85rem',
            marginBottom: '0.25rem',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (selectedCategoryId !== null) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)' }}
          onMouseLeave={e => { if (selectedCategoryId !== null) e.currentTarget.style.background = 'transparent' }}
        >
          <BookOpen size={15} />
          <span style={{ flex: 1 }}>All Articles</span>
          {articleCount > 0 && (
            <span style={{
              fontSize: '0.7rem',
              color: 'var(--color-overlay-0)',
              background: 'var(--color-surface-0)',
              borderRadius: '999px',
              padding: '0.1rem 0.4rem',
            }}>
              {articleCount}
            </span>
          )}
        </div>

        {/* Category tree */}
        <KBCategoryTree
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onCreateCategory={onCreateCategory}
        />

        {/* Status filter */}
        {onSelectStatus && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-surface-0)' }}>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-overlay-0)',
              padding: '0 0.5rem',
              marginBottom: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}>
              <Filter size={11} /> Status
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', padding: '0 0.5rem' }}>
              {STATUS_FILTERS.map(sf => {
                const isActive = selectedStatus === sf.value
                return (
                  <button
                    key={sf.value}
                    onClick={() => onSelectStatus(isActive ? null : sf.value)}
                    style={{
                      background: isActive
                        ? `${sf.color}22`
                        : 'var(--color-surface-0)',
                      color: isActive ? sf.color : 'var(--color-subtext-0)',
                      border: isActive
                        ? `1px solid ${sf.color}`
                        : '1px solid transparent',
                      borderRadius: '999px',
                      padding: '0.15rem 0.5rem',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sf.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Tags filter */}
        {tags.length > 0 && (
          <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-surface-0)' }}>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-overlay-0)',
              padding: '0 0.5rem',
              marginBottom: '0.375rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}>
              <Tag size={11} /> Tags
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', padding: '0 0.5rem' }}>
              {tags.map(tag => {
                const isActive = selectedTagId === tag.id
                return (
                  <button
                    key={tag.id}
                    onClick={() => onSelectTag && onSelectTag(isActive ? null : tag.id)}
                    style={{
                      background: isActive
                        ? (tag.color ? `${tag.color}33` : 'rgba(137, 180, 250, 0.15)')
                        : 'var(--color-surface-0)',
                      color: isActive
                        ? (tag.color || 'var(--color-blue)')
                        : 'var(--color-subtext-0)',
                      border: isActive
                        ? `1px solid ${tag.color || 'var(--color-blue)'}`
                        : '1px solid transparent',
                      borderRadius: '999px',
                      padding: '0.15rem 0.5rem',
                      fontSize: '0.7rem',
                      cursor: 'pointer',
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
      </div>

      {/* New Article button */}
      <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-surface-0)' }}>
        <button
          onClick={onNewArticle}
          className="btn btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
        >
          <Plus size={16} /> New Article
        </button>
      </div>
    </div>
  )
}
