<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import ToolbarDropdown from './ToolbarDropdown.svelte';

  let { editor }: { editor: Editor } = $props();

  function activeLabel(): string {
    for (const level of [2, 3, 4] as const) {
      if (editor.isActive('heading', { level })) return `Heading ${level}`;
    }
    return 'Normal text';
  }

  function apply(level: number | null, close: () => void) {
    if (level === null) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: level as 2|3|4 }).run();
    }
    close();
  }
</script>

<ToolbarDropdown label={activeLabel()} width="w-44">
  {#snippet children(close)}
    <button
      type="button"
      onclick={() => apply(null, close)}
      class="w-full text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500"
    >
      Normal text
    </button>
    {#each [2, 3, 4] as level}
      <button
        type="button"
        onclick={() => apply(level, close)}
        class="w-full text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 flex items-center gap-2"
      >
        <span class="w-5 text-center text-dark-400 font-bold text-xs">H{level}</span>
        Heading {level}
      </button>
    {/each}
  {/snippet}
</ToolbarDropdown>
