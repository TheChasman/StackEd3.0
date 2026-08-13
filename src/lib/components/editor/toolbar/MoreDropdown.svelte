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
      key: 'pullquote',
      label: 'Pull quote',
      icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z',
      run: () => (editor.commands as any).insertPullquote?.(),
    },
    {
      key: 'callout',
      label: 'Callout',
      icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      run: () => (editor.commands as any).insertCallout?.(),
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
      key: 'poll',
      label: 'Poll',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      run: () => (editor.commands as any).insertPoll?.(),
    },
    {
      key: 'youtube',
      label: 'YouTube embed',
      icon: 'M21 12a9 9 0 11-18 0 9 9 0 0118 0zM10 9l5 3-5 3V9z',
      run: () => {
        const url = prompt('YouTube URL or video ID:');
        if (!url) return;
        const videoId =
          url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/)?.[1] ?? url.trim();
        if (videoId.length === 11) (editor.commands as any).insertYouTube?.(videoId);
        else alert('Could not extract an 11-character video ID from that URL.');
      },
    },
    {
      key: 'embed-publication',
      label: 'Embed publication',
      icon: 'M4 4h16v16H4zM4 8h16M8 8v12',
      run: () => {
        const url = prompt('Substack publication URL:');
        if (url) (editor.commands as any).insertEmbeddedPublication?.(url.trim());
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
