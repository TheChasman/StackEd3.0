<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';

  let { saveStatus = '' }: { saveStatus?: '' | 'unsaved' | 'saving' | 'saved' } = $props();

  let wordCount = $derived(documentStore.wordCount);
  let dirty = $derived(documentStore.dirty);
  let filePath = $derived(documentStore.filePath);
  let fileName = $derived(filePath?.split('/').pop() ?? 'Untitled');
</script>

<footer
  class="relative z-10 flex items-center gap-4 px-4 py-1.5 border-t border-dark-700 bg-dark-800 text-xs text-dark-300 shrink-0"
>
  <span class="truncate max-w-xs" title={filePath ?? ''}>
    {fileName}
    {#if dirty}<span class="text-amber-500 ml-1">●</span>{/if}
  </span>
  <span class="text-dark-500">
    {#if saveStatus === 'saving'}Saving…{:else if saveStatus === 'saved'}Saved{:else if saveStatus === 'unsaved'}Unsaved{/if}
  </span>
  <span class="ml-auto">{wordCount} words</span>
</footer>
