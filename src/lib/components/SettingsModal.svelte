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
    <div class="bg-dark-800 rounded-xl shadow-2xl w-full max-w-md p-6 pointer-events-auto flex flex-col gap-5">
      <h2 class="text-lg font-semibold">Settings</h2>

      <!-- AI Provider -->
      <section class="flex flex-col gap-2">
        <span class="text-sm font-medium">AI Provider</span>
        <div class="flex gap-3">
          {#each ['claude', 'openai'] as p}
            <button
              onclick={() => provider = p as 'claude' | 'openai'}
              class="px-4 py-2 rounded border text-sm {provider === p ? 'border-primary-500 bg-primary-900/30 text-primary-400' : 'border-dark-600 hover:bg-dark-700'}"
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
          class="border border-dark-600 rounded px-3 py-2 text-sm font-mono"
        />
        <p class="text-xs text-dark-400">Stored locally only. Never sent to any server.</p>
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
