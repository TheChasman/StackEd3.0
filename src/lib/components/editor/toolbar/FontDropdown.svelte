<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import ToolbarDropdown from './ToolbarDropdown.svelte';

  let { editor }: { editor: Editor } = $props();

  const FONTS = [
    { label: 'Default', value: null, preview: 'inherit' },
    { label: 'Sans', value: 'Inter, ui-sans-serif, system-ui, sans-serif', preview: 'ui-sans-serif, system-ui, sans-serif' },
    { label: 'Serif', value: 'Georgia, Cambria, Times New Roman, Times, serif', preview: 'Georgia, Cambria, Times New Roman, Times, serif' },
    { label: 'Mono', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', preview: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
    { label: 'Arial', value: 'Arial, Helvetica, sans-serif', preview: 'Arial, Helvetica, sans-serif' },
    { label: 'Georgia', value: 'Georgia, serif', preview: 'Georgia, serif' },
    { label: 'Times', value: 'Times New Roman, Times, serif', preview: 'Times New Roman, Times, serif' },
    { label: 'Courier', value: 'Courier New, Courier, monospace', preview: 'Courier New, Courier, monospace' },
  ];

  function activeLabel(): string {
    const current = editor.getAttributes('textStyle').fontFamily as string | undefined;
    return FONTS.find((font) => font.value === current)?.label ?? 'Font';
  }

  function apply(value: string | null, close: () => void) {
    const chain = editor.chain().focus();
    if (value) {
      chain.setFontFamily(value).run();
    } else {
      chain.unsetFontFamily().run();
    }
    close();
  }
</script>

<ToolbarDropdown label={activeLabel()} width="w-48">
  {#snippet children(close)}
    {#each FONTS as font (font.label)}
      <button
        type="button"
        onclick={() => apply(font.value, close)}
        class="w-full text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500"
        style:font-family={font.preview}
      >
        {font.label}
      </button>
    {/each}
  {/snippet}
</ToolbarDropdown>
