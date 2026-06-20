import { Node, mergeAttributes } from '@tiptap/core';

/**
 * Substack image2 node — block-level atom with full metadata.
 * This is the primary Substack image type (vs legacy inline `image`).
 * Rendered DOM: a.image-link > div.image2-inset > picture > img[data-attrs]
 */
export interface Image2Attrs {
  src: string;
  srcNoWatermark: string | null;
  fullscreen: unknown;
  imageSize: unknown;
  height: number | null;
  width: number | null;
  resizeWidth: number | null;
  bytes: number | null;
  alt: string | null;
  title: string | null;
  type: string | null;
  href: string | null;
  belowTheFold: boolean;
  topImage: boolean;
  internalRedirect: string | null;
  isProcessing: boolean;
  align: string | null;
  offset: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image2: {
      setImage2: (attrs: Partial<Image2Attrs>) => ReturnType;
    };
  }
}

export const Image2 = Node.create({
  name: 'image2',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      srcNoWatermark: { default: null },
      fullscreen: { default: null },
      imageSize: { default: null },
      height: { default: null },
      width: { default: null },
      resizeWidth: { default: null },
      bytes: { default: null },
      alt: { default: null },
      title: { default: null },
      type: { default: null },
      href: { default: null },
      belowTheFold: { default: false },
      topImage: { default: false },
      internalRedirect: { default: null },
      isProcessing: { default: false },
      align: { default: null },
      offset: { default: false },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-type="image2"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes };
    const { src, alt, width, height, ...rest } = attrs;
    // Build the data-attrs JSON blob that Substack emits
    const dataAttrs = JSON.stringify({
      src: attrs.src || '',
      srcNoWatermark: attrs.srcNoWatermark ?? null,
      fullscreen: attrs.fullscreen ?? null,
      imageSize: attrs.imageSize ?? null,
      height: attrs.height ?? null,
      width: attrs.width ?? null,
      resizeWidth: attrs.resizeWidth ?? null,
      bytes: attrs.bytes ?? null,
      alt: attrs.alt ?? null,
      title: attrs.title ?? null,
      type: attrs.type ?? null,
      href: attrs.href ?? null,
      belowTheFold: attrs.belowTheFold ?? false,
      topImage: attrs.topImage ?? false,
      internalRedirect: attrs.internalRedirect ?? null,
      isProcessing: attrs.isProcessing ?? false,
      align: attrs.align ?? null,
      offset: attrs.offset ?? false,
    });

    // The wrapping is handled by captionedImage parent node.
    // This node renders just the <img> with data-attrs.
    return [
      'img',
      mergeAttributes(
        {
          src: src || '',
          alt: alt ?? '',
          'data-type': 'image2',
          'data-attrs': dataAttrs,
          class: 'sizing-normal',
          width: width ?? undefined,
          height: height ?? undefined,
        },
        rest,
      ),
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'image2-inset flex flex-col items-center select-none';
      dom.contentEditable = 'false';
      dom.style.position = 'relative';

      const img = document.createElement('img');
      img.src = node.attrs.src || '';
      img.alt = node.attrs.alt || '';
      img.className = 'sizing-normal max-w-full rounded';
      img.style.display = 'block';

      if (node.attrs.width) img.width = node.attrs.width;
      if (node.attrs.height) img.height = node.attrs.height;

      if (node.attrs.href) {
        const link = document.createElement('a');
        link.href = node.attrs.href;
        link.target = '_blank';
        link.className = 'image-link';
        link.appendChild(img);
        dom.appendChild(link);
      } else {
        dom.appendChild(img);
      }

      // Hero badge
      if (node.attrs.topImage) {
        const badge = document.createElement('span');
        badge.className = 'absolute top-2 left-2 px-2 py-0.5 text-xs rounded bg-amber-500/90 text-black font-medium';
        badge.textContent = 'HERO';
        dom.appendChild(badge);
      }

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image2') return false;
          const imgEl = dom.querySelector('img');
          if (imgEl) {
            imgEl.src = updatedNode.attrs.src || '';
            imgEl.alt = updatedNode.attrs.alt || '';
          }
          // Remove old link if href changed
          const oldLink = dom.querySelector('a');
          if (updatedNode.attrs.href && !oldLink) {
            const newLink = document.createElement('a');
            newLink.href = updatedNode.attrs.href as string;
            newLink.target = '_blank';
            newLink.className = 'image-link';
            newLink.appendChild(imgEl!);
            dom.appendChild(newLink);
          } else if (!updatedNode.attrs.href && oldLink) {
            dom.appendChild(imgEl!);
            oldLink.remove();
          }
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setImage2:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs });
        },
    };
  },
});
