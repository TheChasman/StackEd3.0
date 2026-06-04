<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import ToolbarDropdown from './ToolbarDropdown.svelte';

  let { editor }: { editor: Editor } = $props();

  const SIZES = [
    { label: 'Default', value: null },
    { label: '12px', value: '12px' },
    { label: '14px', value: '14px' },
    { label: '16px', value: '16px' },
    { label: '18px', value: '18px' },
    { label: '20px', value: '20px' },
    { label: '24px', value: '24px' },
    { label: '28px', value: '28px' },
    { label: '32px', value: '32px' },
    { label: '40px', value: '40px' },
  ];

  function activeLabel(): string {
    const current = editor.getAttributes('textStyle').fontSize as string | undefined;
    return SIZES.find((size) => size.value === current)?.label ?? 'Size';
  }

  function apply(value: string | null, close: () => void) {
    const chain = editor.chain().focus();
    if (value) {
      chain.setFontSize(value).run();
    } else {
      chain.unsetFontSize().run();
    }
    close();
  }
</script>

<ToolbarDropdown label={activeLabel()} width="w-32">
  {#snippet children(close)}
    {#each SIZES as size (size.label)}
      <button
        type="button"
        onclick={() => apply(size.value, close)}
        class="w-full text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500"
      >
        {size.label}
      </button>
    {/each}
  {/snippet}
</ToolbarDropdown>
