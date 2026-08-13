import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pullquote: {
      insertPullquote: () => ReturnType;
    };
  }
}

export const Pullquote = Node.create({
  name: 'pullquote',
  group: 'block',
  content: 'inline*',
  defining: true,

  addAttributes() {
    return {
      align: { default: 'center' },
      color: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'blockquote[data-type="pullquote"]' }, { tag: 'div.pullquote' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'blockquote',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'pullquote',
        class: 'pullquote',
        style: HTMLAttributes.color ? `color: ${HTMLAttributes.color};` : '',
      }),
      0,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('blockquote');
      dom.className =
        'pullquote my-6 px-4 py-2 text-xl font-semibold italic border-l-4 border-primary-500 text-dark-100';
      dom.setAttribute('data-type', 'pullquote');
      if (node.attrs.color) dom.style.color = node.attrs.color;
      dom.contentEditable = 'true';
      return { dom };
    };
  },

  addCommands() {
    return {
      insertPullquote:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, content: [{ type: 'text', text: '' }] });
        },
    };
  },
});
