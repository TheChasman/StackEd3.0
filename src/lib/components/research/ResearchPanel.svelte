<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { documentStore } from '$lib/stores/document.svelte';
  import { pmDocToText } from '$lib/utils/pmText';
  import { buildResearchPrompt } from '$lib/services/ai/context';
  import type { SearchResult } from '$lib/services/ai/adapter';

  let query = $state('');
  let result = $state<SearchResult | null>(null);
  let loading = $state(false);
  let error = $state('');

  // Exposed so Editor.svelte can call it with highlighted text
  export function setQuery(text: string) {
    query = text;
  }

  async function search() {
    if (!query.trim()) return;
    error = '';
    loading = true;
    result = null;
    try {
      const prompt = buildResearchPrompt(query, {
        scaffold: documentStore.scaffold,
        bodyText: pmDocToText(documentStore.body),
        filePath: documentStore.filePath,
      });
      // Key is resolved from SpockLock inside the Rust command; it never enters the WebView.
      const { summary, citations } = await invoke<{ summary: string; citations: string[] }>('research_web', { prompt });
      result = {
        query,
        summary,
        citations: citations.map((url) => ({ title: url, url, snippet: '' })),
      };
    } catch (e) {
      error = typeof e === 'string' ? e : e instanceof Error ? e.message : 'Research failed.';
    } finally {
      loading = false;
    }
  }

  function insertAtCursor(text: string) {
    // Dispatch a custom event; Editor.svelte listens and inserts at cursor
    window.dispatchEvent(new CustomEvent('stacked:insert', { detail: { text } }));
  }
</script>

<div class="flex flex-col h-full">
  <!-- Search input -->
  <div class="p-3 border-b border-dark-600">
    <div class="flex gap-1">
      <input
        type="text"
        bind:value={query}
        placeholder="Research topic or question…"
        class="flex-1 text-sm border border-dark-600 rounded px-2 py-1"
        onkeydown={(e) => e.key === 'Enter' && search()}
      />
      <button
        onclick={search}
        disabled={loading || !query.trim()}
        class="px-3 py-1 bg-primary-600 text-dark-900 text-sm rounded hover:bg-primary-700 disabled:opacity-50"
      >
        {loading ? '…' : 'Go'}
      </button>
    </div>
    {#if error}
      <p class="text-xs text-red-600 mt-1">{error}</p>
    {/if}
  </div>

  <!-- Results -->
  <div class="flex-1 overflow-y-auto p-3">
    {#if loading}
      <p class="text-sm text-dark-400 animate-pulse">Researching…</p>
    {:else if result}
      <div class="flex flex-col gap-3">
        <div class="text-sm text-dark-100 whitespace-pre-wrap leading-relaxed">{result.summary}</div>

        {#if result.citations.length > 0}
          <div>
            <p class="text-xs font-semibold text-dark-400 uppercase mb-1">Sources</p>
            <ul class="flex flex-col gap-1">
              {#each result.citations as cite (cite.url)}
                <li class="text-xs">
                  <a href={cite.url} target="_blank" rel="noopener" class="text-primary-400 hover:underline truncate block">{cite.title}</a>
                  {#if cite.snippet}<p class="text-dark-300 line-clamp-2">{cite.snippet}</p>{/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <button
          onclick={() => insertAtCursor(`\n\n> ${result!.summary}\n`)}
          class="self-start text-xs px-3 py-1 border border-dark-600 rounded hover:bg-dark-700"
        >
          Insert summary
        </button>
      </div>
    {:else}
      <p class="text-sm text-dark-400">Enter a query above to research a topic.</p>
    {/if}
  </div>
</div>
