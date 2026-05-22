import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core'
import katex from 'katex'

export interface LatexOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    latex: {
      insertLatex: () => ReturnType
    }
  }
}

export const Latex = Node.create<LatexOptions>({
  name: 'latex',
  group: 'block',
  atom: true,
  
  addAttributes() {
    return {
      code: {
        default: 'E = mc^2',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="latex"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'latex' })]
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div')
      dom.className = 'my-6 flex flex-col items-center'

      const preview = document.createElement('div')
      preview.className = 'px-4 py-2 text-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700 rounded transition-colors min-w-[100px] text-center'
      
      const editorContainer = document.createElement('div')
      editorContainer.className = 'hidden w-full max-w-md mt-2'
      
      const textarea = document.createElement('textarea')
      textarea.className = 'w-full p-2 bg-gray-50 dark:bg-dark-800 border border-gray-300 dark:border-dark-600 rounded font-mono text-sm focus:ring-primary-500 focus:border-primary-500'
      textarea.rows = 3
      textarea.value = node.attrs.code
      textarea.placeholder = 'Enter LaTeX code...'

      editorContainer.appendChild(textarea)

      const renderMath = (code: string) => {
        try {
            katex.render(code, preview, {
                throwOnError: false,
                displayMode: true
            })
            preview.classList.remove('text-red-500')
        } catch (e) {
            preview.textContent = 'Invalid LaTeX'
            preview.classList.add('text-red-500')
        }
      }

      // Initial render
      renderMath(node.attrs.code)

      // Events
      preview.onclick = () => {
        editorContainer.classList.toggle('hidden')
        if (!editorContainer.classList.contains('hidden')) {
            textarea.focus()
        }
      }

      textarea.addEventListener('input', (e) => {
        const newCode = (e.target as HTMLTextAreaElement).value
        renderMath(newCode)
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (pos !== undefined) {
            editor.commands.updateAttributes(pos as any, { code: newCode })
        }
      })

      // Close on blur if we want, but toggle is fine
      
      dom.appendChild(preview)
      dom.appendChild(editorContainer)

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'latex') return false
          if (updatedNode.attrs.code !== node.attrs.code) {
             textarea.value = updatedNode.attrs.code
             renderMath(updatedNode.attrs.code)
          }
          return true
        }
      }
    }
  },
  
  addInputRules() {
    return [
      nodeInputRule({
        find: /^\$\$\s$/,
        type: this.type,
      }),
    ]
  },

  addCommands() {
    return {
      insertLatex: () => ({ commands }) => {
        return commands.insertContent({ type: this.name })
      },
    }
  },
})
