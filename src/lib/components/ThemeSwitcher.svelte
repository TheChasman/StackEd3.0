<script lang="ts">
  import { fade } from 'svelte/transition';
  import { themeStore } from '$lib/stores/theme.svelte';
  import type { CatppuccinFlavor } from '$lib/themes/catppuccin';

  const themes: { value: CatppuccinFlavor; label: string; description: string }[] = [
    { value: 'latte', label: 'Latte', description: 'Light theme' },
    { value: 'frappe', label: 'Frappé', description: 'Dark theme' },
    { value: 'macchiato', label: 'Macchiato', description: 'Dark with cool tones' },
    { value: 'mocha', label: 'Mocha', description: 'Dark with warm tones' },
  ];

  let open = $state(false);

  function handleSelect(flavor: CatppuccinFlavor) {
    themeStore.setFlavor(flavor);
    open = false;
  }
</script>

<div class="relative">
  <button
    onclick={() => (open = !open)}
    class="px-3 py-1.5 rounded bg-dark-700 hover:bg-dark-600 text-dark-200 hover:text-primary-500 text-sm flex items-center gap-2 transition-colors"
    title="Theme switcher"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      class="absolute top-full mt-1 right-0 z-40 w-48 bg-dark-800 border border-dark-600 rounded-lg shadow-xl overflow-hidden"
      transition:fade={{ duration: 100 }}
    >
      {#each themes as theme (theme.value)}
        <button
          type="button"
          onclick={() => handleSelect(theme.value)}
          class="w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-dark-700 hover:text-primary-500 text-dark-200 transition-colors border-b border-dark-700 last:border-b-0"
        >
          <div class="flex-1">
            <div class="font-medium">{theme.label}</div>
            <div class="text-xs text-dark-400">{theme.description}</div>
          </div>
          {#if themeStore.currentFlavor === theme.value}
            <svg class="w-4 h-4 text-primary-500" fill="currentColor" viewBox="0 0 24 24">
              <path
                d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
              />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  :global([data-sveltekit-preload-data="hover"]) {
    @apply cursor-pointer;
  }
</style>
