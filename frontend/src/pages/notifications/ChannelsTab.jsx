/**
 * Channels Tab
 *
 * Manages notification delivery channels (Pushover, Discord, Email, In-App, SMS).
 * Shows a card grid of existing channels with:
 *   - Enable/disable toggle
 *   - Test button (sends a test notification)
 *   - Edit / Delete actions
 *   - "Add Channel" button that opens a modal with ChannelForm
 *
 * Channel configuration schemas are fetched from the backend so the form
 * fields are dynamic -- no hardcoded channel-specific knowledge here.
 */
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, X, Send, Radio, MessageSquare, Mail, Bell, Smartphone } from 'lucide-react'
import { notifications } from '../../api/client'
import ChannelForm from './ChannelForm'

// Map channel_type string to a display color (Catppuccin accent)
const TYPE_COLORS = {
  pushover: { bg: 'rgba(250, 179, 135, 0.1)', color: 'var(--color-peach)' },
  discord: { bg: 'rgba(203, 166, 247, 0.1)', color: 'var(--color-mauve)' },
  email: { bg: 'rgba(137, 180, 250, 0.1)', color: 'var(--color-blue)' },
  in_app: { bg: 'rgba(166, 227, 161, 0.1)', color: 'var(--color-green)' },
  sms: { bg: 'rgba(108, 112, 134, 0.1)', color: 'var(--color-overlay-0)' },
}

// Map channel_type string to a Lucide icon component
const TYPE_ICONS = {
  pushover: Radio,
  discord: MessageSquare,
  email: Mail,
  in_app: Bell,
  sms: Smartphone,
}

