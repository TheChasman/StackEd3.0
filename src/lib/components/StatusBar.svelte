<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';

  let wordCount = $derived(documentStore.wordCount);
  let dirty = $derived(documentStore.dirty);
  let fileHandle = $derived(documentStore.fileHandle);
  let filePath = $derived(documentStore.filePath);
  let fileName = $derived(fileHandle?.name ?? filePath?.split('/').pop() ?? 'No file open');
</script>

<footer class="flex items-center gap-4 px-4 py-1.5 border-t border-dark-700 bg-dark-800 text-xs text-dark-300 shrink-0">
  <span class="truncate max-w-xs" title={filePath ?? fileHandle?.name}>
    {fileName}
    {#if dirty}<span class="text-amber-500 ml-1">●</span>{/if}
  </span>
  <span class="ml-auto">{wordCount} words</span>
</footer>
