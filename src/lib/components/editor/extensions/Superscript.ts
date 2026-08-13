import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    superscript: {
      toggleSuperscript: () => ReturnType;
    };
  }
}

export const Superscript = Mark.create({
  name: 'superscript',

  parseHTML() {
    return [{ tag: 'sup' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleSuperscript:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },
});
