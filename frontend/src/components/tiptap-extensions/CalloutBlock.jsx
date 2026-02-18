/**
 * CalloutBlock - TipTap Node Extension
 *
 * Renders callout/admonition blocks with 4 types:
 *   - info (blue) - General information
 *   - warning (yellow) - Caution notices
 *   - tip (green) - Helpful tips
 *   - danger (red) - Critical warnings
 *
 * Usage in editor: Insert via toolbar or slash command.
 * Stored in TipTap JSON as a `callout` node with `type` attribute.
 *
 * HTML output:
 *   <div data-callout="info"><p>Content here...</p></div>
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { Info, AlertTriangle, Lightbulb, ShieldAlert } from 'lucide-react'

// Callout type configuration
const CALLOUT_TYPES = {
  info: { icon: Info, label: 'Info' },
  warning: { icon: AlertTriangle, label: 'Warning' },
  tip: { icon: Lightbulb, label: 'Tip' },
  danger: { icon: ShieldAlert, label: 'Danger' },
}

/**
 * React component rendered inside the editor for each callout node.
 */
function CalloutComponent({ node, updateAttributes, editor }) {
  const calloutType = node.attrs.type || 'info'
  const config = CALLOUT_TYPES[calloutType] || CALLOUT_TYPES.info
  const Icon = config.icon
  const isEditable = editor.isEditable

  return (
    <NodeViewWrapper>
      <div className={`kb-callout kb-callout-${calloutType}`} data-callout={calloutType}>
        <div className="kb-callout-header">
          <Icon size={16} className="kb-callout-icon" />
          <span className="kb-callout-label">{config.label}</span>
          {isEditable && (
            <select
              className="kb-callout-type-select"
              value={calloutType}
              onChange={e => updateAttributes({ type: e.target.value })}
              onClick={e => e.stopPropagation()}
            >
              {Object.entries(CALLOUT_TYPES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          )}
        </div>
        <NodeViewContent className="kb-callout-content" />
      </div>
    </NodeViewWrapper>
  )
}

/**
 * TipTap Node extension definition.
 */
const CalloutBlock = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-callout') || 'info',
        renderHTML: attributes => ({ 'data-callout': attributes.type }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: `kb-callout kb-callout-${HTMLAttributes['data-callout'] || 'info'}` }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent)
  },

  addCommands() {
    return {
      setCallout: (type = 'info') => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { type },
          content: [{ type: 'paragraph' }],
        })
      },
    }
  },
})

export default CalloutBlock
