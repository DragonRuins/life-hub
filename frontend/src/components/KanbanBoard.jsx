/**
 * KanbanBoard — Drag-and-drop kanban board using @dnd-kit.
 *
 * Renders columns in a horizontal scroll container. Each column has a
 * sortable task list and a quick-add input at the bottom. Supports
 * dragging tasks within a column (reorder) and between columns (move).
 * Uses optimistic updates — local state is updated immediately on drag,
 * then the API is called. On API failure the board reloads from server.
 *
 * Props:
 *   columns       - Array of column objects, each with .tasks array
 *   slug          - Project slug (for API calls)
 *   onTaskClick   - (task) => void — opens task detail modal
 *   onReload      - () => void — refetch columns from server
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { Plus, AlertTriangle } from 'lucide-react'
import { projects } from '../api/client'
import TaskCard from './TaskCard'

// ── Droppable Column Wrapper ────────────────────────────────────
// Makes the entire column area a valid drop target, even if empty.
function DroppableColumn({ id, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${id}` })
  return (
    <div
      ref={setNodeRef}
      style={{
        flex: 1,
        minHeight: '60px',
        borderRadius: '8px',
        transition: 'background 0.15s',
        background: isOver ? 'rgba(137, 180, 250, 0.05)' : 'transparent',
      }}
    >
      {children}
    </div>
  )
}

// ── Quick Add Input ──────────────────────────────────────────────
function QuickAdd({ columnId, slug, onCreated }) {
  const [value, setValue] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const title = value.trim()
    if (!title || creating) return

    setCreating(true)
    try {
      await projects.tasks.create(slug, { column_id: columnId, title })
      setValue('')
      onCreated()
    } catch (err) {
      console.error('Failed to create task:', err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{
      display: 'flex', gap: '0.25rem', marginTop: '0.5rem',
    }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add task..."
        disabled={creating}
        style={{
          flex: 1, fontSize: '0.8rem', padding: '0.35rem 0.5rem',
          background: 'var(--color-mantle)', border: '1px solid var(--color-surface-0)',
          borderRadius: '6px', color: 'var(--color-text)',
        }}
      />
      <button
        type="submit"
        disabled={creating || !value.trim()}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: value.trim() ? 'var(--color-blue)' : 'var(--color-overlay-0)',
          padding: '0.25rem', display: 'flex', alignItems: 'center',
        }}
      >
        <Plus size={16} />
      </button>
    </form>
  )
}


export default function KanbanBoard({ columns, slug, onTaskClick, onReload }) {
  // Local copy of columns for optimistic updates during drag
  const [localColumns, setLocalColumns] = useState(columns)
  const [activeTask, setActiveTask] = useState(null)

  // Sync local state when server data changes (e.g., after task create/edit)
  useEffect(() => {
    setLocalColumns(columns)
  }, [columns])

  // ── Sensors ────────────────────────────────────────────────
  // PointerSensor with activation distance prevents accidental drags on click
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  })
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 5 },
  })
  const sensors = useSensors(pointerSensor, touchSensor)

  // ── Helper: find which column contains a task ──────────────
  const findColumnOfTask = useCallback((taskId) => {
    for (const col of localColumns) {
      if (col.tasks.some((t) => t.id === taskId)) {
        return col
      }
    }
    return null
  }, [localColumns])

  // ── Drag Start ─────────────────────────────────────────────
  function handleDragStart(event) {
    const { active } = event
    const col = findColumnOfTask(active.id)
    if (col) {
      const task = col.tasks.find((t) => t.id === active.id)
      setActiveTask(task)
    }
  }

  // ── Drag Over (optimistic column move) ─────────────────────
  function handleDragOver(event) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    const sourceCol = findColumnOfTask(activeId)
    if (!sourceCol) return

    // Determine target column: is overId a task or a column droppable?
    let targetCol = null

    // Check if overId is a column droppable (prefixed with "column-")
    if (typeof overId === 'string' && overId.startsWith('column-')) {
      const colId = parseInt(overId.replace('column-', ''), 10)
      targetCol = localColumns.find((c) => c.id === colId)
    } else {
      // overId is a task — find which column contains it
      targetCol = findColumnOfTask(overId)
    }

    if (!targetCol || sourceCol.id === targetCol.id) return

    // Move the task optimistically to the target column
    setLocalColumns((prev) => {
      const next = prev.map((col) => ({ ...col, tasks: [...col.tasks] }))
      const srcIdx = next.findIndex((c) => c.id === sourceCol.id)
      const dstIdx = next.findIndex((c) => c.id === targetCol.id)
      if (srcIdx === -1 || dstIdx === -1) return prev

      // Remove from source
      const taskIdx = next[srcIdx].tasks.findIndex((t) => t.id === activeId)
      if (taskIdx === -1) return prev
      const [task] = next[srcIdx].tasks.splice(taskIdx, 1)

      // Find insertion index in target
      const overTaskIdx = next[dstIdx].tasks.findIndex((t) => t.id === overId)
      if (overTaskIdx !== -1) {
        next[dstIdx].tasks.splice(overTaskIdx, 0, task)
      } else {
        next[dstIdx].tasks.push(task)
      }

      return next
    })
  }

  // ── Drag End (persist to API) ──────────────────────────────
  async function handleDragEnd(event) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const activeId = active.id

    // Find the final column and position
    let targetCol = null
    let targetIndex = -1

    for (const col of localColumns) {
      const idx = col.tasks.findIndex((t) => t.id === activeId)
      if (idx !== -1) {
        targetCol = col
        targetIndex = idx
        break
      }
    }

    if (!targetCol) return

    // Calculate new sort_order values for all tasks in the target column
    // using gap-based ordering (1000, 2000, 3000, ...)
    const items = targetCol.tasks.map((task, i) => ({
      id: task.id,
      column_id: targetCol.id,
      sort_order: (i + 1) * 1000,
    }))

    try {
      await projects.tasks.batchReorder(slug, items)
      // Reload from server to get canonical state
      onReload()
    } catch (err) {
      console.error('Failed to reorder tasks:', err)
      // Revert optimistic update
      onReload()
    }
  }

  return (
    <div className="kanban-board-wrapper">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-scroll-container">
          {localColumns.map((column) => {
            const taskIds = column.tasks.map((t) => t.id)
            const isOverWip = column.wip_limit && column.tasks.length > column.wip_limit

            return (
              <div key={column.id} className="kanban-column">
                {/* Column Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  marginBottom: '0.75rem', padding: '0 0.25rem',
                }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: column.color || 'var(--color-overlay-0)', flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: '0.8rem', fontWeight: 600,
                    color: 'var(--color-text)', flex: 1,
                    textTransform: 'uppercase', letterSpacing: '0.03em',
                  }}>
                    {column.name}
                  </span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 500,
                    color: isOverWip ? 'var(--color-red)' : 'var(--color-overlay-0)',
                    display: 'flex', alignItems: 'center', gap: '0.2rem',
                  }}>
                    {isOverWip && <AlertTriangle size={11} />}
                    {column.tasks.length}
                    {column.wip_limit ? ` / ${column.wip_limit}` : ''}
                  </span>
                </div>

                {/* Sortable Task List */}
                <DroppableColumn id={column.id}>
                  <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {column.tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onClick={onTaskClick}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DroppableColumn>

                {/* Quick Add */}
                <QuickAdd
                  columnId={column.id}
                  slug={slug}
                  onCreated={onReload}
                />
              </div>
            )
          })}
        </div>

        {/* Drag Overlay — rendered outside normal DOM flow for smooth drag */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <TaskCard task={activeTask} isDragOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      <style>{`
        .kanban-board-wrapper {
          width: 100%;
          overflow: hidden;
        }
        .kanban-scroll-container {
          display: flex;
          gap: 1rem;
          overflow-x: auto;
          padding-bottom: 0.5rem;
          min-height: 200px;
        }
        .kanban-column {
          flex: 0 0 260px;
          min-width: 260px;
          display: flex;
          flex-direction: column;
          background: var(--color-mantle);
          border: 1px solid var(--color-surface-0);
          border-radius: 10px;
          padding: 0.75rem;
          max-height: calc(100dvh - 320px);
          overflow-y: auto;
        }
        @media (max-width: 768px) {
          .kanban-column {
            flex: 0 0 220px;
            min-width: 220px;
            max-height: calc(100dvh - 280px);
          }
        }
      `}</style>
    </div>
  )
}
