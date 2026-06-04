import { Node, mergeAttributes } from '@tiptap/core';
import { Image2 } from './Image2';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    captionedImage: {
      insertCaptionedImage: (imageAttrs: Record<string, unknown>, captionText?: string) => ReturnType;
    };
  }
}

/**
 * captionedImage — block container for image2 + optional caption.
 * Renders as: div.captioned-image-container > figure > (img or a>img) + figcaption
 */
export const CaptionedImage = Node.create({
  name: 'captionedImage',
  group: 'block',
  content: 'image2 caption?',
  defining: true,

  parseHTML() {
    return [{ tag: 'figure[data-type="captioned-image"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'captioned-image',
        class: 'captioned-image-container',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertCaptionedImage:
        (imageAttrs, captionText) =>
        ({ chain }) => {
          const attrs = { ...imageAttrs };
          // Infer dimensions from filename convention (e.g. _1456x1048)
          if (typeof attrs.src === 'string' && !attrs.width) {
            const match = attrs.src.match(/_(\d+)x(\d+)\./);
            if (match) {
              attrs.width = parseInt(match[1], 10);
              attrs.height = parseInt(match[2], 10);
            }
          }

          const imageNode = { type: Image2.name, attrs };

          if (captionText) {
            return chain()
              .insertContent({
                type: this.name,
                content: [
                  imageNode,
                  {
                    type: 'caption',
                    content: [
                      { type: 'paragraph', content: [{ type: 'text', text: captionText }] },
                    ],
                  },
                ],
              })
              .run();
          }

          return chain()
            .insertContent({
              type: this.name,
              content: [imageNode],
            })
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Backspace at start of empty captionedImage deletes the whole block
      Backspace: () => {
        const { empty, $from } = this.editor.state.selection;
        if (!empty) return false;
        const node = $from.node(-1);
        if (node?.type.name !== 'captionedImage') return false;
        // Only delete if cursor is at the very start and the block is empty of caption
        if ($from.parentOffset === 0) {
          return this.editor.commands.deleteNode('captionedImage');
        }
        return false;
      },
    };
  },
});
