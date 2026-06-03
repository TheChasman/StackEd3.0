<script lang="ts">
  import { fade } from 'svelte/transition';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { catppuccinPalettes, type CatppuccinFlavor } from '$lib/themes/catppuccin';

  const themes: { value: CatppuccinFlavor; label: string; description: string }[] = [
    { value: 'latte', label: 'Latte', description: 'Light theme' },
    { value: 'frappe', label: 'Frappé', description: 'Dark theme' },
    { value: 'macchiato', label: 'Macchiato', description: 'Dark with cool tones' },
    { value: 'mocha', label: 'Mocha', description: 'Dark with warm tones' },
  ];

  let open = $state(false);

  let { onBrowse }: { onBrowse?: () => void } = $props();

  function handleSelect(flavor: CatppuccinFlavor) {
    themeStore.setFlavor(flavor);
    open = false;
  }

  function getThemeColor(flavor: CatppuccinFlavor, colorName: keyof typeof catppuccinPalettes['latte']): string {
    return catppuccinPalettes[flavor][colorName];
  }

  function handleBrowse() {
    open = false;
    onBrowse?.();
  }
</script>

<div class="flex items-center gap-1">
  <button
    onclick={() => themeStore.cyclePrev()}
    class="px-3 py-2.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-primary-500 text-lg transition-colors"
    title="Previous theme (Cmd+Shift+←)"
  >
    ‹
  </button>

  <div class="relative">
    <button
      onclick={() => (open = !open)}
      class="px-4 py-2.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-primary-500 text-base flex items-center gap-2 transition-colors"
      title="Theme switcher"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a6 6 0 016 6v4a6 6 0 016-6h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a6 6 0 00-6-6H9a6 6 0 00-6 6v4a2 2 0 002 2z"
        />
      </svg>
      <span class="capitalize">{themeStore.currentFlavor}</span>
    </button>

    {#if open}
      <div
        class="fixed inset-0 z-30"
        onclick={() => (open = false)}
        onkeydown={(e) => e.key === 'Escape' && (open = false)}
        aria-hidden="true"
      ></div>
      <div
        class="absolute top-full mt-1 right-0 z-40 w-96 bg-dark-800 border border-dark-600 rounded-lg shadow-xl overflow-hidden"
        transition:fade={{ duration: 100 }}
      >
        {#each themes as theme (theme.value)}
          <button
            type="button"
            onclick={() => handleSelect(theme.value)}
            class="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-dark-700 text-dark-200 transition-colors border-b border-dark-700"
          >
            <!-- Theme color swatches -->
            <div class="flex gap-2">
              <div class="w-4 h-4 rounded-full" style="background-color: {getThemeColor(theme.value, 'base')}; border: 1px solid {getThemeColor(theme.value, 'surface0')};"></div>
              <div class="w-4 h-4 rounded-full" style="background-color: {getThemeColor(theme.value, 'text')}"></div>
              <div class="w-4 h-4 rounded-full" style="background-color: {getThemeColor(theme.value, 'blue')}"></div>
              <div class="w-4 h-4 rounded-full" style="background-color: {getThemeColor(theme.value, 'green')}"></div>
            </div>

            <div class="flex-1">
              <div class="font-medium text-base">{theme.label}</div>
              <div class="text-sm text-dark-400">{theme.description}</div>
            </div>

            {#if themeStore.currentFlavor === theme.value}
              <svg class="w-5 h-5 text-primary-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path
                  d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
                />
              </svg>
            {/if}
          </button>
        {/each}

        <button
          type="button"
          onclick={handleBrowse}
          class="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-dark-700 text-primary-400 transition-colors border-t border-dark-700 font-medium text-base"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Browse & Manage Themes
        </button>
      </div>
    {/if}
  </div>

  <button
    onclick={() => themeStore.cycleNext()}
    class="px-3 py-2.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-primary-500 text-lg transition-colors"
    title="Next theme (Cmd+Shift+→)"
  >
    ›
  </button>
</div>

<style>
  :global([data-sveltekit-preload-data="hover"]) {
    @apply cursor-pointer;
  }
</style>
