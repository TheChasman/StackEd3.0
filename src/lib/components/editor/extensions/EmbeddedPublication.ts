import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embeddedPublication: {
      insertEmbeddedPublication: (url: string) => ReturnType
    }
  }
}

export const EmbeddedPublication = Node.create({
  name: 'embeddedPublication',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
    }
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="embedded-publication"]' },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'embedded-publication',
        class: 'embedded-publication my-4 p-3 border border-dark-600 rounded',
      }),
      ['a', { href: HTMLAttributes.url, target: '_blank', class: 'text-primary-400 text-sm' }, HTMLAttributes.url || 'Embedded publication'],
    ]
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div')
      dom.className = 'embedded-publication my-4 p-3 border border-dark-600 rounded select-none'
      dom.setAttribute('data-type', 'embedded-publication')
      dom.contentEditable = 'false'

      const link = document.createElement('a')
      link.href = String(node.attrs.url ?? '')
      link.target = '_blank'
      link.className = 'text-primary-400 text-sm hover:underline'
      link.textContent = String(node.attrs.url ?? 'Embedded publication')
      dom.appendChild(link)

      return { dom }
    }
  },

  addCommands() {
    return {
      insertEmbeddedPublication: (url: string) => ({ commands }) => {
        return commands.insertContent({ type: this.name, attrs: { url } })
      },
    }
  },
})
