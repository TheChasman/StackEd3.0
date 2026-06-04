<script lang="ts">
  import { onMount } from 'svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { openFolder } from '$lib/services/files';
  import { loadPipelineFolderPath, savePipelineFolderPath } from '$lib/services/storage';

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();
  let anthropicApiKey = $state(settingsStore.anthropicApiKey);
  let openaiApiKey = $state(settingsStore.openaiApiKey);
  let provider = $state(settingsStore.provider);
  let pipelineFolderPath = $state('');
  let showAnthropicKey = $state(false);
  let showOpenAIKey = $state(false);
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
    settingsStore.setProvider(provider);
    settingsStore.setAnthropicApiKey(anthropicApiKey);
    settingsStore.setOpenAIApiKey(openaiApiKey);
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

      <!-- AI Provider -->
      <section class="flex flex-col gap-2">
        <span class="text-sm font-medium">AI Provider</span>
        <div class="flex gap-3">
          {#each ['claude', 'openai'] as p (p)}
            <button
              onclick={() => provider = p as 'claude' | 'openai'}
              class="px-4 py-2 rounded border text-sm {provider === p ? 'border-primary-500 bg-primary-900/30 text-primary-400' : 'border-dark-600 hover:bg-dark-700'}"
            >{p === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'}</button>
          {/each}
        </div>
      </section>

      <!-- API Keys -->
      <section class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <label for="anthropic-api-key" class="text-sm font-medium">Anthropic API Key</label>
          <div class="flex">
            <input
              id="anthropic-api-key"
              type={showAnthropicKey ? 'text' : 'password'}
              bind:value={anthropicApiKey}
              placeholder="No Anthropic key saved"
              autocomplete="new-password"
              spellcheck="false"
              class="min-w-0 flex-1 border border-dark-600 rounded-l px-3 py-2 text-sm font-mono"
            />
            <button
              type="button"
              onclick={() => showAnthropicKey = !showAnthropicKey}
              class="px-3 border border-l-0 border-dark-600 rounded-r hover:bg-dark-700"
              aria-label={showAnthropicKey ? 'Hide Anthropic API key' : 'Show Anthropic API key'}
              title={showAnthropicKey ? 'Hide' : 'Show'}
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
        <div class="flex flex-col gap-1">
          <label for="openai-api-key" class="text-sm font-medium">OpenAI API Key</label>
          <div class="flex">
            <input
              id="openai-api-key"
              type={showOpenAIKey ? 'text' : 'password'}
              bind:value={openaiApiKey}
              placeholder="No OpenAI key saved"
              autocomplete="new-password"
              spellcheck="false"
              class="min-w-0 flex-1 border border-dark-600 rounded-l px-3 py-2 text-sm font-mono"
            />
            <button
              type="button"
              onclick={() => showOpenAIKey = !showOpenAIKey}
              class="px-3 border border-l-0 border-dark-600 rounded-r hover:bg-dark-700"
              aria-label={showOpenAIKey ? 'Hide OpenAI API key' : 'Show OpenAI API key'}
              title={showOpenAIKey ? 'Hide' : 'Show'}
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>
        <p class="text-xs text-dark-400">Stored separately and locally only. Never sent to any server.</p>
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
