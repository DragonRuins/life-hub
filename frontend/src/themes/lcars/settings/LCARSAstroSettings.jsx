/**
 * LCARSAstroSettings.jsx - Astrometrics Settings Sub-Page (LCARS Theme)
 *
 * Wraps the existing LCARSAstroSettingsSection with page-level
 * back navigation. All settings logic lives in the section component.
 */
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import LCARSAstroSettingsSection from '../../../components/astrometrics/LCARSAstroSettingsSection'

export default function LCARSAstroSettings() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Back link */}
      <Link
        to="/settings"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          color: 'var(--lcars-ice)',
          textDecoration: 'none',
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.85rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        <ArrowLeft size={16} />
        Settings
      </Link>

      <LCARSAstroSettingsSection />
    </div>
  )
}
