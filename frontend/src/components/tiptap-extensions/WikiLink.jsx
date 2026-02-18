/**
 * WikiLink - TipTap Inline Node Extension
 *
 * Renders [[wiki-style links]] between Knowledge Base articles.
 * Users type `[[` to trigger an autocomplete popup that searches
 * existing articles by title. Selecting an article inserts an inline
 * wikiLink node storing the target article's slug and title.
 *
 * Stored in TipTap JSON as:
 *   { type: 'wikiLink', attrs: { slug: 'my-article', title: 'My Article' } }
 *
 * Rendered as a styled inline link that navigates to /kb/:slug.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { createRoot } from 'react-dom/client'
import { kb } from '../../api/client'

/**
 * Inline component that renders a wiki link in the editor.
 * In read mode, acts as a navigation link. In edit mode, shows
 * the article title with wiki-link styling.
 */
function WikiLinkComponent({ node, editor }) {
  const { slug, title } = node.attrs

  function handleClick(e) {
    if (!editor.isEditable) {
      // In read mode, navigate to the article
      e.preventDefault()
      window.location.href = `/kb/${slug}`
    }
  }

  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <a
        href={`/kb/${slug}`}
        onClick={handleClick}
        className="kb-wiki-link"
        data-wiki-link={slug}
        title={title}
      >
        {title}
      </a>
    </NodeViewWrapper>
  )
}

/**
 * The TipTap Node extension definition.
 * Registers the wikiLink node type and the `[[` input trigger.
 */
const WikiLink = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      slug: { default: null },
      title: { default: 'Untitled' },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-wiki-link]',
        getAttrs: (dom) => ({
          slug: dom.getAttribute('data-wiki-link'),
          title: dom.textContent,
        }),
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-wiki-link': HTMLAttributes.slug,
        href: `/kb/${HTMLAttributes.slug}`,
        class: 'kb-wiki-link',
      }),
      HTMLAttributes.title || 'Untitled',
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(WikiLinkComponent)
  },

  addProseMirrorPlugins() {
    const extensionThis = this

    return [
      new Plugin({
        key: new PluginKey('wikiLinkTrigger'),
        props: {
          handleTextInput(view, from, to, text) {
            // Detect `[[` trigger — check if previous char is `[` and current is `[`
            const { state } = view
            if (text !== '[') return false

            const before = state.doc.textBetween(
              Math.max(0, from - 1),
              from,
              '\0'
            )
            if (before !== '[') return false

            // Remove the first `[` and don't insert the second
            const tr = state.tr.delete(from - 1, from)
            view.dispatch(tr)

            // Show the autocomplete popup
            showWikiLinkPopup(view, from - 1, extensionThis.type)
            return true
          },
        },
      }),
    ]
  },
})

/**
 * Creates and manages the autocomplete popup for wiki links.
 * Shows a floating dropdown near the cursor, fetches articles
 * matching the typed query, and inserts the selected article
 * as a wikiLink node.
 */
function showWikiLinkPopup(view, insertPos, nodeType) {
  // Create container for the popup
  const container = document.createElement('div')
  container.className = 'kb-wiki-link-popup'
  document.body.appendChild(container)

  const root = createRoot(container)

  function cleanup() {
    root.unmount()
    if (container.parentNode) {
      container.parentNode.removeChild(container)
    }
  }

  // Calculate position from cursor
  const coords = view.coordsAtPos(insertPos)

  root.render(
    <WikiLinkPopup
      coords={coords}
      onSelect={(article) => {
        // Insert the wikiLink node at the trigger position
        const { state } = view
        // Delete any typed search text between insertPos and current cursor
        const currentPos = state.selection.from
        let tr = state.tr
        if (currentPos > insertPos) {
          tr = tr.delete(insertPos, currentPos)
        }
        // Insert the wiki link node
        const node = nodeType.create({
          slug: article.slug,
          title: article.title,
        })
        tr = tr.insert(insertPos, node)
        view.dispatch(tr)
        view.focus()
        cleanup()
      }}
      onClose={() => {
        view.focus()
        cleanup()
      }}
      view={view}
      insertPos={insertPos}
    />
  )
}

/**
 * React component for the autocomplete popup.
 * Fetches articles matching the search query and renders
 * a dropdown list for selection.
 */
function WikiLinkPopup({ coords, onSelect, onClose, view, insertPos }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef(null)
  const searchTimeout = useRef(null)

  // Fetch articles on query change (debounced)
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)

    if (!query.trim()) {
      // Show recent articles when no query
      setLoading(true)
      kb.articles.list({ sort: 'updated_at', order: 'desc' })
        .then(articles => {
          setResults(articles.slice(0, 8))
          setSelectedIndex(0)
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
      return
    }

    searchTimeout.current = setTimeout(() => {
      setLoading(true)
      kb.articles.list({ search: query })
        .then(articles => {
          setResults(articles.slice(0, 8))
          setSelectedIndex(0)
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 200)

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [query])

  // Listen for keystrokes in the editor to capture typed text
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (results[selectedIndex]) {
          onSelect(results[selectedIndex])
        }
        return
      }

      if (e.key === ']') {
        // Close on ]] without inserting
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()
        setQuery(prev => prev.slice(0, -1))
        // Also delete from the editor
        const { state } = view
        const pos = state.selection.from
        if (pos > insertPos) {
          view.dispatch(state.tr.delete(pos - 1, pos))
        } else {
          onClose()
        }
        return
      }

      // Capture typed characters
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setQuery(prev => prev + e.key)
        // Insert the character into the editor at cursor
        const { state } = view
        const pos = state.selection.from
        view.dispatch(state.tr.insertText(e.key, pos))
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [results, selectedIndex, onSelect, onClose, view, insertPos])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={containerRef}
      className="kb-wiki-link-dropdown"
      style={{
        position: 'fixed',
        top: coords.bottom + 4,
        left: coords.left,
        zIndex: 9999,
      }}
    >
      <div className="kb-wiki-link-dropdown-header">
        Link to article{query && `: "${query}"`}
      </div>
      {loading && results.length === 0 && (
        <div className="kb-wiki-link-dropdown-empty">Searching...</div>
      )}
      {!loading && results.length === 0 && (
        <div className="kb-wiki-link-dropdown-empty">No articles found</div>
      )}
      {results.map((article, i) => (
        <button
          key={article.id}
          className={`kb-wiki-link-dropdown-item ${i === selectedIndex ? 'active' : ''}`}
          onClick={() => onSelect(article)}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          <span className="kb-wiki-link-dropdown-title">{article.title}</span>
          <span className="kb-wiki-link-dropdown-status">{article.status}</span>
        </button>
      ))}
    </div>
  )
}

export default WikiLink
