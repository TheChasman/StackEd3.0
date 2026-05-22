import { Node, mergeAttributes, textblockTypeInputRule } from '@tiptap/core'

export interface PoetryOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    poetry: {
      setPoetry: () => ReturnType
      togglePoetry: () => ReturnType
    }
  }
}

export const Poetry = Node.create<PoetryOptions>({
  name: 'poetry',
  content: 'text*',
  group: 'block',
  marks: '_', // Allow all marks
  code: false,
  defining: true,
  
  addAttributes() {
    return {
      class: {
        default: 'poetry-block',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[class="poetry-block"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 
        class: 'poetry-block whitespace-pre-wrap font-serif italic text-lg pl-8 border-l-2 border-gray-300 dark:border-dark-600 my-4 py-2' 
    }), 0]
  },

  addCommands() {
    return {
      setPoetry: () => ({ commands }) => {
        return commands.setNode(this.name)
      },
      togglePoetry: () => ({ commands }) => {
        return commands.toggleNode(this.name, 'paragraph')
      },
    }
  },
  
  addKeyboardShortcuts() {
    return {
      'Mod-Alt-p': () => this.editor.commands.togglePoetry(),
    }
  },
})
