<script lang="ts">
  import { getRecentFiles, type RecentFile } from '$lib/services/storage';
  import { openFile } from '$lib/services/files';
  import { documentStore } from '$lib/stores/document.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let recents = $state<RecentFile[]>([]);

  $effect(() => {
    getRecentFiles().then(r => { recents = r; }).catch(() => {});
  });

  async function open(file: RecentFile) {
    try {
      // Re-request permission before opening
      const perm = await (file.handle as any).queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        await (file.handle as any).requestPermission({ mode: 'readwrite' });
      }
      const parsed = await openFile(file.handle);
      documentStore.load(parsed.frontmatter, parsed.body, parsed.fieldOrder, parsed.fileHandle);
      onclose();
    } catch {
      alert('Could not reopen that file. Try opening it manually.');
    }
  }
</script>

<div class="fixed inset-0 bg-black/40 z-40" onclick={onclose} aria-hidden="true"></div>
<div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
  <div class="bg-dark-800 rounded-xl shadow-2xl w-full max-w-sm p-5 pointer-events-auto flex flex-col gap-3">
    <h2 class="text-base font-semibold">Recent Files</h2>
    {#if recents.length === 0}
      <p class="text-sm text-dark-400">No recent files.</p>
    {:else}
      <ul class="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {#each recents as file}
          <li>
            <button
              onclick={() => open(file)}
              class="w-full text-left px-3 py-2 rounded hover:bg-dark-700 text-sm"
            >
              <p class="font-medium truncate">{file.title}</p>
              <p class="text-xs text-dark-400">{new Date(file.openedAt).toLocaleDateString()}</p>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <button onclick={onclose} class="self-end text-sm text-dark-300 hover:text-dark-50">Close</button>
  </div>
</div>
