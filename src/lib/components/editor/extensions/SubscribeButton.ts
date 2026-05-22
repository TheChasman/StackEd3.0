import { Node, mergeAttributes } from '@tiptap/core';

export const SubscribeButton = Node.create({
  name: 'subscribeButton',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      publication: { default: '' },
      section: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="subscribe-button"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { publication, section } = HTMLAttributes;
    let url = 'https://substack.com/sign-up';
    if (publication) {
      url = section
        ? `https://${publication}.substack.com/s/${section}`
        : `https://${publication}.substack.com/subscribe`;
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'subscribe-button',
        style: 'text-align:center;margin:2em 0;',
      }),
      [
        'a',
        {
          href: url,
          style:
            'background:#f59e0b;color:white;padding:12px 40px;border-radius:4px;text-decoration:none;font-weight:bold;display:inline-block;',
        },
        'Subscribe Now',
      ],
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'my-8 flex justify-center select-none cursor-default';
      dom.contentEditable = 'false';
      dom.innerHTML = `<div style="background:#f59e0b;color:white;padding:12px 40px;border-radius:4px;font-weight:bold;font-family:system-ui,sans-serif;">
        Subscribe Now
      </div>`;
      return { dom };
    };
  },
});
