/**
 * ChatMarkdown.jsx - Markdown renderer for AI chat messages
 *
 * Thin wrapper around react-markdown with GitHub-flavored markdown
 * and syntax highlighting. Uses CSS variables so it works in both
 * Catppuccin and LCARS themes.
 */
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function ChatMarkdown({ content }) {
  if (!content) return null

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks with syntax highlighting
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          if (!inline && match) {
            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: '0.5rem 0',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  maxWidth: '100%',
                  overflowX: 'auto',
                }}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            )
          }
          // Inline code
          return (
            <code
              style={{
                background: 'var(--color-surface-0, rgba(255,255,255,0.08))',
                padding: '0.15em 0.35em',
                borderRadius: '4px',
                fontSize: '0.85em',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
              {...props}
            >
              {children}
            </code>
          )
        },

        // Tables
        table({ children }) {
          return (
            <div style={{ overflowX: 'auto', margin: '0.5rem 0' }}>
              <table style={{
                borderCollapse: 'collapse',
                fontSize: '0.82rem',
                width: '100%',
              }}>
                {children}
              </table>
            </div>
          )
        },
        th({ children }) {
          return (
            <th style={{
              border: '1px solid var(--color-surface-0, rgba(255,255,255,0.15))',
              padding: '0.375rem 0.625rem',
              textAlign: 'left',
              fontWeight: 600,
              background: 'var(--color-surface-0, rgba(255,255,255,0.05))',
            }}>
              {children}
            </th>
          )
        },
        td({ children }) {
          return (
            <td style={{
              border: '1px solid var(--color-surface-0, rgba(255,255,255,0.1))',
              padding: '0.375rem 0.625rem',
            }}>
              {children}
            </td>
          )
        },

        // Links
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--color-blue, #89b4fa)',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              {children}
            </a>
          )
        },

        // Paragraphs — tighter spacing for chat context
        p({ children }) {
          return <p style={{ margin: '0.4em 0' }}>{children}</p>
        },

        // Lists
        ul({ children }) {
          return <ul style={{ margin: '0.4em 0', paddingLeft: '1.25em' }}>{children}</ul>
        },
        ol({ children }) {
          return <ol style={{ margin: '0.4em 0', paddingLeft: '1.25em' }}>{children}</ol>
        },
        li({ children }) {
          return <li style={{ margin: '0.2em 0' }}>{children}</li>
        },

        // Blockquotes
        blockquote({ children }) {
          return (
            <blockquote style={{
              borderLeft: '3px solid var(--color-blue, #89b4fa)',
              margin: '0.5em 0',
              paddingLeft: '0.75em',
              color: 'var(--color-subtext-0, rgba(255,255,255,0.7))',
            }}>
              {children}
            </blockquote>
          )
        },

        // Horizontal rules
        hr() {
          return <hr style={{
            border: 'none',
            borderTop: '1px solid var(--color-surface-0, rgba(255,255,255,0.1))',
            margin: '0.75em 0',
          }} />
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
