<script lang="ts">
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { openFolder } from '$lib/services/files';
  import { saveFolderHandle } from '$lib/services/storage';

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();
  let apiKey = $state(settingsStore.apiKey);
  let provider = $state(settingsStore.provider);

  function save() {
    settingsStore.setProvider(provider);
    settingsStore.setApiKey(apiKey);
    onclose();
  }

  async function connectFolder() {
    try {
      const handle = await openFolder();
      await saveFolderHandle(handle);
      alert(`Connected: ${handle.name}`);
    } catch {
      // User cancelled
    }
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black/40 z-40" onclick={onclose} aria-hidden="true"></div>

  <!-- Modal -->
  <div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 pointer-events-auto flex flex-col gap-5">
      <h2 class="text-lg font-semibold">Settings</h2>

      <!-- AI Provider -->
      <section class="flex flex-col gap-2">
        <label class="text-sm font-medium">AI Provider</label>
        <div class="flex gap-3">
          {#each ['claude', 'openai'] as p}
            <button
              onclick={() => provider = p as 'claude' | 'openai'}
              class="px-4 py-2 rounded border text-sm {provider === p ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}"
            >{p === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'}</button>
          {/each}
        </div>
      </section>

      <!-- API Key -->
      <section class="flex flex-col gap-1">
        <label for="api-key" class="text-sm font-medium">API Key</label>
        <input
          id="api-key"
          type="password"
          bind:value={apiKey}
          placeholder={provider === 'claude' ? 'sk-ant-…' : 'sk-…'}
          class="border border-gray-200 rounded px-3 py-2 text-sm font-mono"
        />
        <p class="text-xs text-gray-400">Stored locally only. Never sent to any server.</p>
      </section>

      <!-- Pipeline folder -->
      <section class="flex flex-col gap-1">
        <label class="text-sm font-medium">Pipeline Folder</label>
        <button
          onclick={connectFolder}
          class="px-3 py-2 border border-gray-200 rounded text-sm hover:bg-gray-50 text-left"
        >
          Connect folder…
        </button>
        <p class="text-xs text-gray-400">Select your StackPipe vault folder for quick file access.</p>
      </section>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button onclick={onclose} class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
        <button onclick={save} class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
      </div>
    </div>
  </div>
{/if}
