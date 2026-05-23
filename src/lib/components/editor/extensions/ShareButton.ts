import { Node, mergeAttributes } from '@tiptap/core';

export type ShareVariant =
  | 'share-post'
  | 'share-post-caption'
  | 'share-publication'
  | 'leave-comment'
  | 'send-message'
  | 'custom';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    shareButton: {
      insertShareButton: (options: {
        variant: ShareVariant;
        label?: string;
        url?: string;
        caption?: string;
      }) => ReturnType;
    };
  }
}

const VARIANT_DEFAULTS: Record<ShareVariant, { label: string; color: string }> = {
  'share-post': { label: 'Share this post', color: '#f59e0b' },
  'share-post-caption': { label: 'Share post', color: '#f59e0b' },
  'share-publication': { label: 'Share publication', color: '#f59e0b' },
  'leave-comment': { label: 'Leave a comment', color: '#3b82f6' },
  'send-message': { label: 'Send a message', color: '#10b981' },
  custom: { label: 'Custom Button', color: '#6366f1' },
};

function resolveUrl(variant: ShareVariant, customUrl?: string): string {
  const base = 'https://substack.com';
  switch (variant) {
    case 'share-post':
    case 'share-post-caption':
      return `${base}/share`;
    case 'share-publication':
      return `${base}`;
    case 'leave-comment':
      return `${base}/comments`;
    case 'send-message':
      return `${base}/chat`;
    case 'custom':
      return customUrl || '#';
    default:
      return '#';
  }
}

export const ShareButton = Node.create({
  name: 'shareButton',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      variant: { default: 'share-post' as ShareVariant },
      label: { default: '' },
      url: { default: '' },
      caption: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="share-button"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const variant = (HTMLAttributes.variant || 'share-post') as ShareVariant;
    const defaults = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS['share-post'];
    const label = HTMLAttributes.label || defaults.label;
    const target = resolveUrl(variant, HTMLAttributes.url);
    const showCaption = variant === 'share-post-caption' && HTMLAttributes.caption;

    const children: any[] = [
      [
        'a',
        {
          href: target,
          class: 'button primary',
          style: `background:${defaults.color};color:#fff;padding:12px 32px;border-radius:4px;text-decoration:none;font-weight:bold;display:inline-block;font-family:system-ui,-apple-system,sans-serif;`,
        },
        label,
      ],
    ];
    if (showCaption) {
      children.push([
        'p',
        { style: 'text-align:center;font-size:14px;color:#555;margin-top:8px;' },
        HTMLAttributes.caption,
      ]);
    }

    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'share-button',
          'data-variant': variant,
          class: 'share-button-wrap',
          style: 'text-align:center;margin:2em 0;',
        },
        HTMLAttributes
      ),
      ...children,
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'my-6 flex flex-col items-center select-none';
      dom.contentEditable = 'false';

      const variant = node.attrs.variant as ShareVariant;
      const defaults = VARIANT_DEFAULTS[variant] || VARIANT_DEFAULTS['share-post'];
      const labelText = node.attrs.label || defaults.label;

      const button = document.createElement('a');
      button.className =
        'px-8 py-3 rounded font-bold transition-all hover:scale-[1.02] shadow-lg cursor-pointer';
      button.style.backgroundColor = defaults.color;
      button.style.color = 'white';
      button.textContent = labelText;
      button.href = resolveUrl(variant, node.attrs.url);
      button.title = `Variant: ${variant}`;
      dom.appendChild(button);

      if (variant === 'share-post-caption') {
        const cap = document.createElement('div');
        cap.className = 'mt-2 text-sm text-dark-300 italic text-center max-w-md';
        cap.textContent = node.attrs.caption || 'Add a caption…';

        cap.addEventListener('click', () => {
          const pos = typeof getPos === 'function' ? getPos() : undefined;
          if (typeof pos !== 'number') return;
          const next = prompt('Caption:', node.attrs.caption || '');
          if (next === null) return;
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, caption: next });
            return true;
          });
        });
        dom.appendChild(cap);
      }

      if (variant === 'custom') {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const pos = typeof getPos === 'function' ? getPos() : undefined;
          if (typeof pos !== 'number') return;
          const nextLabel = prompt('Button label:', node.attrs.label || defaults.label);
          if (nextLabel === null) return;
          const nextUrl = prompt('Button URL:', node.attrs.url || '');
          if (nextUrl === null) return;
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              label: nextLabel,
              url: nextUrl,
            });
            return true;
          });
        });
      }

      return { dom };
    };
  },

  addCommands() {
    return {
      insertShareButton:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: options });
        },
    };
  },
});
