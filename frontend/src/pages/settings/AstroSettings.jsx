/**
 * AstroSettings.jsx - Astrometrics Settings Sub-Page (Catppuccin Theme)
 *
 * Wraps the existing AstroSettingsSection component with a page header
 * and back navigation link. All settings logic lives in the section component.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft, Telescope } from 'lucide-react'
import AstroSettingsSection from '../../components/astrometrics/AstroSettingsSection'

export default function AstroSettings() {
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
        <Telescope size={22} style={{ color: 'var(--color-blue)' }} />
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700 }}>Astrometrics Settings</h1>
      </div>

      <AstroSettingsSection />
    </div>
  )
}
