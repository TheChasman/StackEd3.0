<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import { buildInfo, buildLabel } from '$lib/utils/buildInfo';

  let wordCount = $derived(documentStore.wordCount);
  let dirty = $derived(documentStore.dirty);
  let filePath = $derived(documentStore.filePath);
  let fileName = $derived(filePath?.split('/').pop() ?? 'No file open');

  function reloadApp(): void {
    window.location.reload();
  }

  let copied = $state(false);
  async function copyVersion(): Promise<void> {
    await navigator.clipboard.writeText(`StackEd ${buildLabel}`);
    copied = true;
    setTimeout(() => (copied = false), 1200);
  }
</script>

<footer class="relative z-10 flex items-center gap-4 px-4 py-1.5 border-t border-dark-700 bg-dark-800 text-xs text-dark-300 shrink-0">
  <span class="truncate max-w-xs" title={filePath ?? ''}>
    {fileName}
    {#if dirty}<span class="text-amber-500 ml-1">●</span>{/if}
  </span>
  <button
    type="button"
    onclick={copyVersion}
    class="rounded border border-dark-600 bg-dark-900 px-2 py-0.5 font-mono text-[11px] text-primary-300 shadow-sm hover:bg-dark-700 hover:text-primary-200 active:bg-dark-800"
    title="Click to copy build version"
  >
    {copied ? 'Copied!' : `StackEd ${buildLabel}`}
  </button>
  {#if buildInfo.dev}
    <button
      type="button"
      onclick={reloadApp}
      class="rounded border border-dark-600 bg-dark-700 px-2 py-0.5 text-[11px] text-dark-100 shadow-sm hover:bg-dark-600 hover:shadow active:bg-dark-800 active:shadow-none"
      title="Reload this editor window"
    >
      Reload
    </button>
  {/if}
  <span class="ml-auto">{wordCount} words</span>
</footer>
