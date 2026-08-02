<script lang="ts">
  import { onMount } from 'svelte';
  import { openFolder } from '$lib/services/files';
  import { loadPipelineFolderPath, savePipelineFolderPath } from '$lib/services/storage';

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();
  let pipelineFolderPath = $state('');
  let pipelineFolderName = $derived(folderName(pipelineFolderPath));

  function folderName(path: string): string {
    const normalized = path.replaceAll('\\', '/').replace(/\/+$/, '');
    return normalized.split('/').pop() ?? normalized;
  }

  onMount(() => {
    loadPipelineFolderPath()
      .then((path) => { pipelineFolderPath = path ?? ''; })
      .catch(() => {});
  });

  function save() {
    onclose();
  }

  async function connectFolder() {
    try {
      const path = await openFolder();
      if (!path) return;
      await savePipelineFolderPath(path);
      pipelineFolderPath = path;
      alert(`Connected: ${path}`);
    } catch (e) {
      alert('Could not connect Pipeline Folder: ' + (e instanceof Error ? e.message : e));
    }
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black/40 z-40" onclick={onclose} aria-hidden="true"></div>

  <!-- Modal -->
  <div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
    <div class="bg-dark-800 rounded-xl shadow-2xl w-full max-w-md p-6 pointer-events-auto flex flex-col gap-5">
      <h2 class="text-lg font-semibold">Settings</h2>

      <!-- AI credentials -->
      <section class="flex flex-col gap-1">
        <span class="text-sm font-medium">AI Credentials</span>
        <p class="text-xs text-dark-400">
          AI keys are resolved from SpockLock at call time and never stored on disk.
          Manage them in your SpockLock vault, not here.
        </p>
      </section>

      <!-- Pipeline folder -->
      <section class="flex flex-col gap-1">
        <span class="text-sm font-medium">Pipeline Folder</span>
        <button
          onclick={connectFolder}
          class="px-3 py-2 border border-dark-600 rounded text-sm hover:bg-dark-700 text-left"
        >
          Connect folder…
        </button>
        {#if pipelineFolderPath}
          <div class="rounded border border-dark-600 bg-dark-900/60 px-3 py-2">
            <p class="text-xs font-medium text-green-400">Connected: {pipelineFolderName}</p>
            <p class="text-xs text-dark-300 truncate" title={pipelineFolderPath}>{pipelineFolderPath}</p>
          </div>
        {/if}
        <p class="text-xs text-dark-400">Select your StackPipe vault folder for quick file access.</p>
      </section>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button onclick={onclose} class="px-4 py-2 text-sm text-dark-200 hover:bg-dark-700 rounded">Cancel</button>
        <button onclick={save} class="px-4 py-2 text-sm bg-primary-600 text-dark-900 rounded hover:bg-primary-700">Save</button>
      </div>
    </div>
  </div>
{/if}
