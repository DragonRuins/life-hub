/**
 * NotificationSettings.jsx - Full Notification Configuration (Catppuccin Theme)
 *
 * Consolidates all notification configuration into one settings sub-page:
 *   - Settings: global toggle, quiet hours, priority, retention (GeneralTab)
 *   - Channels: manage delivery channels (Pushover, Discord, Email, etc.)
 *   - Intervals: per-interval notification delivery config
 *   - Rules: create/edit notification rules
 *   - History: paginated log of all sent notifications
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell, Settings, Radio, Wrench, ListChecks, History } from 'lucide-react'
import GeneralTab from '../notifications/GeneralTab'
import ChannelsTab from '../notifications/ChannelsTab'
import IntervalsTab from '../notifications/IntervalsTab'
import RulesTab from '../notifications/RulesTab'
import HistoryTab from '../notifications/HistoryTab'

const TABS = [
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'channels', label: 'Channels', icon: Radio },
  { key: 'intervals', label: 'Intervals', icon: Wrench },
  { key: 'rules', label: 'Rules', icon: ListChecks },
  { key: 'history', label: 'History', icon: History },
]

export default function NotificationSettings() {
  const [activeTab, setActiveTab] = useState('settings')

  return (
    <div>
      {/* Back link */}
      <Link
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--color-subtext-0)',
          textDecoration: 'none',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <Bell size={22} style={{ color: 'var(--color-blue)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Notifications</h1>
      </div>

      {/* Tab navigation */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--color-surface-0)',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--color-blue)' : '2px solid transparent',
                color: isActive ? 'var(--color-blue)' : 'var(--color-subtext-0)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.9rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {activeTab === 'settings' && <GeneralTab />}
      {activeTab === 'channels' && <ChannelsTab />}
      {activeTab === 'intervals' && <IntervalsTab />}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  )
}
