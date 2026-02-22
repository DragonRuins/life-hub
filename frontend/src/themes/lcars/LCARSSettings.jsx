/**
 * LCARSSettings.jsx - LCARS-themed Settings Hub
 *
 * Central settings hub with:
 *   - Module cards linking to sub-pages (Vehicles, Astrometrics, Notifications)
 *   - Inline Color Scheme picker
 *
 * Theme engine toggle has moved to a dedicated header button.
 */
import { Link } from 'react-router-dom'
import { useTheme } from './ThemeProvider'
import { Car, Telescope, Bell, Bot } from 'lucide-react'
import LCARSPanel from './LCARSPanel'

/**
 * Color scheme definitions — same data as Settings.jsx, kept local to avoid
 * a shared dependency. Each has a key, label, type (light/dark), and swatches.
 */
const COLOR_SCHEME_GROUPS = [
  {
    family: 'Catppuccin',
    schemes: [
      { key: 'mocha', label: 'Mocha', type: 'dark', swatches: ['#1e1e2e', '#89b4fa', '#a6e3a1', '#f38ba8', '#cba6f7'] },
      { key: 'macchiato', label: 'Macchiato', type: 'dark', swatches: ['#24273a', '#8aadf4', '#a6da95', '#ed8796', '#c6a0f6'] },
      { key: 'frappe', label: 'Frappe', type: 'dark', swatches: ['#303446', '#8caaee', '#a6d189', '#e78284', '#ca9ee6'] },
      { key: 'latte', label: 'Latte', type: 'light', swatches: ['#eff1f5', '#1e66f5', '#40a02b', '#d20f39', '#8839ef'] },
    ],
  },
  {
    family: 'Rose Pine',
    schemes: [
      { key: 'rose-pine', label: 'Rose Pine', type: 'dark', swatches: ['#232136', '#9ccfd8', '#31748f', '#eb6f92', '#c4a7e7'] },
      { key: 'rose-pine-dawn', label: 'Dawn', type: 'light', swatches: ['#fffaf3', '#56949f', '#286983', '#b4637a', '#907aa9'] },
    ],
  },
  {
    family: 'Others',
    schemes: [
      { key: 'dracula', label: 'Dracula', type: 'dark', swatches: ['#282a36', '#8be9fd', '#50fa7b', '#ff5555', '#bd93f9'] },
      { key: 'gruvbox-dark', label: 'Gruvbox', type: 'dark', swatches: ['#32302f', '#83a598', '#b8bb26', '#fb4934', '#d3869b'] },
      { key: 'tokyo-night', label: 'Tokyo Night', type: 'dark', swatches: ['#1f2335', '#7aa2f7', '#9ece6a', '#f7768e', '#bb9af7'] },
      { key: 'solarized-dark', label: 'Sol. Dark', type: 'dark', swatches: ['#073642', '#268bd2', '#859900', '#dc322f', '#6c71c4'] },
      { key: 'solarized-light', label: 'Sol. Light', type: 'light', swatches: ['#fdf6e3', '#268bd2', '#859900', '#dc322f', '#6c71c4'] },
    ],
  },
]

/** Module card definitions */
const MODULE_CARDS = [
  {
    to: '/settings/vehicles',
    icon: Car,
    title: 'Vehicles',
    description: 'Default dashboard vehicle',
    color: 'var(--lcars-ice)',
  },
  {
    to: '/settings/astrometrics',
    icon: Telescope,
    title: 'Astrometrics',
    description: 'API key, reminders, thresholds',
    color: 'var(--lcars-african-violet)',
  },
  {
    to: '/settings/notifications',
    icon: Bell,
    title: 'Notifications',
    description: 'Toggle, quiet hours, priority',
    color: 'var(--lcars-butterscotch)',
  },
  {
    to: '/settings/ai',
    icon: Bot,
    title: 'AI Assistant',
    description: 'Model, system prompt, API key',
    color: 'var(--lcars-lilac)',
  },
]

