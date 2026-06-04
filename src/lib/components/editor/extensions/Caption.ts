import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Caption node — content block inside captionedImage, renders as figcaption.
 */
export const Caption = Node.create({
  name: 'caption',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'figcaption[data-type="caption"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figcaption',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'caption',
        class: 'image-caption text-center text-sm text-dark-400 mt-2',
      }),
      0,
    ];
  },
});
