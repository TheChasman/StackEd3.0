import { Node, mergeAttributes } from '@tiptap/core'

export interface FootnoteOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnote: {
      addFootnote: (text: string) => ReturnType
    }
  }
}

export const Footnote = Node.create<FootnoteOptions>({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      content: {
        default: '',
      },
      index: {
        default: 1,
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'sup[data-type="footnote"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { 'data-type': 'footnote', class: 'cursor-pointer text-primary-500 font-bold hover:underline' }), 
       // We just render the index visually. The content is in attributes.
       // In a real app we'd need a mechanism to re-index them.
       // For this demo, we'll just show an asterisk or the stored index.
       HTMLAttributes.index.toString()
    ]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('sup')
      dom.className = 'cursor-pointer text-primary-500 font-bold hover:underline select-none bg-primary-100 dark:bg-primary-900/30 rounded px-0.5'
      dom.title = node.attrs.content
      
      // Calculate index based on position? 
      // Realtime re-indexing is heavy. We'll rely on a simpler "count" or just "*" for now, 
      // or try to calculate it.
      // Let's just use a static number stored in attrs for now, or a dynamic CSS counter if we could.
      // But since we need it in the node view, let's just grab the index from attrs.
      
      dom.textContent = node.attrs.index.toString()

      dom.onclick = () => {
        const newContent = prompt('Edit footnote:', node.attrs.content)
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (newContent !== null && pos !== undefined) {
          editor.commands.updateAttributes(pos as any, { content: newContent })
          dom.title = newContent
        }
      }

      return {
        dom,
      }
    }
  },

  addCommands() {
    return {
      addFootnote: (text) => ({ editor, tr, dispatch }) => {
         // Simple implementation: 
         // 1. Find how many footnotes exist to determine index
         let count = 1
         editor.state.doc.descendants((node) => {
            if (node.type.name === 'footnote') count++
         })
         
         return editor.chain().insertContent({ type: this.name, attrs: { content: text, index: count } }).run()
      },
    }
  },
})
