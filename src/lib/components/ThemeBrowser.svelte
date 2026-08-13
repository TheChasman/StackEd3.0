<script lang="ts">
  import { fade } from 'svelte/transition';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { customThemesStore } from '$lib/stores/customThemes.svelte';
  import { catalogueSync } from '$lib/services/catalogueSync';
  import { getBase16Scheme, type Base16Scheme } from '$lib/themes/base16';
  import ThemeEditor from './ThemeEditor.svelte';
  import ThemePreview from './ThemePreview.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let activeTab = $state<'builtin' | 'custom' | 'catalogue'>('builtin');
  let searchQuery = $state('');
  let editingThemeId = $state<string | null>(null);
  let selectedThemeId = $state<string | null>(null);
  const baseRamp = ['base00', 'base01', 'base02', 'base03', 'base04', 'base05', 'base06', 'base07'];
  const accentRamp = [
    'base08',
    'base09',
    'base0A',
    'base0B',
    'base0C',
    'base0D',
    'base0E',
    'base0F',
  ];

  const catalogueSchemes = catalogueSync.getCatalogueSchemes();
  const builtinSchemes = themeStore
    .getAllSchemeIds()
    .map((id) => getBase16Scheme(id))
    .filter((scheme): scheme is Base16Scheme => Boolean(scheme));

  function selectBuiltinTheme(schemeId: string) {
    themeStore.setScheme(schemeId);
    onclose();
  }

  async function selectCustomTheme(id: string) {
    await customThemesStore.applyCustomTheme(id);
    selectedThemeId = id;
  }

  async function deleteCustomTheme(id: string) {
    if (confirm('Delete this theme?')) {
      await customThemesStore.deleteTheme(id);
    }
  }

  async function cloneTheme(id: string) {
    const theme = customThemesStore.customThemes.find((t) => t.id === id);
    if (theme) {
      const newName = prompt('New theme name:', `${theme.name} (Copy)`);
      if (newName) {
        await customThemesStore.cloneTheme(id, newName);
      }
    }
  }

  async function importFromCatalogue(schemeId: string) {
    const theme = await customThemesStore.importFromCatalogue(schemeId);
    activeTab = 'custom';
    selectedThemeId = theme.id;
  }

  async function importAllDarkFromCatalogue() {
    for (const { id } of catalogueSchemes) {
      await customThemesStore.importFromCatalogue(id);
    }
    activeTab = 'custom';
  }

  function isImportedFromCatalogue(schemeId: string): boolean {
    return customThemesStore.customThemes.some((theme) => theme.catalogueId === schemeId);
  }

  function getPaletteAsRecord(schemeId: string): Record<string, string> {
    const scheme = getBase16Scheme(schemeId);
    return scheme ? { ...scheme.colors } : {};
  }

  const filtered = $derived(
    activeTab === 'custom'
      ? customThemesStore.customThemes.filter(
          (t) =>
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.description?.toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : customThemesStore.customThemes,
  );
</script>

<div
  class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
  onclick={() => onclose()}
  onkeydown={(e) => e.key === 'Escape' && onclose()}
  role="dialog"
  aria-modal="true"
>
  <div
    class="bg-dark-800 border border-dark-600 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
    onclick={(e) => e.stopPropagation()}
    transition:fade={{ duration: 150 }}
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-5 border-b border-dark-700 shrink-0">
      <h2 class="text-2xl font-semibold text-dark-100">Theme Manager</h2>
      <button
        onclick={onclose}
        class="text-dark-400 hover:text-dark-200 text-4xl leading-none"
        title="Close (Esc)"
      >
        ×
      </button>
    </div>

    <!-- Tabs -->
    <div class="flex gap-0 px-6 pt-5 border-b border-dark-700 shrink-0">
      {#each [{ id: 'builtin', label: 'Built-in Schemes' }, { id: 'custom', label: 'My Themes' }, { id: 'catalogue', label: 'Dark Catalogue' }] as tab}
        <button
          onclick={() => (activeTab = tab.id as any)}
          class="px-5 py-3 text-base font-medium border-b-2 transition-colors {activeTab === tab.id
            ? 'text-primary-400 border-primary-500'
            : 'text-dark-400 border-transparent hover:text-dark-300'}"
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      {#if editingThemeId}
        <ThemeEditor themeId={editingThemeId} onclose={() => (editingThemeId = null)} />
      {:else if activeTab === 'builtin'}
        <div class="p-6 grid grid-cols-2 gap-5">
          {#each builtinSchemes as scheme (scheme.id)}
            <button
              onclick={() => selectBuiltinTheme(scheme.id)}
              class="group p-5 rounded-lg border border-dark-600 hover:border-primary-500 hover:bg-dark-700 transition-all text-left"
            >
              <div class="flex items-center gap-3 mb-4">
                <span class="text-4xl">{scheme.emoji}</span>
                <div>
                  <div class="font-semibold text-dark-100 text-base">{scheme.name}</div>
                  <div class="text-sm text-dark-400">{scheme.description}</div>
                </div>
              </div>
              <ThemePreview colors={getPaletteAsRecord(scheme.id)} />
            </button>
          {/each}
        </div>
      {:else if activeTab === 'custom'}
        <div class="p-6">
          <div class="mb-4">
            <input
              type="text"
              placeholder="Search themes..."
              bind:value={searchQuery}
              class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded text-base text-dark-100 placeholder-dark-500"
            />
          </div>

          {#if filtered.length === 0}
            <div class="text-center py-12 text-dark-400">
              {searchQuery
                ? 'No themes match your search'
                : 'No custom themes yet. Import from the dark catalogue or clone a built-in theme.'}
            </div>
          {:else}
            <div class="space-y-2">
              {#each filtered as theme (theme.id)}
                <div
                  class="p-4 rounded-lg border {selectedThemeId === theme.id
                    ? 'border-primary-500 bg-dark-700'
                    : 'border-dark-600 hover:border-dark-500'} cursor-pointer transition-all"
                  onclick={() => selectCustomTheme(theme.id)}
                >
                  <div class="flex items-start justify-between mb-2">
                    <div>
                      <div class="font-semibold text-dark-100">{theme.name}</div>
                      {#if theme.description}
                        <div class="text-xs text-dark-400 mt-1">{theme.description}</div>
                      {/if}
                    </div>
                    <div class="flex gap-1">
                      <button
                        onclick={(e) => {
                          e.stopPropagation();
                          customThemesStore.toggleFavorite(theme.id);
                        }}
                        class="text-dark-400 hover:text-yellow-400 text-lg"
                        title="Toggle favorite"
                      >
                        {theme.isFavorite ? '⭐' : '☆'}
                      </button>
                    </div>
                  </div>
                  <ThemePreview colors={theme.colors} />
                  <div class="flex gap-2 mt-3">
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        editingThemeId = theme.id;
                      }}
                      class="px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded text-sm text-dark-200"
                    >
                      Edit
                    </button>
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        cloneTheme(theme.id);
                      }}
                      class="px-4 py-2 bg-dark-600 hover:bg-dark-500 rounded text-sm text-dark-200"
                    >
                      Clone
                    </button>
                    <button
                      onclick={(e) => {
                        e.stopPropagation();
                        deleteCustomTheme(theme.id);
                      }}
                      class="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded text-sm text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if activeTab === 'catalogue'}
        <div class="p-6 space-y-6">
          <div
            class="flex items-center justify-between gap-3 rounded-lg border border-dark-600 bg-dark-700/60 p-4"
          >
            <p class="text-sm text-dark-300">
              Curated Base16-compatible dark themes. Add all in one click, then edit in My Themes.
            </p>
            <button
              onclick={importAllDarkFromCatalogue}
              class="px-4 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded text-sm font-medium transition-colors"
            >
              + Add All Dark Schemes
            </button>
          </div>
          {#each catalogueSchemes as scheme (scheme.id)}
            {@const paletteColors = getPaletteAsRecord(scheme.id)}
            <div
              class="p-5 rounded-lg border border-dark-600 hover:border-green-500 transition-all"
            >
              <div class="flex items-center justify-between mb-5">
                <div class="flex items-center gap-4">
                  <span class="text-5xl">{scheme.emoji}</span>
                  <div>
                    <div class="font-semibold text-dark-100 text-lg">{scheme.name}</div>
                    <div class="text-sm text-dark-400">{scheme.description}</div>
                  </div>
                </div>
                <button
                  onclick={() => importFromCatalogue(scheme.id)}
                  class="px-5 py-3 rounded text-base font-medium transition-colors {isImportedFromCatalogue(
                    scheme.id,
                  )
                    ? 'bg-dark-600 text-dark-200 hover:bg-dark-500'
                    : 'bg-green-900/30 hover:bg-green-900/50 text-green-400'}"
                >
                  {isImportedFromCatalogue(scheme.id) ? 'Open in My Themes' : '+ Add to My Themes'}
                </button>
              </div>

              <div class="space-y-4">
                <div>
                  <h5 class="text-sm font-semibold text-dark-300 uppercase mb-3">Base Ramp</h5>
                  <div class="grid grid-cols-8 gap-3">
                    {#each baseRamp as colorName}
                      <div class="flex flex-col items-center gap-2">
                        <div
                          class="w-full aspect-square rounded border border-dark-500"
                          style="background-color: {paletteColors[colorName]}"
                          title={colorName}
                        ></div>
                        <span class="text-sm text-dark-400">{colorName}</span>
                      </div>
                    {/each}
                  </div>
                </div>

                <div>
                  <h5 class="text-sm font-semibold text-dark-300 uppercase mb-3">Accent Ramp</h5>
                  <div class="grid grid-cols-8 gap-3">
                    {#each accentRamp as colorName}
                      <div class="flex flex-col items-center gap-2">
                        <div
                          class="w-full aspect-square rounded border border-dark-500"
                          style="background-color: {paletteColors[colorName]}"
                          title={colorName}
                        ></div>
                        <span class="text-sm text-dark-400">{colorName}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(body) {
    overflow: hidden;
  }
</style>
