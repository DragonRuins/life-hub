/**
 * TagFilter - Tag list below the folder tree
 *
 * Shows all tags with note counts. Click to filter notes by tag.
 */
import { Tag } from 'lucide-react'

export default function TagFilter({ tags, activeTag, onSelectTag }) {
  return (
    <div>
      <div style={{
        padding: '0.25rem 0.625rem',
        marginBottom: '0.25rem',
      }}>
        <span style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-overlay-0)',
        }}>
          Tags
        </span>
      </div>

      {tags.map((tag) => (
        <button
          key={tag.id}
          onClick={() => onSelectTag(activeTag === tag.name ? null : tag.name)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            width: '100%',
            padding: '0.3rem 0.625rem',
            borderRadius: '5px',
            border: 'none',
            background: activeTag === tag.name ? 'var(--color-surface-0)' : 'transparent',
            color: activeTag === tag.name ? 'var(--color-text)' : 'var(--color-subtext-0)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            textAlign: 'left',
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: tag.color || 'var(--color-overlay-0)',
            flexShrink: 0,
          }} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tag.name}
          </span>
          {tag.note_count > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--color-overlay-0)' }}>
              {tag.note_count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
