import { Node, mergeAttributes } from '@tiptap/core';
import { invoke } from '@tauri-apps/api/core';
import { documentStore } from '$lib/stores/document.svelte';
import { isArtworkRelativeSrc, resolveArtworkImagePath } from '$lib/utils/artworkReferences';

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
  credit: string | null;
  type: string | null;
  href: string | null;
  belowTheFold: boolean;
  topImage: boolean;
  internalRedirect: string | null;
  isProcessing: boolean;
  align: string | null;
  offset: boolean;
  thumbnail: boolean;
}

function applyThumbnailDisplay(img: HTMLImageElement, thumbnail: boolean): void {
  img.style.maxHeight = thumbnail ? '180px' : '';
  img.style.objectFit = thumbnail ? 'contain' : '';
}

function setEditorImageSrc(img: HTMLImageElement, src: string): void {
  img.dataset.sourceSrc = src;
  if (!isArtworkRelativeSrc(src)) {
    img.src = src;
    return;
  }

  const path = resolveArtworkImagePath(documentStore.filePath, src);
  if (!path) {
    img.src = src;
    return;
  }

  void invoke<string>('read_image_data_url', { path })
    .then((dataUrl) => {
      if (img.dataset.sourceSrc === src) img.src = dataUrl;
    })
    .catch(() => {
      if (img.dataset.sourceSrc === src) img.src = src;
    });
}

function parseDataAttrs(el: HTMLElement): Partial<Image2Attrs> {
  const raw = el.getAttribute('data-attrs');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Partial<Image2Attrs>;
    }
  } catch {
    // ignore invalid payload
  }
  return {};
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
      src: {
        default: '',
        parseHTML: (el: HTMLElement) => parseDataAttrs(el).src ?? el.getAttribute('src') ?? '',
      },
      srcNoWatermark: {
        default: null,
        parseHTML: (el: HTMLElement) => parseDataAttrs(el).srcNoWatermark ?? null,
      },
      fullscreen: { default: null },
      imageSize: { default: null },
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => parseDataAttrs(el).height ?? null,
      },
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => parseDataAttrs(el).width ?? null,
      },
      resizeWidth: { default: null },
      bytes: { default: null },
      alt: {
        default: null,
        parseHTML: (el: HTMLElement) => parseDataAttrs(el).alt ?? el.getAttribute('alt') ?? null,
      },
      title: { default: null },
      credit: {
        default: null,
        parseHTML: (el: HTMLElement) => parseDataAttrs(el).credit ?? null,
      },
      type: { default: null },
      href: { default: null },
      belowTheFold: { default: false },
      topImage: {
        default: false,
        parseHTML: (el: HTMLElement) => Boolean(parseDataAttrs(el).topImage),
      },
      internalRedirect: { default: null },
      isProcessing: { default: false },
      align: { default: null },
      offset: { default: false },
      thumbnail: {
        default: false,
        parseHTML: (el: HTMLElement) => Boolean(parseDataAttrs(el).thumbnail),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'img[data-type="image2"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = { ...HTMLAttributes };
    const { src, alt, width, height, thumbnail, ...rest } = attrs;
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
      credit: attrs.credit ?? null,
      type: attrs.type ?? null,
      href: attrs.href ?? null,
      belowTheFold: attrs.belowTheFold ?? false,
      topImage: attrs.topImage ?? false,
      internalRedirect: attrs.internalRedirect ?? null,
      isProcessing: attrs.isProcessing ?? false,
      align: attrs.align ?? null,
      offset: attrs.offset ?? false,
      thumbnail: attrs.thumbnail ?? false,
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
      let currentAttrs = { ...node.attrs };
      let thumbnail = Boolean(currentAttrs.thumbnail);

      const img = document.createElement('img');
      img.alt = node.attrs.alt || '';
      img.title = node.attrs.title || (node.attrs.credit ? `Credit: ${node.attrs.credit}` : '');
      img.className = 'sizing-normal max-w-full rounded';
      img.style.display = 'block';
      setEditorImageSrc(img, node.attrs.src || '');

      if (node.attrs.width) img.width = node.attrs.width;
      if (node.attrs.height) img.height = node.attrs.height;
      applyThumbnailDisplay(img, thumbnail);

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

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className =
        'absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-primary-400';
      toggle.textContent = thumbnail ? 'Full' : 'Thumb';
      toggle.setAttribute('aria-label', thumbnail ? 'Show full size' : 'Show as thumbnail');
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const nextThumbnail = !thumbnail;
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (typeof pos !== 'number') return;
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(pos, undefined, {
              ...currentAttrs,
              thumbnail: nextThumbnail,
            }),
          );
        }
        thumbnail = nextThumbnail;
        currentAttrs = { ...currentAttrs, thumbnail };
        applyThumbnailDisplay(img, thumbnail);
        toggle.textContent = thumbnail ? 'Full' : 'Thumb';
        toggle.setAttribute('aria-label', thumbnail ? 'Show full size' : 'Show as thumbnail');
      });
      dom.appendChild(toggle);

      // Hero badge
      if (node.attrs.topImage) {
        const badge = document.createElement('span');
        badge.className =
          'absolute top-2 right-2 px-2 py-0.5 text-xs rounded bg-amber-500/90 text-black font-medium';
        badge.textContent = 'HERO';
        dom.appendChild(badge);
      }

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'image2') return false;
          currentAttrs = { ...updatedNode.attrs };
          thumbnail = Boolean(updatedNode.attrs.thumbnail);
          const imgEl = dom.querySelector('img');
          if (imgEl) {
            setEditorImageSrc(imgEl, updatedNode.attrs.src || '');
            imgEl.alt = updatedNode.attrs.alt || '';
            imgEl.title =
              updatedNode.attrs.title ||
              (updatedNode.attrs.credit ? `Credit: ${updatedNode.attrs.credit}` : '');
            applyThumbnailDisplay(imgEl, thumbnail);
          }
          toggle.textContent = thumbnail ? 'Full' : 'Thumb';
          toggle.setAttribute('aria-label', thumbnail ? 'Show full size' : 'Show as thumbnail');
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
        stopEvent: (event) => event.target instanceof HTMLElement && toggle.contains(event.target),
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
