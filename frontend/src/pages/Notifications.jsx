/**
 * Notifications Page
 *
 * Main page for the notification system with five tabs:
 *   - Channels: manage delivery channels (Pushover, Discord, Email, etc.)
 *   - Intervals: per-interval notification delivery config (vehicle → interval → channels)
 *   - Rules: create/edit notification rules (event, scheduled, condition triggers)
 *   - History: paginated log of all sent notifications with stats
 *   - Settings: global notification settings (quiet hours, kill switch, etc.)
 */
import { useState } from 'react'
import { Radio, Wrench, ListChecks, History, Settings } from 'lucide-react'
import ChannelsTab from './notifications/ChannelsTab'
import IntervalsTab from './notifications/IntervalsTab'
import RulesTab from './notifications/RulesTab'
import HistoryTab from './notifications/HistoryTab'
import GeneralTab from './notifications/GeneralTab'

// Tab definitions: key is used for state, label is displayed, icon is the Lucide icon
const TABS = [
  { key: 'channels', label: 'Channels', icon: Radio },
  { key: 'intervals', label: 'Intervals', icon: Wrench },
  { key: 'rules', label: 'Rules', icon: ListChecks },
  { key: 'history', label: 'History', icon: History },
  { key: 'settings', label: 'Settings', icon: Settings },
]

export default function Notifications() {
  const [activeTab, setActiveTab] = useState('channels')

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Notifications
      </h1>

      {/* Tab navigation */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--color-surface-0)',
        marginBottom: '1.5rem',
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

      {/* Tab content - only the active tab renders */}
      {activeTab === 'channels' && <ChannelsTab />}
      {activeTab === 'intervals' && <IntervalsTab />}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'history' && <HistoryTab />}
      {activeTab === 'settings' && <GeneralTab />}
    </div>
  )
}
