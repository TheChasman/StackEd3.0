import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      insertCallout: () => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }, { tag: 'div.callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'callout',
        class: 'callout',
      }),
      0,
    ];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.className = 'callout my-4 p-4 rounded-lg bg-dark-700 border border-dark-600';
      dom.setAttribute('data-type', 'callout');
      dom.contentEditable = 'true';
      return { dom };
    };
  },

  addCommands() {
    return {
      insertCallout:
        () =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            content: [{ type: 'paragraph' }],
          });
        },
    };
  },
});
