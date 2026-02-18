/**
 * CollapsibleBlock - TipTap Node Extension
 *
 * Renders a collapsible details/summary section. Users click the
 * summary to expand/collapse the content body.
 *
 * Uses two nested nodes:
 *   - `collapsible` (wrapper) - the <details> element
 *   - `collapsibleSummary` (inline title) - the <summary> text
 *   - `collapsibleContent` (body) - the expandable content
 *
 * Stored in TipTap JSON as nested nodes with an `open` attribute.
 *
 * HTML output:
 *   <details data-collapsible>
 *     <summary>Click to expand</summary>
 *     <div data-collapsible-content><p>Hidden content...</p></div>
 *   </details>
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'

/**
 * React component for the collapsible wrapper node.
 */
function CollapsibleComponent({ node, updateAttributes, editor }) {
  const [open, setOpen] = useState(node.attrs.open ?? true)

  function toggleOpen() {
    const next = !open
    setOpen(next)
    updateAttributes({ open: next })
  }

  return (
    <NodeViewWrapper>
      <div className={`kb-collapsible ${open ? 'kb-collapsible-open' : ''}`} data-collapsible="">
        <div className="kb-collapsible-toggle" onClick={toggleOpen}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <NodeViewContent className="kb-collapsible-body" />
      </div>
    </NodeViewWrapper>
  )
}

/**
 * Summary node - the clickable title area of the collapsible.
 */
const CollapsibleSummary = Node.create({
  name: 'collapsibleSummary',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'summary' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes, { class: 'kb-collapsible-summary' }), 0]
  },
})

/**
 * Content node - the expandable body of the collapsible.
 */
const CollapsibleContent = Node.create({
  name: 'collapsibleContent',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-collapsible-content]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-collapsible-content': '' }), 0]
  },
})

/**
 * Main collapsible wrapper node.
 */
const CollapsibleBlock = Node.create({
  name: 'collapsible',
  group: 'block',
  content: 'collapsibleSummary collapsibleContent',
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: element => element.hasAttribute('open'),
        renderHTML: attributes => (attributes.open ? { open: '' } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'details[data-collapsible]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { 'data-collapsible': '', class: 'kb-collapsible' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleComponent)
  },

  addCommands() {
    return {
      setCollapsible: () => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: { open: true },
          content: [
            {
              type: 'collapsibleSummary',
              content: [{ type: 'text', text: 'Click to expand' }],
            },
            {
              type: 'collapsibleContent',
              content: [{ type: 'paragraph' }],
            },
          ],
        })
      },
    }
  },
})

// Export all three nodes - consumer must register all three
export { CollapsibleBlock, CollapsibleSummary, CollapsibleContent }
export default CollapsibleBlock
