<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import ToolbarDropdown from './ToolbarDropdown.svelte';

  let { editor } = $props<{ editor: Editor }>();

  type Action = {
    key: string;
    label: string;
    icon: string;
    run: () => void;
  };

  function chain() {
    return editor.chain().focus();
  }

  const ACTIONS: Action[] = [
    {
      key: 'code-block',
      label: 'Code block',
      icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
      run: () => chain().toggleCodeBlock().run(),
    },
    {
      key: 'divider',
      label: 'Divider',
      icon: 'M20 12H4',
      run: () => chain().setHorizontalRule().run(),
    },
    {
      key: 'financial-chart',
      label: 'Financial chart',
      icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z',
      run: () => (editor.commands as any).insertFinancialChart?.(),
    },
    {
      key: 'footnote',
      label: 'Footnote',
      icon: 'M5 4v16M19 4v16M9 8h6M9 12h6M9 16h2',
      run: () => {
        const text = prompt('Footnote text:');
        if (text) (editor.commands as any).addFootnote?.(text);
      },
    },
    {
      key: 'latex',
      label: 'LaTeX',
      icon: 'M4 6h4l4 6-4 6H4M20 6h-4l-4 6 4 6h4',
      run: () => (editor.commands as any).insertLatex?.(),
    },
    {
      key: 'paywall',
      label: 'Paywall',
      icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
      run: () => chain().insertContent({ type: 'paywall' }).run(),
    },
    {
      key: 'poetry',
      label: 'Poetry',
      icon: 'M4 6h16M4 12h10M4 18h16',
      run: () => (editor.commands as any).togglePoetry?.(),
    },
    {
      key: 'poll',
      label: 'Poll',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      run: () => (editor.commands as any).insertPoll?.(),
    },
    {
      key: 'prediction-market',
      label: 'Prediction market',
      icon: 'M3 3v18h18M7 15l3-3 4 4 5-7',
      run: () => {
        const question = prompt('Prediction question:', 'Will X happen by Y?');
        if (!question) return;
        const yesRaw = prompt('Probability Yes (0-100):', '60');
        const yes = Math.max(0, Math.min(100, Number(yesRaw) || 50));
        (editor.commands as any).insertPredictionMarket?.({ question, yes, no: 100 - yes });
      },
    },
    {
      key: 'recipe',
      label: 'Recipe',
      icon: 'M3 7h18M3 12h18M3 17h18',
      run: () => (editor.commands as any).insertRecipe?.(),
    },
  ];
</script>

<ToolbarDropdown label="More" width="w-56" align="right">
  {#snippet children(close)}
    {#each ACTIONS as action (action.key)}
      <button
        type="button"
        onclick={() => {
          action.run();
          close();
        }}
        class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 flex items-center gap-2"
      >
        <svg class="w-4 h-4 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={action.icon} />
        </svg>
        {action.label}
      </button>
    {/each}
  {/snippet}
</ToolbarDropdown>
