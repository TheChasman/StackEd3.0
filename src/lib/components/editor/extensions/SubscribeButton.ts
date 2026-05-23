import { Node, mergeAttributes } from '@tiptap/core';

export const SubscribeButton = Node.create({
  name: 'subscribeButton',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      caption: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="subscribe-button"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const caption = HTMLAttributes.caption as string | undefined;
    const children: any[] = [
      [
        'a',
        {
          href: 'https://substack.com/sign-up',
          class: 'button primary',
          style:
            'background: #f59e0b; color: white; padding: 12px 40px; border-radius: 4px; text-decoration: none; font-weight: bold; display: inline-block; font-family: system-ui, -apple-system, sans-serif;',
        },
        'Subscribe Now',
      ],
    ];
    if (caption && caption.trim()) {
      children.push([
        'p',
        {
          style:
            'text-align: center; font-size: 14px; color: #555; margin-top: 8px; font-family: system-ui, -apple-system, sans-serif;',
        },
        caption,
      ]);
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'subscribe-button',
        class: 'subscription-widget-wrap',
        style: 'text-align: center; margin: 2em 0;',
      }),
      ...children,
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'my-8 flex flex-col items-center select-none';
      dom.contentEditable = 'false';

      const button = document.createElement('a');
      button.className =
        'px-8 py-3 rounded font-bold transition-all transform hover:scale-105 shadow-lg';
      button.style.backgroundColor = '#f59e0b';
      button.style.color = 'white';
      button.href = 'https://substack.com/sign-up';
      button.textContent = 'Subscribe Now';
      button.title = 'Subscribe to this publication';
      button.style.cursor = 'pointer';

      dom.appendChild(button);

      const captionEl = document.createElement('div');
      captionEl.className = 'mt-2 text-sm text-dark-300 italic text-center max-w-md cursor-pointer';

      const renderCaption = (currentCaption: string) => {
        if (currentCaption && currentCaption.trim()) {
          captionEl.textContent = currentCaption;
          if (!captionEl.parentElement) dom.appendChild(captionEl);
        } else if (captionEl.parentElement) {
          captionEl.remove();
        }
      };
      renderCaption(node.attrs.caption || '');

      captionEl.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;
        const next = prompt('Caption:', node.attrs.caption || '');
        if (next === null) return;
        editor.commands.command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, caption: next });
          return true;
        });
      });

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'subscribeButton') return false;
          renderCaption(updatedNode.attrs.caption || '');
          return true;
        },
      };
    };
  },
});
