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

  const PAYWALL_ICON = 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z';
  const POLL_ICON = 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z';
  const LATEX_ICON = 'M7 4h10M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z';
  const FOOTNOTE_ICON = 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z';
  const POETRY_ICON = 'M4 6h16M4 10h16M4 14h16M4 18h16';

  const actions: Action[] = [
    {
      key: 'paywall',
      label: 'Paywall',
      icon: PAYWALL_ICON,
      run: () => editor.chain().focus().insertContent({ type: 'paywall' }).run(),
    },
    {
      key: 'poll',
      label: 'Poll',
      icon: POLL_ICON,
      run: () => (editor.commands as any).insertPoll?.(),
    },
    {
      key: 'latex',
      label: 'LaTeX',
      icon: LATEX_ICON,
      run: () => (editor.commands as any).insertLatex?.(),
    },
    {
      key: 'footnote',
      label: 'Footnote',
      icon: FOOTNOTE_ICON,
      run: () => {
        const text = prompt('Footnote text:');
        if (text) (editor.commands as any).addFootnote?.(text);
      },
    },
    {
      key: 'verse',
      label: 'Verse',
      icon: POETRY_ICON,
      run: () => (editor.commands as any).setPoetry?.(),
    },
  ];
</script>

<ToolbarDropdown label="More" width="w-48" align="right">
  {#snippet children(close)}
    {#each actions as action (action.key)}
      <button
        type="button"
        onclick={() => { action.run(); close(); }}
        class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 w-full flex items-center gap-2"
      >
        <svg class="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={action.icon} />
        </svg>
        {action.label}
      </button>
    {/each}
  {/snippet}
</ToolbarDropdown>