export default function ChannelsTab() {
  const [channelList, setChannelList] = useState([])
  const [schemas, setSchemas] = useState({})
  const [loading, setLoading] = useState(true)

  // Modal state for creating / editing channels
  const [showForm, setShowForm] = useState(false)
  const [editingChannel, setEditingChannel] = useState(null)

  // Track per-channel test status: { [channelId]: { status: 'sending'|'success'|'error', message: '' } }
  const [testStatus, setTestStatus] = useState({})

  // ── Data loading ────────────────────────────────────────────
  async function loadData() {
    try {
      const [channelData, schemaData] = await Promise.all([
        notifications.channels.list(),
        notifications.schemas(),
      ])
      setChannelList(channelData)
      setSchemas(schemaData)
    } catch (err) {
      console.error('Failed to load channels:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // ── Handlers ────────────────────────────────────────────────

  /** Create a new channel */
  async function handleCreate(data) {
    try {
      await notifications.channels.create(data)
      await loadData()
      setShowForm(false)
    } catch (err) {
      alert('Failed to create channel: ' + err.message)
    }
  }

  /** Update an existing channel */
  async function handleUpdate(data) {
    try {
      await notifications.channels.update(editingChannel.id, data)
      await loadData()
      setShowForm(false)
      setEditingChannel(null)
    } catch (err) {
      alert('Failed to update channel: ' + err.message)
    }
  }

  /** Toggle a channel's enabled/disabled state directly on the card */
  async function handleToggleEnabled(channel) {
    try {
      await notifications.channels.update(channel.id, { is_enabled: !channel.is_enabled })
      await loadData()
    } catch (err) {
      alert('Failed to toggle channel: ' + err.message)
    }
  }

  /** Send a test notification through a channel */
  async function handleTest(channelId) {
    setTestStatus(prev => ({ ...prev, [channelId]: { status: 'sending', message: '' } }))
    try {
      const result = await notifications.channels.test(channelId)
      setTestStatus(prev => ({ ...prev, [channelId]: { status: 'success', message: result.message } }))
      // Clear the success message after 4 seconds
      setTimeout(() => {
        setTestStatus(prev => {
          const next = { ...prev }
          delete next[channelId]
          return next
        })
      }, 4000)
    } catch (err) {
      setTestStatus(prev => ({ ...prev, [channelId]: { status: 'error', message: err.message } }))
    }
  }

  /** Delete a channel with confirmation */
  async function handleDelete(channelId) {
    if (!window.confirm('Delete this channel? Any rules linked to it will lose this delivery target.')) return
    try {
      await notifications.channels.delete(channelId)
      await loadData()
    } catch (err) {
      alert('Failed to delete channel: ' + err.message)
    }
  }

  /** Open the edit form modal for an existing channel */
  function startEdit(channel) {
    setEditingChannel(channel)
    setShowForm(true)
  }

  /** Close the form modal and clear editing state */
  function closeForm() {
    setShowForm(false)
    setEditingChannel(null)
  }

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return <p style={{ color: 'var(--color-subtext-0)' }}>Loading channels...</p>
  }

  return (
    <div>
      {/* Header with add button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.875rem' }}>
          {channelList.length} channel{channelList.length !== 1 ? 's' : ''} configured
        </p>
        <button className="btn btn-primary" onClick={() => { setEditingChannel(null); setShowForm(true) }}>
          <Plus size={16} />
          Add Channel
        </button>
      </div>

      {/* Channel cards grid */}
      {channelList.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--color-subtext-0)' }}>
            No channels yet. Add a delivery channel to start sending notifications.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
          {channelList.map(channel => {
            const typeStyle = TYPE_COLORS[channel.channel_type] || TYPE_COLORS.in_app
            const TypeIcon = TYPE_ICONS[channel.channel_type] || Radio
            const test = testStatus[channel.id]
            // Look up display name from schemas (fallback to channel_type)
            const displayName = schemas[channel.channel_type]?.display_name || channel.channel_type

            return (
              <div key={channel.id} className="card" style={{ opacity: channel.is_enabled ? 1 : 0.6 }}>
                {/* Top row: icon, name, type badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: typeStyle.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <TypeIcon size={18} style={{ color: typeStyle.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {channel.name}
                    </div>
                    <span style={{
                      fontSize: '0.7rem', padding: '0.1rem 0.5rem', borderRadius: '4px',
                      background: typeStyle.bg, color: typeStyle.color,
                    }}>
                      {displayName}
                    </span>
                  </div>
                </div>

                {/* Enabled toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <button
                    onClick={() => handleToggleEnabled(channel)}
                    style={{
                      width: '40px', height: '22px', borderRadius: '11px', border: 'none', cursor: 'pointer',
                      background: channel.is_enabled ? 'var(--color-green)' : 'var(--color-surface-1)',
                      position: 'relative', transition: 'background 0.2s ease',
                    }}
                    title={channel.is_enabled ? 'Disable channel' : 'Enable channel'}
                  >
                    <span style={{
                      position: 'absolute', top: '2px',
                      left: channel.is_enabled ? '20px' : '2px',
                      width: '18px', height: '18px', borderRadius: '50%',
                      background: 'white', transition: 'left 0.2s ease',
                    }} />
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-subtext-0)' }}>
                    {channel.is_enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>

                {/* Test result (if any) */}
                {test && (
                  <div style={{
                    fontSize: '0.75rem', padding: '0.375rem 0.625rem', borderRadius: '6px', marginBottom: '0.75rem',
                    background: test.status === 'success' ? 'rgba(166, 227, 161, 0.1)' :
                               test.status === 'error' ? 'rgba(243, 139, 168, 0.1)' :
                               'rgba(137, 180, 250, 0.1)',
                    color: test.status === 'success' ? 'var(--color-green)' :
                           test.status === 'error' ? 'var(--color-red)' :
                           'var(--color-blue)',
                  }}>
                    {test.status === 'sending' ? 'Sending test...' : test.message}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem', flex: 1 }}
                    onClick={() => handleTest(channel.id)}
                    disabled={test?.status === 'sending'}
                  >
                    <Send size={14} />
                    Test
                  </button>
                  <button
                    className="btn btn-ghost"
                    style={{ fontSize: '0.8rem' }}
                    onClick={() => startEdit(channel)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.8rem' }}
                    onClick={() => handleDelete(channel.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Channel Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', margin: '1rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {editingChannel ? 'Edit Channel' : 'Add Channel'}
              </h2>
              <button className="btn btn-ghost" onClick={closeForm}>
                <X size={18} />
              </button>
            </div>
            <ChannelForm
              channel={editingChannel}
              schemas={schemas}
              onSubmit={editingChannel ? handleUpdate : handleCreate}
              onCancel={closeForm}
            />
          </div>
        </div>
      )}
    </div>
  )
}
