import { Node, mergeAttributes } from '@tiptap/core';

export interface PollOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    poll: {
      insertPoll: () => ReturnType;
    };
  }
}

export const Poll = Node.create<PollOptions>({
  name: 'poll',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      question: {
        default: '',
      },
      options: {
        default: ['Option 1', 'Option 2'],
      },
      duration: {
        default: '1 day',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="poll"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'poll' })];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const safePos = (): number | undefined =>
        typeof getPos === 'function' ? getPos() : undefined;
      const dom = document.createElement('div');
      dom.className =
        'my-6 p-4 border border-gray-200 rounded-lg bg-gray-50 dark:bg-dark-800 dark:border-dark-700 select-none';

      // Header
      const header = document.createElement('div');
      header.className = 'flex items-center justify-between mb-4';
      header.innerHTML = `
        <span class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-dark-400">Poll</span>
        <span class="text-xs text-gray-500 dark:text-dark-400">Duration: ${node.attrs.duration}</span>
      `;
      dom.appendChild(header);

      // Question Input
      const questionInput = document.createElement('input');
      questionInput.type = 'text';
      questionInput.placeholder = 'Ask a question...';
      questionInput.value = node.attrs.question;
      questionInput.className =
        'w-full bg-transparent text-xl font-bold mb-4 border-none focus:ring-0 p-0 placeholder-gray-400 dark:text-white';

      questionInput.addEventListener('input', (e) => {
        const pos = safePos();
        if (pos !== undefined) {
          editor.commands.updateAttributes(pos as any, {
            question: (e.target as HTMLInputElement).value,
          });
        }
      });
      dom.appendChild(questionInput);

      // Options Container
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'space-y-2';

      const renderOptions = () => {
        optionsContainer.innerHTML = '';
        node.attrs.options.forEach((option: string, index: number) => {
          const optionWrapper = document.createElement('div');
          optionWrapper.className = 'flex items-center gap-2';

          const radio = document.createElement('div');
          radio.className = 'w-4 h-4 rounded-full border border-gray-300 dark:border-dark-600';

          const input = document.createElement('input');
          input.type = 'text';
          input.value = option;
          input.className =
            'flex-1 bg-white dark:bg-dark-700 border border-gray-200 dark:border-dark-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent';
          input.placeholder = `Option ${index + 1}`;

          input.addEventListener('change', (e) => {
            const pos = safePos();
            if (pos !== undefined) {
              const newOptions = [...node.attrs.options];
              newOptions[index] = (e.target as HTMLInputElement).value;
              editor.commands.updateAttributes(pos as any, { options: newOptions });
            }
          });

          // Remove button
          if (node.attrs.options.length > 2) {
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&times;';
            removeBtn.className = 'text-gray-400 hover:text-red-500 px-2';
            removeBtn.onclick = () => {
              const pos = safePos();
              if (pos !== undefined) {
                const newOptions = node.attrs.options.filter((_: any, i: number) => i !== index);
                editor.commands.updateAttributes(pos as any, { options: newOptions });
              }
            };
            optionWrapper.appendChild(radio);
            optionWrapper.appendChild(input);
            optionWrapper.appendChild(removeBtn);
          } else {
            optionWrapper.appendChild(radio);
            optionWrapper.appendChild(input);
          }

          optionsContainer.appendChild(optionWrapper);
        });

        // Add Option Button
        const addBtn = document.createElement('button');
        addBtn.textContent = '+ Add option';
        addBtn.className = 'text-sm text-primary-500 hover:text-primary-600 font-medium mt-2';
        addBtn.onclick = () => {
          const pos = safePos();
          if (pos !== undefined) {
            const newOptions = [...node.attrs.options, `Option ${node.attrs.options.length + 1}`];
            editor.commands.updateAttributes(pos as any, { options: newOptions });
          }
        };
        optionsContainer.appendChild(addBtn);
      };

      renderOptions();
      dom.appendChild(optionsContainer);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'poll') return false;
          // We'd need to re-render logic here properly for full reactivity,
          // but for this simple implementation, let's rely on Tiptap re-creating the node view
          // or we could implement a smarter diff.
          // For now, if options length changed, we might want to re-render options.
          // But since inputs are bound, text updates don't need full re-render.
          // Let's just return true to say "we handled it" but that implies we manually update the DOM.
          // Actually, returning false forces a re-render which is safer for this DOM manipulation approach.
          return false;
        },
      };
    };
  },

  addCommands() {
    return {
      insertPoll:
        () =>
        ({ commands }) => {
          return commands.insertContent({ type: this.name });
        },
    };
  },
});
