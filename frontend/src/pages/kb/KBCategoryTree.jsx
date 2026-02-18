/**
 * KBCategoryTree - Recursive category tree for the Knowledge Base sidebar.
 *
 * Renders a hierarchical tree of categories with expand/collapse,
 * article counts, and click-to-filter. Pattern follows FolderTree.jsx
 * from the Notes module.
 */
import { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus } from 'lucide-react'

export default function KBCategoryTree({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  depth = 0,
}) {
  return (
    <div>
      {categories.map(cat => (
        <CategoryNode
          key={cat.id}
          category={cat}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onCreateCategory={onCreateCategory}
          depth={depth}
        />
      ))}
    </div>
  )
}

function CategoryNode({ category, selectedCategoryId, onSelectCategory, onCreateCategory, depth }) {
  const [expanded, setExpanded] = useState(depth < 2) // Auto-expand first 2 levels
  const isSelected = selectedCategoryId === category.id
  const hasChildren = category.children && category.children.length > 0

  return (
    <div>
      <div
        onClick={() => onSelectCategory(category.id)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.5rem',
          paddingLeft: `${depth * 0.75 + 0.5}rem`,
          cursor: 'pointer',
          borderRadius: '6px',
          background: isSelected ? 'rgba(137, 180, 250, 0.1)' : 'transparent',
          color: isSelected ? 'var(--color-blue)' : 'var(--color-subtext-0)',
          fontWeight: isSelected ? 600 : 400,
          fontSize: '0.85rem',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(137, 180, 250, 0.05)' }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(!expanded) }}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
              display: 'flex',
              flexShrink: 0,
            }}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}

        {/* Folder icon */}
        {isSelected ? <FolderOpen size={15} /> : <Folder size={15} />}

        {/* Category name */}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {category.name}
        </span>

        {/* Article count badge */}
        {category.article_count > 0 && (
          <span style={{
            fontSize: '0.7rem',
            color: 'var(--color-overlay-0)',
            background: 'var(--color-surface-0)',
            borderRadius: '999px',
            padding: '0.1rem 0.4rem',
            flexShrink: 0,
          }}>
            {category.article_count}
          </span>
        )}
      </div>

      {/* Render children if expanded */}
      {expanded && hasChildren && (
        <KBCategoryTree
          categories={category.children}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={onSelectCategory}
          onCreateCategory={onCreateCategory}
          depth={depth + 1}
        />
      )}
    </div>
  )
}
