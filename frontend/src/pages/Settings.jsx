/**
 * Settings.jsx - Application Settings Page (Catppuccin Theme)
 *
 * Provides:
 *   - Theme Engine toggle (Catppuccin / LCARS)
 *   - Color Scheme selector with preview swatches
 *
 * Color scheme changes apply immediately (no save button needed).
 * Scheme selection only affects the standard/Catppuccin mode — LCARS
 * has its own fixed color palette.
 */
import { useTheme } from '../themes/lcars/ThemeProvider'
import { Monitor, Palette } from 'lucide-react'
import AstroSettingsSection from '../components/astrometrics/AstroSettingsSection'

/**
 * All available color schemes, grouped by family.
 * Each entry includes:
 *   - key: localStorage value and data-color-scheme attribute value
 *   - label: display name
 *   - type: 'dark' or 'light' (for badge display)
 *   - swatches: array of 5 hex colors [base, blue, green, red, mauve] for preview
 */
const COLOR_SCHEME_GROUPS = [
  {
    family: 'Catppuccin',
    schemes: [
      {
        key: 'mocha',
        label: 'Mocha',
        type: 'dark',
        swatches: ['#1e1e2e', '#89b4fa', '#a6e3a1', '#f38ba8', '#cba6f7'],
      },
      {
        key: 'macchiato',
        label: 'Macchiato',
        type: 'dark',
        swatches: ['#24273a', '#8aadf4', '#a6da95', '#ed8796', '#c6a0f6'],
      },
      {
        key: 'frappe',
        label: 'Frappe',
        type: 'dark',
        swatches: ['#303446', '#8caaee', '#a6d189', '#e78284', '#ca9ee6'],
      },
      {
        key: 'latte',
        label: 'Latte',
        type: 'light',
        swatches: ['#eff1f5', '#1e66f5', '#40a02b', '#d20f39', '#8839ef'],
      },
    ],
  },
  {
    family: 'Rose Pine',
    schemes: [
      {
        key: 'rose-pine',
        label: 'Rose Pine',
        type: 'dark',
        swatches: ['#232136', '#9ccfd8', '#31748f', '#eb6f92', '#c4a7e7'],
      },
      {
        key: 'rose-pine-dawn',
        label: 'Rose Pine Dawn',
        type: 'light',
        swatches: ['#fffaf3', '#56949f', '#286983', '#b4637a', '#907aa9'],
      },
    ],
  },
  {
    family: 'Others',
    schemes: [
      {
        key: 'dracula',
        label: 'Dracula',
        type: 'dark',
        swatches: ['#282a36', '#8be9fd', '#50fa7b', '#ff5555', '#bd93f9'],
      },
      {
        key: 'gruvbox-dark',
        label: 'Gruvbox Dark',
        type: 'dark',
        swatches: ['#32302f', '#83a598', '#b8bb26', '#fb4934', '#d3869b'],
      },
      {
        key: 'tokyo-night',
        label: 'Tokyo Night',
        type: 'dark',
        swatches: ['#1f2335', '#7aa2f7', '#9ece6a', '#f7768e', '#bb9af7'],
      },
      {
        key: 'solarized-dark',
        label: 'Solarized Dark',
        type: 'dark',
        swatches: ['#073642', '#268bd2', '#859900', '#dc322f', '#6c71c4'],
      },
      {
        key: 'solarized-light',
        label: 'Solarized Light',
        type: 'light',
        swatches: ['#fdf6e3', '#268bd2', '#859900', '#dc322f', '#6c71c4'],
      },
    ],
  },
]

export default function Settings() {
  const { theme, setTheme, isLCARS, colorScheme, setColorScheme } = useTheme()

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Settings
      </h1>

      {/* ── Theme Engine Section ─────────────────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Monitor size={18} style={{ color: 'var(--color-blue)' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Theme Engine</h2>
        </div>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Choose the visual framework for the entire application.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={isLCARS ? 'btn' : 'btn btn-primary'}
            onClick={() => setTheme('catppuccin')}
          >
            Catppuccin
          </button>
          <button
            className={isLCARS ? 'btn btn-primary' : 'btn'}
            onClick={() => setTheme('lcars')}
          >
            LCARS
          </button>
        </div>
      </div>

      {/* ── Astrometrics Section ──────────────────────────────── */}
      <AstroSettingsSection />

      {/* ── Color Scheme Section ─────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Palette size={18} style={{ color: 'var(--color-mauve)' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Color Scheme</h2>
        </div>
        <p style={{ color: 'var(--color-subtext-0)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Select a color palette for the standard theme. Changes apply immediately.
          {isLCARS && (
            <span style={{ display: 'block', marginTop: '0.5rem', color: 'var(--color-yellow)' }}>
              Color scheme selection is disabled while LCARS theme is active.
            </span>
          )}
        </p>

        {COLOR_SCHEME_GROUPS.map((group) => (
          <div key={group.family} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--color-subtext-0)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem',
            }}>
              {group.family}
            </h3>
            <div className="card-grid" style={{ '--min-card-width': '200px' }}>
              {group.schemes.map((scheme) => (
                <SchemeCard
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
      </div>
    </div>
  )
}


/**
 * Individual color scheme preview card.
 * Shows the scheme name, a swatch strip, and a light/dark badge.
 * Active scheme gets a highlighted border.
 */
function SchemeCard({ scheme, isActive, disabled, onSelect }) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1rem',
        background: 'var(--color-base)',
        border: isActive
          ? '2px solid var(--color-blue)'
          : '2px solid var(--color-surface-0)',
        borderRadius: '10px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s ease, opacity 0.15s ease',
        width: '100%',
      }}
      onMouseEnter={e => {
        if (!disabled && !isActive) {
          e.currentTarget.style.borderColor = 'var(--color-surface-2)'
        }
      }}
      onMouseLeave={e => {
        if (!disabled && !isActive) {
          e.currentTarget.style.borderColor = 'var(--color-surface-0)'
        }
      }}
    >
      {/* Scheme name + badge row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.9rem',
          fontWeight: isActive ? 600 : 500,
          color: isActive ? 'var(--color-blue)' : 'var(--color-text)',
        }}>
          {scheme.label}
        </span>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '2px 6px',
          borderRadius: '4px',
          background: scheme.type === 'light'
            ? 'rgba(249, 226, 175, 0.15)'
            : 'rgba(137, 180, 250, 0.1)',
          color: scheme.type === 'light'
            ? 'var(--color-yellow)'
            : 'var(--color-overlay-1)',
        }}>
          {scheme.type}
        </span>
      </div>

      {/* Color swatch strip */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {scheme.swatches.map((color, i) => (
          <div
            key={i}
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: color,
              border: '2px solid rgba(255,255,255,0.1)',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </button>
  )
}
