/**
 * MermaidBlock - TipTap Node Extension
 *
 * Renders Mermaid diagrams (flowcharts, sequence diagrams, etc.) inline
 * in the editor. The Mermaid library is lazy-loaded via dynamic import
 * so it doesn't bloat the main bundle.
 *
 * In edit mode: shows a code textarea + live preview side-by-side.
 * In read mode: shows only the rendered SVG.
 *
 * Stored in TipTap JSON as a `mermaidBlock` node with `code` attribute.
 *
 * HTML output:
 *   <div data-mermaid-block><pre>graph TD; A-->B;</pre></div>
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useState, useEffect, useRef, useCallback } from 'react'

// Lazy-load mermaid only when needed
let mermaidInstance = null
let mermaidLoadPromise = null
let diagramCounter = 0

async function getMermaid() {
  if (mermaidInstance) return mermaidInstance
  if (mermaidLoadPromise) return mermaidLoadPromise

  mermaidLoadPromise = import('mermaid').then(mod => {
    mermaidInstance = mod.default
    mermaidInstance.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        primaryColor: '#89b4fa',
        primaryTextColor: '#cdd6f4',
        primaryBorderColor: '#585b70',
        lineColor: '#a6adc8',
        secondaryColor: '#f5c2e7',
        tertiaryColor: '#313244',
        background: '#1e1e2e',
        mainBkg: '#313244',
        nodeBorder: '#585b70',
        clusterBkg: '#181825',
        titleColor: '#cdd6f4',
        edgeLabelBackground: '#1e1e2e',
      },
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 14,
    })
    return mermaidInstance
  })

  return mermaidLoadPromise
}

/**
 * React component rendered for each mermaid node.
 */
function MermaidComponent({ node, updateAttributes, editor }) {
  const code = node.attrs.code || ''
  const isEditable = editor.isEditable
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(!code) // Start in edit mode if empty
  const renderTimeout = useRef(null)

  const renderDiagram = useCallback(async (diagramCode) => {
    if (!diagramCode.trim()) {
      setSvg('')
      setError(null)
      return
    }

    try {
      const mermaid = await getMermaid()
      diagramCounter += 1
      const id = `mermaid-${diagramCounter}-${Date.now()}`
      const { svg: renderedSvg } = await mermaid.render(id, diagramCode.trim())
      setSvg(renderedSvg)
      setError(null)
    } catch (err) {
      setError(err.message || 'Invalid Mermaid syntax')
      setSvg('')
    }
  }, [])

  // Render on mount and when code changes
  useEffect(() => {
    if (renderTimeout.current) clearTimeout(renderTimeout.current)
    renderTimeout.current = setTimeout(() => renderDiagram(code), 500)
    return () => clearTimeout(renderTimeout.current)
  }, [code, renderDiagram])

  function handleCodeChange(e) {
    updateAttributes({ code: e.target.value })
  }

  // Read-only mode: just show the SVG
  if (!isEditable) {
    return (
      <NodeViewWrapper>
        <div className="kb-mermaid">
          {svg ? (
            <div className="kb-mermaid-preview" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : error ? (
            <div className="kb-mermaid-error">Diagram error: {error}</div>
          ) : (
            <div className="kb-mermaid-empty">Empty diagram</div>
          )}
        </div>
      </NodeViewWrapper>
    )
  }

  // Edit mode: code editor + preview
  return (
    <NodeViewWrapper>
      <div className="kb-mermaid kb-mermaid-editing">
        <div className="kb-mermaid-header">
          <span className="kb-mermaid-label">Mermaid Diagram</span>
          <button
            className="kb-mermaid-toggle"
            onClick={() => setEditing(!editing)}
            type="button"
          >
            {editing ? 'Preview' : 'Edit'}
          </button>
        </div>

        {editing ? (
          <textarea
            className="kb-mermaid-code"
            value={code}
            onChange={handleCodeChange}
            placeholder="graph TD&#10;  A[Start] --> B[End]"
            rows={6}
            spellCheck={false}
          />
        ) : null}

        {/* Always show preview when we have SVG */}
        {svg && (
          <div className="kb-mermaid-preview" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
        {error && <div className="kb-mermaid-error">{error}</div>}
      </div>
    </NodeViewWrapper>
  )
}

/**
 * TipTap Node extension definition.
 */
const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true, // Non-editable content (we handle editing via the component)

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: element => {
          const pre = element.querySelector('pre')
          return pre ? pre.textContent : ''
        },
        renderHTML: () => ({}), // Rendered via the component
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-mermaid-block]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-mermaid-block': '', class: 'kb-mermaid' }),
      ['pre', {}, node.attrs.code || ''],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidComponent)
  },

  addCommands() {
    return {
      setMermaidBlock: (code = '') => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { code: code || 'graph TD\n  A[Start] --> B[End]' },
        })
      },
    }
  },
})

export default MermaidBlock
