/**
 * Astrometrics.jsx - Space & Astronomy Dashboard (Catppuccin Theme)
 *
 * Tab-based layout with 5 sections:
 *   - Overview: Summary widgets (APOD, launch countdown, ISS, NEOs, crew)
 *   - APOD: Astronomy Picture of the Day browser
 *   - NEOs: Near Earth Objects tracker
 *   - ISS Tracker: Live map + crew manifest + visible passes
 *   - Launches: Upcoming & past rocket launches
 */
import { useState } from 'react'
import AstroOverview from '../components/astrometrics/AstroOverview'
import AstroApod from '../components/astrometrics/AstroApod'
import AstroNeo from '../components/astrometrics/AstroNeo'
import AstroIssTracker from '../components/astrometrics/AstroIssTracker'
import AstroLaunches from '../components/astrometrics/AstroLaunches'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'apod', label: 'APOD' },
  { id: 'neo', label: 'NEOs' },
  { id: 'iss', label: 'ISS Tracker' },
  { id: 'launches', label: 'Launches' },
]

export default function Astrometrics() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
          Astrometrics
        </h1>
        <p style={{ color: 'var(--color-subtext-0)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
          Space data and astronomy dashboard
        </p>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          gap: '2px',
          marginBottom: '1.5rem',
          borderBottom: '2px solid var(--color-surface-0)',
          overflowX: 'auto',
        }}
      >
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.625rem 1.25rem',
              background: activeTab === tab.id ? 'var(--color-surface-0)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-blue)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--color-text)' : 'var(--color-subtext-0)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <AstroOverview />}
      {activeTab === 'apod' && <AstroApod />}
      {activeTab === 'neo' && <AstroNeo />}
      {activeTab === 'iss' && <AstroIssTracker />}
      {activeTab === 'launches' && <AstroLaunches />}
    </div>
  )
}
