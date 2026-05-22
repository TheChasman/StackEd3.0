import { Node, mergeAttributes } from '@tiptap/core'

export const Paywall = Node.create({
  name: 'paywall',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      'data-type': {
        default: 'paywall',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'hr[data-type="paywall"]',
      },
      // Handle standard paywall markers if we ever import
      {
        tag: 'div[data-paywall="true"]',
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    // This is the critical output for Substack:
    // An <hr> element that they will (hopefully) treat as a divider,
    // followed by our clear instruction.
    // Note: We can't output multiple root elements from renderHTML in standard Schema,
    // but we can nest them or rely on the fact that we're a block node.
    // Best approach for export: A single container div or just the HR if we want simplicity.
    
    // However, spec asked for:
    // <hr style="...">
    // <p>...warning...</p>
    
    // Tiptap's renderHTML usually expects a single DOM structure.
    // For the *visual* editor, we use addNodeView (below).
    // For *export* (HTML serialization), we customize here.
    
    return ['div', { class: 'paywall-wrapper' }, 
      ['hr', mergeAttributes(HTMLAttributes, {
        style: 'border: none; border-top: 2px dashed red; margin: 2em 0;',
      })],
      ['p', {
        style: 'color: red; text-align: center; font-size: 0.8em; font-weight: bold; font-family: sans-serif; margin-top: -1em; background: #fff0f0; padding: 4px; display: inline-block; position: relative; left: 50%; transform: translateX(-50%);'
      }, '⚠️ SUBSTACK PAYWALL MARKER: Click the Paywall button in Substack here ⚠️']
    ]
  },

  addNodeView() {
    return ({ editor, getPos }) => {
      const dom = document.createElement('div')
      dom.className = 'paywall-node my-8 relative group select-none'
      dom.contentEditable = 'false'
      
      // The line
      const hr = document.createElement('hr')
      hr.className = 'border-t-2 border-dashed border-red-500/50 w-full'
      dom.appendChild(hr)
      
      // The label
      const label = document.createElement('div')
      label.className = 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-900/90 text-red-100 text-xs font-bold px-3 py-1 rounded border border-red-500/50 shadow-lg flex items-center gap-2'
      label.innerHTML = `
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        <span>PAYWALL MARKER</span>
      `
      dom.appendChild(label)
      
      // Hover instruction
      const hint = document.createElement('div')
      hint.className = 'absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap'
      hint.innerText = 'Will appear as a divider. You MUST click Substack\'s Paywall button here.'
      dom.appendChild(hint)

      return {
        dom,
      }
    }
  },
})
