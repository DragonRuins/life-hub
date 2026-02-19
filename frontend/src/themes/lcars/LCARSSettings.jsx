/**
 * LCARSSettings.jsx - LCARS-themed Settings Page
 *
 * Same functionality as Settings.jsx but styled with LCARS visual language:
 * LCARSPanel wrappers, pill-shaped buttons, Antonio font, LCARS color palette.
 *
 * Color scheme selection is informational here — LCARS has its own fixed
 * palette, so scheme cards are disabled with a note when LCARS is active.
 */
import { useTheme } from './ThemeProvider'
import LCARSPanel from './LCARSPanel'
import LCARSAstroSettingsSection from '../../components/astrometrics/LCARSAstroSettingsSection'

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

export default function LCARSSettings() {
  const { theme, setTheme, isLCARS, colorScheme, setColorScheme } = useTheme()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* ── Theme Engine Panel ───────────────────────────────── */}
      <LCARSPanel title="Theme Engine" color="var(--lcars-ice)">
        <p style={{
          fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
          fontSize: '0.85rem',
          color: 'var(--lcars-gray)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '1rem',
        }}>
          Select Visual Framework
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <LCARSPillButton
            label="Catppuccin"
            color="var(--lcars-sunflower)"
            active={!isLCARS}
            onClick={() => setTheme('catppuccin')}
          />
          <LCARSPillButton
            label="LCARS"
            color="var(--lcars-butterscotch)"
            active={isLCARS}
            onClick={() => setTheme('lcars')}
          />
        </div>
      </LCARSPanel>

      {/* ── Astrometrics Panel ──────────────────────────────── */}
      <LCARSAstroSettingsSection />

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
 * LCARS pill-shaped toggle button.
 */
function LCARSPillButton({ label, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.5rem 1.5rem',
        background: active ? color : 'rgba(102, 102, 136, 0.3)',
        color: active ? '#000000' : 'var(--lcars-gray)',
        border: 'none',
        borderRadius: '20px',
        fontFamily: "'Antonio', 'Helvetica Neue', 'Arial Narrow', sans-serif",
        fontSize: '0.9rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        cursor: 'pointer',
        transition: 'filter 0.15s ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.2)' }}
      onMouseLeave={e => { e.currentTarget.style.filter = 'brightness(1)' }}
    >
      {label}
    </button>
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
