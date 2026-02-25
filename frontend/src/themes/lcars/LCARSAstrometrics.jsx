/**
 * LCARSAstrometrics.jsx - Astrometrics Lab (LCARS Theme)
 *
 * Star Trek-styled space data dashboard. The naming references
 * USS Voyager's Astrometrics lab. Uses pill-shaped tab buttons
 * and LCARS panels for content sections.
 *
 * Tab sections:
 *   - Sensor Overview: Summary widgets
 *   - Stellar Cartography: APOD viewer
 *   - Threat Assessment: NEO tracker
 *   - Station Tracking: ISS map + crew
 *   - Mission Operations: Launch tracker
 */
import { useState } from 'react'
import LCARSAstroOverview from '../../components/astrometrics/LCARSAstroOverview'
import LCARSAstroApod from '../../components/astrometrics/LCARSAstroApod'
import LCARSAstroNeo from '../../components/astrometrics/LCARSAstroNeo'
import LCARSAstroIssTracker from '../../components/astrometrics/LCARSAstroIssTracker'
import LCARSAstroLaunches from '../../components/astrometrics/LCARSAstroLaunches'

const TABS = [
  { id: 'overview', label: 'Sensor Overview' },
  { id: 'apod', label: 'Stellar Cartography' },
  { id: 'neo', label: 'Threat Assessment' },
  { id: 'iss', label: 'Station Tracking' },
  { id: 'launches', label: 'Mission Ops' },
]

export default function LCARSAstrometrics() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div style={{ padding: '0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <h1 style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '1.5rem',
          fontWeight: 400,
          color: 'var(--lcars-ice)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          margin: 0,
        }}>
          Astrometrics Lab
        </h1>
      </div>

      {/* Tab Navigation - LCARS pill buttons */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '1rem',
        flexWrap: 'wrap',
      }}>
        {TABS.map(tab => (
          <button
            className="lcars-element button rounded auto"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.4rem 1rem',
              background: activeTab === tab.id ? 'var(--lcars-ice)' : 'var(--lcars-gray)',
              border: 'none',
              height: 'auto',
              fontSize: '0.85rem',
              opacity: activeTab === tab.id ? 1 : 0.7,
              whiteSpace: 'nowrap',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Decorative horizontal rule */}
      <div style={{
        height: '3px',
        background: 'var(--lcars-ice)',
        borderRadius: '2px',
        marginBottom: '1rem',
        opacity: 0.4,
      }} />

      {/* Tab Content */}
      {activeTab === 'overview' && <LCARSAstroOverview />}
      {activeTab === 'apod' && <LCARSAstroApod />}
      {activeTab === 'neo' && <LCARSAstroNeo />}
      {activeTab === 'iss' && <LCARSAstroIssTracker />}
      {activeTab === 'launches' && <LCARSAstroLaunches />}
    </div>
  )
}
