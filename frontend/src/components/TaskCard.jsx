/**
 * TaskCard — Draggable kanban task card.
 *
 * Uses @dnd-kit/sortable for drag-and-drop within and between columns.
 * Shows title, priority (colored left border), labels, due date, and
 * estimated hours. Clicking opens the task detail modal.
 */
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Calendar, Clock } from 'lucide-react'

// Priority → left-border color mapping (Catppuccin palette)
const PRIORITY_COLORS = {
  low: 'var(--color-overlay-0)',
  normal: 'var(--color-blue)',
  high: 'var(--color-peach)',
  critical: 'var(--color-red)',
}

export default function TaskCard({ task, onClick, isDragOverlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const borderColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.normal
  const isOverdue = task.due_date && !task.completed_at && new Date(task.due_date) < new Date()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Don't open modal during drag
        if (!isDragging && onClick) {
          e.stopPropagation()
          onClick(task)
        }
      }}
      className="task-card"
      data-overlay={isDragOverlay || undefined}
    >
      {/* Priority left border */}
      <div style={{
        position: 'absolute', left: 0, top: '6px', bottom: '6px',
        width: '3px', borderRadius: '0 2px 2px 0',
        background: borderColor,
      }} />

      {/* Title */}
      <div style={{
        fontSize: '0.825rem', fontWeight: 500, lineHeight: 1.35,
        color: 'var(--color-text)', paddingLeft: '0.5rem',
        wordBreak: 'break-word',
      }}>
        {task.title}
      </div>

      {/* Metadata row: labels + due date + hours */}
      {(task.labels?.length > 0 || task.due_date || task.estimated_hours) && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.25rem',
          paddingLeft: '0.5rem', marginTop: '0.375rem',
          alignItems: 'center',
        }}>
          {/* Labels */}
          {task.labels?.map((label) => (
            <span key={label} style={{
              fontSize: '0.6rem', fontWeight: 600, padding: '0.05rem 0.35rem',
              borderRadius: '4px', background: 'var(--color-surface-1)',
              color: 'var(--color-subtext-0)', textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}>
              {label}
            </span>
          ))}

          {/* Due date */}
          {task.due_date && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
              fontSize: '0.65rem', fontWeight: 500,
              color: isOverdue ? 'var(--color-red)' : 'var(--color-subtext-0)',
            }}>
              <Calendar size={10} />
              {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}

          {/* Estimated hours */}
          {task.estimated_hours && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
              fontSize: '0.65rem', color: 'var(--color-subtext-0)',
            }}>
              <Clock size={10} />
              {task.estimated_hours}h
            </span>
          )}
        </div>
      )}

      <style>{`
        .task-card {
          position: relative;
          background: var(--color-base);
          border: 1px solid var(--color-surface-0);
          border-radius: 8px;
          padding: 0.5rem 0.5rem 0.5rem 0.25rem;
          cursor: grab;
          transition: border-color 0.15s, box-shadow 0.15s;
          touch-action: manipulation;
        }
        .task-card:hover {
          border-color: var(--color-surface-1);
        }
        .task-card:active {
          cursor: grabbing;
        }
        .task-card[data-overlay] {
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
          cursor: grabbing;
        }
      `}</style>
    </div>
  )
}
