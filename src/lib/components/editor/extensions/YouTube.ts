import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    youtube: {
      insertYouTube: (videoId: string) => ReturnType;
    };
  }
}

export const YouTube = Node.create({
  name: 'youtube2',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      videoId: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="youtube2"]' }, { tag: 'div[data-type="youtube"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const videoId = HTMLAttributes.videoId as string;
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'youtube2',
        class: 'youtube-embed my-4',
      }),
      [
        'iframe',
        {
          src: `https://www.youtube.com/embed/${videoId}`,
          width: '100%',
          height: '315',
          frameborder: '0',
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
          allowfullscreen: 'true',
        },
      ],
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'youtube-embed my-4 select-none';
      dom.setAttribute('data-type', 'youtube2');
      dom.contentEditable = 'false';

      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${node.attrs.videoId}`;
      iframe.width = '100%';
      iframe.height = '315';
      iframe.frameBorder = '0';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      dom.appendChild(iframe);

      return { dom };
    };
  },

  addCommands() {
    return {
      insertYouTube:
        (videoId: string) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: { videoId } });
        },
    };
  },
});
