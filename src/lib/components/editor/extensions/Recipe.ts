import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    recipe: {
      insertRecipe: (options?: {
        title?: string;
        servings?: string;
        time?: string;
        ingredients?: string[];
        steps?: string[];
      }) => ReturnType;
    };
  }
}

export const Recipe = Node.create({
  name: 'recipe',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      title: { default: 'Recipe title' },
      servings: { default: '4' },
      time: { default: '30 min' },
      ingredients: {
        default: ['1 cup flour', '1 tsp salt', '2 eggs'],
        parseHTML: (el) => {
          const raw = el.getAttribute('data-ingredients');
          try {
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ 'data-ingredients': JSON.stringify(attrs.ingredients || []) }),
      },
      steps: {
        default: ['Mix ingredients', 'Cook', 'Serve'],
        parseHTML: (el) => {
          const raw = el.getAttribute('data-steps');
          try {
            return raw ? JSON.parse(raw) : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({ 'data-steps': JSON.stringify(attrs.steps || []) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="recipe"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const ingredients = (node?.attrs.ingredients || []) as string[];
    const steps = (node?.attrs.steps || []) as string[];
    return [
      'div',
      mergeAttributes(
        {
          'data-type': 'recipe',
          class: 'recipe-card',
          style:
            'border:1px solid #e5e5e5;border-radius:8px;padding:16px;margin:16px 0;background:#fffaf3;font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;',
        },
        HTMLAttributes,
      ),
      ['h3', { style: 'margin:0 0 8px 0;font-size:20px;' }, HTMLAttributes.title || 'Recipe'],
      [
        'div',
        { style: 'font-size:13px;color:#666;margin-bottom:12px;' },
        `Servings: ${HTMLAttributes.servings || '—'}  •  Time: ${HTMLAttributes.time || '—'}`,
      ],
      [
        'h4',
        {
          style:
            'margin:8px 0 4px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;',
        },
        'Ingredients',
      ],
      [
        'ul',
        { style: 'margin:0 0 12px 0;padding-left:20px;' },
        ...ingredients.map((i) => ['li', {}, i]),
      ],
      [
        'h4',
        {
          style:
            'margin:8px 0 4px 0;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;',
        },
        'Steps',
      ],
      ['ol', { style: 'margin:0;padding-left:20px;' }, ...steps.map((s) => ['li', {}, s])],
    ];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement('div');
      dom.className = 'my-4 rounded-lg border border-dark-700 bg-dark-800 p-4';
      dom.contentEditable = 'false';

      const render = (n: typeof node) => {
        const ings = (n.attrs.ingredients as string[]) || [];
        const stps = (n.attrs.steps as string[]) || [];
        dom.innerHTML = `
          <div class="text-xl font-bold text-dark-100 mb-1" data-edit="title">${escapeHtml(n.attrs.title)}</div>
          <div class="text-xs text-dark-300 mb-3">
            <span data-edit="servings" class="underline decoration-dotted cursor-pointer">Servings: ${escapeHtml(n.attrs.servings)}</span>
            &nbsp;•&nbsp;
            <span data-edit="time" class="underline decoration-dotted cursor-pointer">Time: ${escapeHtml(n.attrs.time)}</span>
          </div>
          <div class="text-xs font-bold uppercase tracking-wide text-dark-300 mb-1">Ingredients</div>
          <ul class="list-disc pl-5 text-sm text-dark-100 mb-3" data-edit="ingredients">
            ${ings.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}
          </ul>
          <div class="text-xs font-bold uppercase tracking-wide text-dark-300 mb-1">Steps</div>
          <ol class="list-decimal pl-5 text-sm text-dark-100" data-edit="steps">
            ${stps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}
          </ol>
        `;

        dom.querySelectorAll('[data-edit]').forEach((el) => {
          el.addEventListener('click', () => {
            const pos = typeof getPos === 'function' ? getPos() : undefined;
            if (typeof pos !== 'number') return;
            const field = el.getAttribute('data-edit') as
              'title' | 'servings' | 'time' | 'ingredients' | 'steps';
            const isList = field === 'ingredients' || field === 'steps';
            const current = isList ? (n.attrs[field] as string[]).join('\n') : n.attrs[field];
            const next = prompt(`${field}${isList ? ' (one per line)' : ''}:`, current);
            if (next === null) return;
            const value = isList
              ? next
                  .split('\n')
                  .map((x) => x.trim())
                  .filter(Boolean)
              : next;
            editor.commands.command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, { ...n.attrs, [field]: value });
              return true;
            });
          });
        });
      };

      render(node);

      return {
        dom,
        update(updated) {
          if (updated.type.name !== 'recipe') return false;
          render(updated);
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      insertRecipe:
        (options = {}) =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name, attrs: options });
        },
    };
  },
});

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
