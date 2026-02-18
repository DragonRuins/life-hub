/**
 * AttachmentPicker - Modal for uploading and selecting media
 *
 * Two tabs:
 *   Upload  — drag-and-drop zone + file input with upload progress
 *   Library — grid of existing attachments with search and type filter
 *
 * Props:
 *   open       — boolean, whether the modal is visible
 *   onClose    — callback to close the modal
 *   onSelect   — callback(attachment) when an attachment is chosen
 *   noteId     — optional, links uploaded files to this note automatically
 *   mode       — 'image' | 'file' — filters library view and accepted file types
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Upload, Image as ImageIcon, FileText, Search, X, Loader2 } from 'lucide-react'
import { attachments } from '../../api/client'

export default function AttachmentPicker({ open, onClose, onSelect, noteId, mode = 'image' }) {
  const [tab, setTab] = useState('upload') // 'upload' | 'library'
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [dragOver, setDragOver] = useState(false)

  // Library state
  const [libraryItems, setLibraryItems] = useState([])
  const [librarySearch, setLibrarySearch] = useState('')
  const [libraryLoading, setLibraryLoading] = useState(false)

  const fileInputRef = useRef(null)

  // Load library when tab switches to 'library'
  useEffect(() => {
    if (open && tab === 'library') {
      loadLibrary()
    }
  }, [open, tab])

  async function loadLibrary() {
    setLibraryLoading(true)
    try {
      const params = {}
      if (librarySearch) params.search = librarySearch
      if (mode === 'image') params.mime_type = 'image'
      const items = await attachments.list(params)
      setLibraryItems(items)
    } catch (err) {
      console.error('Failed to load library:', err)
    } finally {
      setLibraryLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    if (tab !== 'library') return
    const timer = setTimeout(() => loadLibrary(), 300)
    return () => clearTimeout(timer)
  }, [librarySearch])

  async function handleUpload(file) {
    if (!file) return
    setUploading(true)
    setUploadError(null)

    try {
      const result = await attachments.upload(file, noteId)
      onSelect(result)
      onClose()
    } catch (err) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave(e) {
    e.preventDefault()
    setDragOver(false)
  }

  function handleLibrarySelect(item) {
    onSelect(item)
    onClose()
  }

  if (!open) return null

  const acceptTypes = mode === 'image'
    ? 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml'
    : '*/*'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 1000,
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(560px, calc(100vw - 2rem))',
        maxHeight: 'min(500px, calc(100vh - 4rem))',
        background: 'var(--color-base)',
        border: '1px solid var(--color-surface-0)',
        borderRadius: '12px',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--color-surface-0)',
        }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <TabButton
              active={tab === 'upload'}
              onClick={() => setTab('upload')}
              label="Upload"
            />
            <TabButton
              active={tab === 'library'}
              onClick={() => setTab('library')}
              label="Library"
            />
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-overlay-0)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '1rem' }}>
          {tab === 'upload' ? (
            <UploadTab
              dragOver={dragOver}
              uploading={uploading}
              uploadError={uploadError}
              acceptTypes={acceptTypes}
              mode={mode}
              fileInputRef={fileInputRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onFileInput={handleFileInput}
            />
          ) : (
            <LibraryTab
              items={libraryItems}
              loading={libraryLoading}
              search={librarySearch}
              onSearchChange={setLibrarySearch}
              onSelect={handleLibrarySelect}
              mode={mode}
            />
          )}
        </div>
      </div>
    </>
  )
}


/* ── Tab Button ─────────────────────────────────────────── */

function TabButton({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.35rem 0.75rem',
        borderRadius: '6px',
        border: 'none',
        fontSize: '0.8rem',
        fontWeight: active ? 600 : 400,
        background: active ? 'var(--color-surface-1)' : 'transparent',
        color: active ? 'var(--color-text)' : 'var(--color-subtext-0)',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}


/* ── Upload Tab ─────────────────────────────────────────── */

function UploadTab({
  dragOver, uploading, uploadError, acceptTypes, mode,
  fileInputRef, onDrop, onDragOver, onDragLeave, onFileInput,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--color-blue)' : 'var(--color-surface-1)'}`,
          borderRadius: '10px',
          padding: '2.5rem 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: uploading ? 'default' : 'pointer',
          background: dragOver ? 'rgba(137, 180, 250, 0.05)' : 'transparent',
          transition: 'all 0.15s ease',
        }}
      >
        {uploading ? (
          <>
            <Loader2 size={32} style={{ color: 'var(--color-blue)', animation: 'spin 1s linear infinite' }} />
            <span style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem' }}>
              Uploading...
            </span>
          </>
        ) : (
          <>
            <Upload size={32} style={{ color: 'var(--color-overlay-0)' }} />
            <span style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', textAlign: 'center' }}>
              Drag & drop a file here, or click to browse
            </span>
            <span style={{ color: 'var(--color-overlay-0)', fontSize: '0.75rem' }}>
              {mode === 'image' ? 'PNG, JPG, GIF, WebP, SVG' : 'Any file type'}
            </span>
          </>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        onChange={onFileInput}
        style={{ display: 'none' }}
      />

      {/* Error message */}
      {uploadError && (
        <div style={{
          padding: '0.5rem 0.75rem',
          background: 'rgba(243, 139, 168, 0.1)',
          border: '1px solid rgba(243, 139, 168, 0.3)',
          borderRadius: '6px',
          color: 'var(--color-red)',
          fontSize: '0.8rem',
        }}>
          {uploadError}
        </div>
      )}

      {/* Spinner keyframes (injected once) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}


/* ── Library Tab ────────────────────────────────────────── */

function LibraryTab({ items, loading, search, onSearchChange, onSelect, mode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '0.6rem',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--color-overlay-0)',
          }}
        />
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.4rem 0.6rem 0.4rem 2rem',
            fontSize: '0.8rem',
            background: 'var(--color-surface-0)',
            border: '1px solid var(--color-surface-1)',
            borderRadius: '6px',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '2rem',
          color: 'var(--color-overlay-0)',
        }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          color: 'var(--color-overlay-0)',
          fontSize: '0.85rem',
        }}>
          {search ? 'No files match your search' : 'No files uploaded yet'}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: '0.5rem',
        }}>
          {items.map((item) => (
            <LibraryItem key={item.id} item={item} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}


function LibraryItem({ item, onSelect }) {
  const isImage = item.mime_type?.startsWith('image/')
  const fileUrl = attachments.fileUrl(item.id)

  // Format file size
  function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <button
      onClick={() => onSelect(item)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.5rem',
        background: 'var(--color-surface-0)',
        border: '1px solid var(--color-surface-1)',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-blue)'}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-surface-1)'}
    >
      {/* Preview */}
      <div style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: '4px',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-mantle)',
      }}>
        {isImage ? (
          <img
            src={fileUrl}
            alt={item.filename}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <FileText size={28} style={{ color: 'var(--color-overlay-0)' }} />
        )}
      </div>

      {/* File info */}
      <div style={{
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.7rem',
          color: 'var(--color-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.filename}
        </div>
        <div style={{
          fontSize: '0.65rem',
          color: 'var(--color-overlay-0)',
        }}>
          {formatSize(item.size_bytes)}
        </div>
      </div>
    </button>
  )
}
