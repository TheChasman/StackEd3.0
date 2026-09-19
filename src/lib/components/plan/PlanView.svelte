<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { viewStore } from '$lib/stores/view.svelte';

  let scaffold = $derived(documentStore.scaffold);
</script>

<div class="flex flex-col h-full min-h-0">
  <header class="flex items-center gap-3 px-5 py-3 border-b border-dark-700 bg-dark-800 shrink-0">
    <button
      onclick={() => viewStore.backToWrite()}
      class="flex items-center gap-1.5 text-sm text-dark-300 hover:text-dark-100"
      title="Back to writing"
    >
      <ArrowLeft class="h-4 w-4" />
      Write
    </button>
    <h1 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">Plan</h1>
    <span class="text-xs text-dark-500 truncate">{documentStore.title || 'Untitled'}</span>
  </header>

  <div class="flex-1 overflow-y-auto min-h-0">
    <div class="mx-auto w-full max-w-2xl px-6 py-6 flex flex-col gap-6 pb-16 text-sm">
      {#if scaffold}
        <!-- Workshop (never published) -->
        <section class="flex flex-col gap-3">
          <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">
            Workshop <span class="text-dark-600 normal-case">(never published)</span>
          </h3>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Spark</span>
            <textarea
              rows={3}
              value={scaffold.workshop.spark}
              onchange={(e) => documentStore.patchWorkshop('spark', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
            ></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Hook</span>
            <textarea
              rows={3}
              value={scaffold.workshop.hook}
              onchange={(e) => documentStore.patchWorkshop('hook', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
            ></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Landing</span>
            <textarea
              rows={3}
              value={scaffold.workshop.landing}
              onchange={(e) => documentStore.patchWorkshop('landing', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
            ></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Research</span>
            <textarea
              rows={4}
              value={scaffold.workshop.research}
              onchange={(e) => documentStore.patchWorkshop('research', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
            ></textarea>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={scaffold.workshop.aiGen}
              onchange={(e) => documentStore.patchWorkshop('aiGen', e.currentTarget.checked)}
            />
            <span class="text-dark-300">AI-GEN mode</span>
          </label>
        </section>

        <!-- Target date -->
        <section class="flex flex-col gap-2">
          <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">Target date</h3>
          <input
            type="date"
            value={scaffold.workshop.targetDate ?? ''}
            onchange={(e) =>
              documentStore.patchWorkshop('targetDate', e.currentTarget.value || null)}
            class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500 w-48"
          />
          <p class="text-xs text-dark-500">
            Local planning only — distinct from Substack scheduling in Finish.
          </p>
        </section>
      {:else}
        <p class="text-sm text-dark-400">No file open.</p>
      {/if}
    </div>
  </div>
</div>
