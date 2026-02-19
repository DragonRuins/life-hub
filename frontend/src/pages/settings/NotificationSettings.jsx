/**
 * NotificationSettings.jsx - Notification Settings Sub-Page (Catppuccin Theme)
 *
 * Wraps the existing GeneralTab component with a page header and back
 * navigation link. All settings logic (global toggle, quiet hours,
 * priority, retention) lives in GeneralTab.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell } from 'lucide-react'
import GeneralTab from '../notifications/GeneralTab'

export default function NotificationSettings() {
  return (
    <div style={{ maxWidth: '900px' }}>
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
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Notification Settings</h1>
      </div>

      <GeneralTab />
    </div>
  )
}
