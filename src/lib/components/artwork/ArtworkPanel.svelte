<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { documentStore } from '$lib/stores/document.svelte';

  interface ArtworkImage {
    name: string;
    path: string;
    data_url: string;
  }

  let images = $state<ArtworkImage[]>([]);
  let loading = $state(true);
  let error = $state('');
  $effect(() => {
    void loadArtwork(documentStore.filePath);
  });

  async function loadArtwork(articlePath: string | null) {
    loading = true;
    error = '';
    try {
      images = await invoke<ArtworkImage[]>('list_artwork_images', { articlePath });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load artwork.';
    } finally {
      loading = false;
    }
  }

  function insertArtwork(image: ArtworkImage) {
    window.dispatchEvent(new CustomEvent('stacked:insert-image', {
      detail: {
        src: image.data_url,
        alt: image.name.replace(/\.[^.]+$/, ''),
        hero: true,
      },
    }));
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between gap-2 p-3 border-b border-dark-600">
    <div>
      <h3 class="text-xs font-semibold text-dark-300 uppercase tracking-wide">Hero Artwork</h3>
      <p class="text-xs text-dark-500">./artwork</p>
    </div>
    <button
      onclick={() => loadArtwork(documentStore.filePath)}
      class="px-2 py-1 text-xs border border-dark-600 rounded hover:bg-dark-700 text-dark-300"
      disabled={loading}
    >
      Refresh
    </button>
  </div>

  <div class="flex-1 overflow-y-auto p-3">
    {#if loading}
      <p class="text-sm text-dark-400">Loading artwork…</p>
    {:else if error}
      <p class="text-sm text-red-500">{error}</p>
    {:else if images.length === 0}
      <p class="text-sm text-dark-400">No images found in <code>./artwork</code>.</p>
    {:else}
      <div class="grid grid-cols-2 gap-3">
        {#each images as image (image.path)}
          <button
            type="button"
            onclick={() => insertArtwork(image)}
            class="group overflow-hidden rounded-lg border border-dark-600 bg-dark-800 text-left hover:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            title={`Insert ${image.name}`}
          >
            <img
              src={image.data_url}
              alt={image.name}
              class="aspect-video w-full object-cover bg-dark-700"
            />
            <span class="block truncate px-2 py-1.5 text-xs text-dark-300 group-hover:text-dark-100">
              {image.name}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