export default function LCARSSettings() {
  const { isLCARS, colorScheme, setColorScheme } = useTheme()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Module Cards ──────────────────────────────────────── */}
      <LCARSPanel title="System Configuration" color="var(--lcars-sunflower)">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '0.5rem',
        }}>
          {MODULE_CARDS.map(card => (
            <LCARSModuleCard key={card.to} {...card} />
          ))}
        </div>
      </LCARSPanel>

      {/* ── Color Scheme Panel ───────────────────────────────── */}
      <LCARSPanel title="Color Scheme" color="var(--lcars-african-violet)">
        <p style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '0.85rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}>
          Standard theme color palette — applied when Catppuccin engine is active
        </p>
        {isLCARS && (
          <p style={{
            fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
            fontSize: '0.8rem',
            color: 'var(--lcars-tanoi)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '1rem',
          }}>
            Switch to Catppuccin engine to apply color scheme changes
          </p>
        )}

        {COLOR_SCHEME_GROUPS.map((group) => (
          <div key={group.family} style={{ marginBottom: '1.25rem' }}>
            {/* Group label */}
            <div style={{
              fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
              fontSize: '0.75rem',
              color: 'var(--lcars-african-violet)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: '0.5rem',
              paddingBottom: '0.25rem',
              borderBottom: '1px solid rgba(204, 153, 255, 0.2)',
            }}>
              {group.family}
            </div>

            {/* Scheme cards grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '0.5rem',
            }}>
              {group.schemes.map((scheme) => (
                <LCARSSchemeCard
                  key={scheme.key}
                  scheme={scheme}
                  isActive={colorScheme === scheme.key}
                  disabled={isLCARS}
                  onSelect={() => setColorScheme(scheme.key)}
                />
              ))}
            </div>
          </div>
        ))}
      </LCARSPanel>
    </div>
  )
}


/**
 * LCARS-styled module settings card — links to a settings sub-page.
 */
function LCARSModuleCard({ to, icon: Icon, title, description, color }) {
  return (
    <Link
      to={to}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: 'rgba(102, 102, 136, 0.08)',
        border: '2px solid rgba(102, 102, 136, 0.2)',
        borderRadius: '4px',
        textDecoration: 'none',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = color
        e.currentTarget.style.background = 'rgba(102, 102, 136, 0.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(102, 102, 136, 0.2)'
        e.currentTarget.style.background = 'rgba(102, 102, 136, 0.08)'
      }}
    >
      <Icon size={20} style={{ color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '0.9rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--lcars-space-white)',
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: "'Antonio', sans-serif",
          fontSize: '0.7rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: '2px',
        }}>
          {description}
        </div>
      </div>
    </Link>
  )
}


/**
 * LCARS-styled color scheme card with swatch strip.
 */
function LCARSSchemeCard({ scheme, isActive, disabled, onSelect }) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        padding: '0.75rem',
        background: isActive
          ? 'rgba(204, 153, 255, 0.12)'
          : 'rgba(102, 102, 136, 0.08)',
        border: isActive
          ? '2px solid var(--lcars-african-violet)'
          : '2px solid rgba(102, 102, 136, 0.2)',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        textAlign: 'left',
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        transition: 'border-color 0.15s ease, background 0.15s ease',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!disabled && !isActive) {
          e.currentTarget.style.borderColor = 'rgba(204, 153, 255, 0.4)'
        }
      }}
      onMouseLeave={e => {
        if (!disabled && !isActive) {
          e.currentTarget.style.borderColor = 'rgba(102, 102, 136, 0.2)'
        }
      }}
    >
      {/* Name + type badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.85rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: isActive ? 'var(--lcars-african-violet)' : 'var(--lcars-space-white)',
        }}>
          {scheme.label}
        </span>
        <span style={{
          fontSize: '0.6rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '1px 5px',
          borderRadius: '3px',
          background: scheme.type === 'light'
            ? 'rgba(255, 204, 102, 0.2)'
            : 'rgba(102, 102, 136, 0.3)',
          color: scheme.type === 'light'
            ? 'var(--lcars-tanoi)'
            : 'var(--lcars-gray)',
        }}>
          {scheme.type}
        </span>
      </div>

      {/* Swatch strip */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {scheme.swatches.map((color, i) => (
          <div
            key={i}
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: color,
              border: '1px solid rgba(255,255,255,0.1)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </button>
  )
}
