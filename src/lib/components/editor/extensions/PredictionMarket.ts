import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    predictionMarket: {
      insertPredictionMarket: (options?: {
        question?: string;
        yes?: number;
        no?: number;
      }) => ReturnType;
    };
  }
}

export const PredictionMarket = Node.create({
  name: 'predictionMarket',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      question: { default: 'Will this happen by end of year?' },
      yes: { default: 60 },
      no: { default: 40 },
      source: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="prediction-market"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const yes = Math.max(0, Math.min(100, Number(HTMLAttributes.yes) || 0));
    const no = Math.max(0, Math.min(100, Number(HTMLAttributes.no) || 0));
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'prediction-market',
          class: 'prediction-market',
          style:
            'border:1px solid #ddd;border-radius:8px;padding:16px;margin:16px 0;background:#fafafa;font-family:system-ui,-apple-system,sans-serif;',
        },
        HTMLAttributes
      ),
      [
        'div',
        { style: 'font-weight:600;margin-bottom:12px;' },
        HTMLAttributes.question || 'Prediction',
      ],
      [
        'div',
        { style: 'display:flex;gap:8px;font-size:14px;' },
        [
          'div',
          {
            style:
              'flex:1;background:#10b981;color:#fff;padding:8px;border-radius:4px;text-align:center;',
          },
          `Yes ${yes}%`,
        ],
        [
          'div',
          {
            style:
              'flex:1;background:#ef4444;color:#fff;padding:8px;border-radius:4px;text-align:center;',
          },
          `No ${no}%`,
        ],
      ],
      HTMLAttributes.source
        ? [
            'div',
            { style: 'font-size:11px;color:#666;margin-top:8px;' },
            `Source: ${HTMLAttributes.source}`,
          ]
        : '',
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'my-4 rounded-lg border border-dark-700 bg-dark-800 p-4';
      dom.contentEditable = 'false';

      const question = document.createElement('div');
      question.className = 'text-sm font-semibold text-dark-100 mb-3 cursor-text';
      question.textContent = node.attrs.question;

      question.addEventListener('click', () => {
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;
        const next = prompt('Prediction question:', node.attrs.question);
        if (next === null) return;
        editor.commands.command(({ tr }) => {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, question: next });
          return true;
        });
      });
      dom.appendChild(question);

      const yes = Number(node.attrs.yes) || 0;
      const no = Number(node.attrs.no) || 0;

      const bar = document.createElement('div');
      bar.className = 'flex h-8 rounded overflow-hidden text-xs font-bold';
      bar.innerHTML = `
        <div style="width:${yes}%;background:#10b981;color:white;display:flex;align-items:center;justify-content:center;">Yes ${yes}%</div>
        <div style="width:${no}%;background:#ef4444;color:white;display:flex;align-items:center;justify-content:center;">No ${no}%</div>
      `;
      dom.appendChild(bar);

      const controls = document.createElement('div');
      controls.className = 'flex items-center gap-2 mt-3 text-xs';
      controls.innerHTML = `
        <label class="flex items-center gap-1 text-dark-300">Yes %
          <input type="number" min="0" max="100" value="${yes}" class="w-14 bg-dark-900 border border-dark-600 rounded px-1 py-0.5 text-dark-100" data-field="yes" />
        </label>
        <label class="flex items-center gap-1 text-dark-300">No %
          <input type="number" min="0" max="100" value="${no}" class="w-14 bg-dark-900 border border-dark-600 rounded px-1 py-0.5 text-dark-100" data-field="no" />
        </label>
      `;
      controls.querySelectorAll('input').forEach((input) => {
        input.addEventListener('change', () => {
          const pos = typeof getPos === 'function' ? getPos() : undefined;
          if (typeof pos !== 'number') return;
          const field = input.getAttribute('data-field') as 'yes' | 'no';
          const val = Number(input.value);
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, [field]: val });
            return true;
          });
        });
      });
      dom.appendChild(controls);

      return { dom };
    };
  },

  addCommands() {
    return {
      insertPredictionMarket:
        (options = {}) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: options });
        },
    };
  },
});
