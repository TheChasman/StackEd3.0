<script lang="ts">
  import { pruneRecentFiles, removeRecentFile, type RecentFile } from '$lib/services/storage';
  import { openScaffoldPath } from '$lib/services/files';
  import { syncRecentFilesMenu } from '$lib/services/recentMenu';
  import { documentStore } from '$lib/stores/document.svelte';
  import { viewStore } from '$lib/stores/view.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let recents = $state<RecentFile[]>([]);

  async function loadRecents() {
    recents = await pruneRecentFiles().catch(() => []);
    await syncRecentFilesMenu(recents).catch(() => {});
  }

  $effect(() => {
    void loadRecents();
  });

  async function open(file: RecentFile) {
    try {
      const scaffold = await openScaffoldPath(file.filePath);
      documentStore.openInNewTab(scaffold, file.filePath);
      viewStore.openDocument();
      onclose();
    } catch {
      if (typeof file.id === 'number') {
        await removeRecentFile(file.id).catch(() => {});
      }
      await loadRecents();
      alert('Could not reopen that file. If it was missing, it has been removed from recents.');
    }
  }
</script>

<div class="fixed inset-0 bg-black/40 z-40" onclick={onclose} aria-hidden="true"></div>
<div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
  <div
    class="bg-dark-800 rounded-xl shadow-2xl w-full max-w-sm p-5 pointer-events-auto flex flex-col gap-3"
  >
    <h2 class="text-base font-semibold">Recent Files</h2>
    {#if recents.length === 0}
      <p class="text-sm text-dark-400">No recent files.</p>
    {:else}
      <ul class="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {#each recents as file (file.id ?? file.openedAt)}
          <li>
            <button
              onclick={() => open(file)}
              class="w-full text-left px-3 py-2 rounded hover:bg-dark-700 text-sm"
            >
              <p class="font-medium truncate">{file.title}</p>
              <p class="text-xs text-dark-400 truncate">{file.filePath}</p>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <button onclick={onclose} class="self-end text-sm text-dark-300 hover:text-dark-50"
      >Close</button
    >
  </div>
</div>
