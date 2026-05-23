<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';

  let fm = $derived(documentStore.frontmatter);
  let wordCount = $derived(documentStore.wordCount);
  let dirty = $derived(documentStore.dirty);
  let fileHandle = $derived(documentStore.fileHandle);
</script>

<footer class="flex items-center gap-4 px-4 py-1.5 border-t border-dark-700 bg-dark-800 text-xs text-dark-300 shrink-0">
  <span class="truncate max-w-xs" title={fileHandle?.name}>
    {fileHandle?.name ?? 'No file open'}
    {#if dirty}<span class="text-amber-500 ml-1">●</span>{/if}
  </span>
  <span>{wordCount} words</span>
  {#if fm}
    <span class="ml-auto capitalize">{fm.pipeline_stage.replace('_', ' ')}</span>
  {/if}
</footer>
