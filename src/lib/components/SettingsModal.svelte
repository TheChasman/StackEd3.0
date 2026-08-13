<script lang="ts">
  import { onMount } from 'svelte';
  import { openFolder } from '$lib/services/files';
  import { loadPipelineFolderPath, savePipelineFolderPath } from '$lib/services/storage';
  import { substackConnectionsStore } from '$lib/stores/substackConnections.svelte';

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();
  let pipelineFolderPath = $state('');
  let pipelineFolderName = $derived(folderName(pipelineFolderPath));

  let newSubdomain = $state('');
  let newNickname = $state('');
  let addError = $state('');

  async function addConnection() {
    addError = '';
    const res = await substackConnectionsStore.addConnection({
      subdomain: newSubdomain,
      nickname: newNickname,
    });
    if (!res.ok) {
      addError = res.error === 'empty' ? 'Enter a subdomain.' : 'That subdomain is already saved.';
      return;
    }
    newSubdomain = '';
    newNickname = '';
  }

  function renameConnection(id: string, value: string) {
    const trimmed = value.trim();
    if (trimmed) void substackConnectionsStore.renameConnection(id, trimmed);
  }

  function folderName(path: string): string {
    const normalized = path.replaceAll('\\', '/').replace(/\/+$/, '');
    return normalized.split('/').pop() ?? normalized;
  }

  onMount(() => {
    loadPipelineFolderPath()
      .then((path) => {
        pipelineFolderPath = path ?? '';
      })
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
    <div
      class="bg-dark-800 rounded-xl shadow-2xl w-full max-w-md p-6 pointer-events-auto flex flex-col gap-5"
    >
      <h2 class="text-lg font-semibold">Settings</h2>

      <!-- AI credentials -->
      <section class="flex flex-col gap-1">
        <span class="text-sm font-medium">AI Credentials</span>
        <p class="text-xs text-dark-400">
          AI keys are resolved from SpockLock at call time and never stored on disk. Manage them in
          your SpockLock vault, not here.
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
            <p class="text-xs text-dark-300 truncate" title={pipelineFolderPath}>
              {pipelineFolderPath}
            </p>
          </div>
        {/if}
        <p class="text-xs text-dark-400">
          Select your StackPipe vault folder for quick file access.
        </p>
      </section>

      <!-- Substack connections -->
      <section class="flex flex-col gap-2">
        <span class="text-sm font-medium">Substack Connections</span>
        {#if substackConnectionsStore.connections.length === 0}
          <p class="text-xs text-dark-400">
            No connections yet. Add a Substack subdomain below; it will appear in the publication
            dropdown on each post.
          </p>
        {:else}
          <ul class="flex flex-col gap-1">
            {#each substackConnectionsStore.connections as conn (conn.id)}
              <li
                class="flex items-center gap-2 rounded border border-dark-600 bg-dark-900/60 px-2 py-1.5"
              >
                <input
                  type="text"
                  value={conn.nickname}
                  onblur={(e) => renameConnection(conn.id, e.currentTarget.value)}
                  onkeydown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                  }}
                  class="flex-1 bg-transparent text-sm text-dark-100 focus:outline-none focus:border-b focus:border-primary-500"
                  aria-label="Connection nickname"
                />
                <span class="text-xs text-dark-500 whitespace-nowrap"
                  >{conn.subdomain}.substack.com</span
                >
                <button
                  onclick={() => substackConnectionsStore.deleteConnection(conn.id)}
                  class="text-xs text-dark-400 hover:text-red-400 px-1"
                  aria-label="Delete connection"
                  title="Delete connection"
                >
                  ✕
                </button>
              </li>
            {/each}
          </ul>
        {/if}
        <div class="flex items-center gap-1">
          <input
            type="text"
            bind:value={newSubdomain}
            onkeydown={(e) => {
              if (e.key === 'Enter') addConnection();
            }}
            placeholder="subdomain"
            class="w-32 bg-dark-800 border border-dark-600 rounded p-1.5 text-dark-100 focus:border-primary-500 text-sm"
          />
          <input
            type="text"
            bind:value={newNickname}
            onkeydown={(e) => {
              if (e.key === 'Enter') addConnection();
            }}
            placeholder="nickname (optional)"
            class="flex-1 bg-dark-800 border border-dark-600 rounded p-1.5 text-dark-100 focus:border-primary-500 text-sm"
          />
          <button
            onclick={addConnection}
            class="px-3 py-1.5 border border-dark-600 rounded text-sm hover:bg-dark-700 whitespace-nowrap"
          >
            Add
          </button>
        </div>
        {#if addError}
          <p class="text-xs text-red-400">{addError}</p>
        {/if}
      </section>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button onclick={onclose} class="px-4 py-2 text-sm text-dark-200 hover:bg-dark-700 rounded"
          >Cancel</button
        >
        <button
          onclick={save}
          class="px-4 py-2 text-sm bg-primary-600 text-dark-900 rounded hover:bg-primary-700"
          >Save</button
        >
      </div>
    </div>
  </div>
{/if}
