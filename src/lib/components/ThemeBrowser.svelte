<script lang="ts">
  import { fade } from 'svelte/transition';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { customThemesStore } from '$lib/stores/customThemes.svelte';
  import { catalogueSync } from '$lib/services/catalogueSync';
  import { catppuccinPalettes, type CatppuccinFlavor } from '$lib/themes/catppuccin';
  import ThemeEditor from './ThemeEditor.svelte';
  import ThemePreview from './ThemePreview.svelte';

  let { onclose }: { onclose: () => void } = $props();

  let activeTab = $state<'builtin' | 'custom' | 'catalogue'>('builtin');
  let searchQuery = $state('');
  let editingThemeId = $state<string | null>(null);
  let selectedThemeId = $state<string | null>(null);

  const officialFlavors = catalogueSync.getOfficialFlavors();
  const darkOfficialFlavors = officialFlavors.filter(({ dark }) => dark);

  function selectBuiltinTheme(flavor: string) {
    themeStore.setFlavor(flavor as any);
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
    const theme = customThemesStore.customThemes.find(t => t.id === id);
    if (theme) {
      const newName = prompt('New theme name:', `${theme.name} (Copy)`);
      if (newName) {
        await customThemesStore.cloneTheme(id, newName);
      }
    }
  }

  async function importFromCatalogue(flavor: CatppuccinFlavor) {
    const theme = await customThemesStore.importFromCatalogue(flavor);
    activeTab = 'custom';
    selectedThemeId = theme.id;
  }

  async function importAllDarkFromCatalogue() {
    for (const { flavor } of darkOfficialFlavors) {
      await customThemesStore.importFromCatalogue(flavor);
    }
    activeTab = 'custom';
  }

  function isImportedFromCatalogue(flavor: CatppuccinFlavor): boolean {
    return customThemesStore.customThemes.some((theme) => theme.catalogueFlavor === flavor);
  }

  function getPaletteAsRecord(flavor: string): Record<string, string> {
    const paletteData = catppuccinPalettes[flavor as keyof typeof catppuccinPalettes];
    const colors: Record<string, string> = {};
    if (paletteData) {
      for (const [key, value] of Object.entries(paletteData)) {
        colors[key] = value as string;
      }
    }
    return colors;
  }

  const filtered = $derived(
    activeTab === 'custom'
      ? customThemesStore.customThemes.filter(t =>
          t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : customThemesStore.customThemes
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
      {#each [
        { id: 'builtin', label: 'Built-in Flavors' },
        { id: 'custom', label: 'My Themes' },
        { id: 'catalogue', label: 'Catppuccin Catalogue' },
      ] as tab}
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
        <ThemeEditor
          themeId={editingThemeId}
          onclose={() => (editingThemeId = null)}
        />
      {:else if activeTab === 'builtin'}
        <div class="p-6 grid grid-cols-2 gap-5">
          {#each darkOfficialFlavors as { flavor, name, emoji }}
            <button
              onclick={() => selectBuiltinTheme(flavor)}
              class="group p-5 rounded-lg border border-dark-600 hover:border-primary-500 hover:bg-dark-700 transition-all text-left"
            >
              <div class="flex items-center gap-3 mb-4">
                <span class="text-4xl">{emoji}</span>
                <div>
                  <div class="font-semibold text-dark-100 text-base">{name}</div>
                  <div class="text-sm text-dark-400">Official Catppuccin</div>
                </div>
              </div>
              <ThemePreview colors={getPaletteAsRecord(flavor)} />
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
              {searchQuery ? 'No themes match your search' : 'No custom themes yet. Create one or import from the catalogue!'}
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
          <div class="flex items-center justify-between gap-3 rounded-lg border border-dark-600 bg-dark-700/60 p-4">
            <p class="text-sm text-dark-300">Dark Catppuccin themes only. Add all official dark flavors in one click.</p>
            <button
              onclick={importAllDarkFromCatalogue}
              class="px-4 py-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded text-sm font-medium transition-colors"
            >
              + Add All Dark Themes
            </button>
          </div>
          {#each darkOfficialFlavors as { flavor, name, emoji, dark }}
            {@const paletteColors = getPaletteAsRecord(flavor)}
            <div class="p-5 rounded-lg border border-dark-600 hover:border-green-500 transition-all">
              <div class="flex items-center justify-between mb-5">
                <div class="flex items-center gap-4">
                  <span class="text-5xl">{emoji}</span>
                  <div>
                    <div class="font-semibold text-dark-100 text-lg">{name}</div>
                    <div class="text-sm text-dark-400">Catppuccin v1.8.0 · {dark ? 'Dark' : 'Light'} Theme</div>
                  </div>
                </div>
                <button
                  onclick={() => importFromCatalogue(flavor)}
                  class="px-5 py-3 rounded text-base font-medium transition-colors {isImportedFromCatalogue(flavor)
                    ? 'bg-dark-600 text-dark-200 hover:bg-dark-500'
                    : 'bg-green-900/30 hover:bg-green-900/50 text-green-400'}"
                >
                  {isImportedFromCatalogue(flavor) ? 'Open in My Themes' : '+ Add to My Themes'}
                </button>
              </div>

              <!-- Color Grid: All 25 colors -->
              <div class="space-y-4">
                <!-- Accents -->
                <div>
                  <h5 class="text-sm font-semibold text-dark-300 uppercase mb-3">Accent Colors</h5>
                  <div class="grid grid-cols-7 gap-3">
                    {#each ['rosewater', 'flamingo', 'pink', 'mauve', 'red', 'maroon', 'peach', 'yellow', 'green', 'teal', 'sky', 'sapphire', 'blue', 'lavender'] as colorName}
                      <div class="flex flex-col items-center gap-2">
                        <div
                          class="w-full aspect-square rounded border border-dark-500"
                          style="background-color: {paletteColors[colorName]}"
                          title={colorName}
                        ></div>
                        <span class="text-sm text-dark-400">{colorName.slice(0, 4)}</span>
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Base & Text -->
                <div>
                  <h5 class="text-sm font-semibold text-dark-300 uppercase mb-3">Base & Text</h5>
                  <div class="grid grid-cols-6 gap-3">
                    {#each ['text', 'subtext1', 'subtext0', 'base', 'mantle', 'crust'] as colorName}
                      <div class="flex flex-col items-center gap-2">
                        <div
                          class="w-full aspect-square rounded border border-dark-500"
                          style="background-color: {paletteColors[colorName]}"
                          title={colorName}
                        ></div>
                        <span class="text-sm text-dark-400">{colorName.slice(0, 5)}</span>
                      </div>
                    {/each}
                  </div>
                </div>

                <!-- Overlays & Surfaces -->
                <div>
                  <h5 class="text-sm font-semibold text-dark-300 uppercase mb-3">Overlays & Surfaces</h5>
                  <div class="grid grid-cols-6 gap-3">
                    {#each ['overlay2', 'overlay1', 'overlay0', 'surface2', 'surface1', 'surface0'] as colorName}
                      <div class="flex flex-col items-center gap-2">
                        <div
                          class="w-full aspect-square rounded border border-dark-500"
                          style="background-color: {paletteColors[colorName]}"
                          title={colorName}
                        ></div>
                        <span class="text-sm text-dark-400">{colorName.slice(0, 5)}</span>
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
