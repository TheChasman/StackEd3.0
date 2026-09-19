<script lang="ts">
  import { ArrowLeft, Flag, Wrench } from 'lucide-svelte';
  import Editor from '$lib/components/editor/Editor.svelte';
  import ResearchPanel from '$lib/components/research/ResearchPanel.svelte';
  import ArtworkPanel from '$lib/components/artwork/ArtworkPanel.svelte';
  import ImageGenerationPanel from '$lib/components/image-generation/ImageGenerationPanel.svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { settingsStore, type ToolTab } from '$lib/stores/settings.svelte';
  import { viewStore } from '$lib/stores/view.svelte';

  const TOOL_TABS: Array<{ id: ToolTab; label: string }> = [
    { id: 'research', label: 'Research' },
    { id: 'artwork', label: 'Artwork' },
    { id: 'generate', label: 'Generate' },
  ];
</script>

<div class="flex flex-col h-full min-h-0">
  <header class="flex items-center gap-3 px-5 py-3 border-b border-dark-700 bg-dark-800 shrink-0">
    <button
      onclick={() => viewStore.goLibrary()}
      class="flex items-center gap-1.5 text-sm text-dark-300 hover:text-dark-100"
      title="Library"
    >
      <ArrowLeft class="h-4 w-4" />
      Library
    </button>
    <span class="flex-1 px-2 text-sm text-dark-200 truncate">
      {documentStore.title || 'Untitled'}
    </span>
    <button
      onclick={() => settingsStore.toggleToolsDrawer()}
      class="flex items-center gap-1.5 px-3 py-2 border rounded text-sm hover:bg-dark-700 {settingsStore.toolsDrawerOpen
        ? 'border-primary-500 text-primary-300'
        : 'border-dark-600 text-dark-200'}"
      title="Research, Artwork, Generate"
    >
      <Wrench class="h-4 w-4" />
      Tools
    </button>
    <button
      onclick={() => viewStore.showPlan()}
      class="px-3 py-2 border border-dark-600 rounded text-sm text-dark-200 hover:bg-dark-700"
      title="Spark, Hook, Landing, target date"
    >
      Plan
    </button>
    <button
      onclick={() => viewStore.showFinish()}
      class="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-dark-900 rounded text-sm font-medium hover:bg-primary-700"
      title="Publish review"
    >
      <Flag class="h-4 w-4" />
      Finish
    </button>
  </header>

  <div class="flex flex-1 min-h-0 overflow-hidden">
    <!-- Writing column -->
    <div class="flex-1 min-w-0 flex flex-col">
      <Editor />
    </div>

    <!-- Tools drawer (on demand, remembered per session) -->
    {#if settingsStore.toolsDrawerOpen}
      <aside class="w-[360px] shrink-0 border-l border-dark-700 bg-dark-900 flex flex-col min-h-0">
        <div
          class="flex overflow-x-auto min-h-10 border-b border-dark-600 bg-dark-800 px-2 pt-2 shrink-0"
        >
          {#each TOOL_TABS as tab (tab.id)}
            <button
              onclick={() => settingsStore.openTools(tab.id)}
              class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 {settingsStore.activeTool ===
              tab.id
                ? 'border-dark-600 bg-dark-900 text-dark-100'
                : 'border-transparent text-dark-400 hover:text-dark-200'}"
            >
              {tab.label}
            </button>
          {/each}
        </div>
        <div class="flex-1 overflow-y-auto min-h-0">
          {#if settingsStore.activeTool === 'research'}
            <ResearchPanel />
          {:else if settingsStore.activeTool === 'artwork'}
            <ArtworkPanel />
          {:else}
            <ImageGenerationPanel />
          {/if}
        </div>
      </aside>
    {/if}
  </div>
</div>
