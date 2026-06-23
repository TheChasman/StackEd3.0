<script lang="ts">
  import { tick } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { documentStore } from '$lib/stores/document.svelte';
  import { relativeArtworkSrc } from '$lib/utils/artworkReferences';

  interface ArtworkImage {
    name: string;
    path: string;
    data_url: string;
    subtitle: string;
    credit: string;
  }

  let images = $state<ArtworkImage[]>([]);
  let loading = $state(true);
  let error = $state('');
  let inlineAsHero = $state(false);

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

  function imageAlt(image: ArtworkImage): string {
    return image.name.replace(/\.[^.]+$/, '');
  }

  async function saveMetadata(image: ArtworkImage, subtitle: string, credit: string) {
    if (!documentStore.filePath) return;
    await invoke('save_artwork_metadata', {
      articlePath: documentStore.filePath,
      imageName: image.name,
      metadata: { subtitle, credit },
    });
    image.subtitle = subtitle;
    image.credit = credit;
  }

  async function editMetadata(image: ArtworkImage) {
    const subtitle = window.prompt('Image subtitle:', image.subtitle) ?? image.subtitle;
    const credit = window.prompt('Image credit:', image.credit) ?? image.credit;
    await saveMetadata(image, subtitle.trim(), credit.trim());
  }

  async function metadataForInsert(image: ArtworkImage): Promise<{ subtitle: string; credit: string }> {
    let subtitle = image.subtitle.trim();
    let credit = image.credit.trim();
    if (!subtitle) {
      subtitle = window.prompt('Image subtitle (optional):', '')?.trim() ?? '';
    }
    if (!credit) {
      credit = window.prompt('Image credit (optional):', '')?.trim() ?? '';
    }
    if (subtitle !== image.subtitle || credit !== image.credit) {
      await saveMetadata(image, subtitle, credit);
    }
    return { subtitle, credit };
  }

  async function dispatchInsert(image: ArtworkImage, hero: boolean, replaceHero: boolean) {
    const metadata = await metadataForInsert(image);
    window.dispatchEvent(new CustomEvent('stacked:open-editor'));
    await tick();
    window.dispatchEvent(new CustomEvent('stacked:insert-image', {
      detail: {
        src: relativeArtworkSrc(image.name),
        alt: imageAlt(image),
        subtitle: metadata.subtitle,
        credit: metadata.credit,
        hero,
        replaceHero,
      },
    }));
  }

  async function setHero(image: ArtworkImage) {
    await dispatchInsert(image, true, true);
  }

  async function insertInline(image: ArtworkImage) {
    const hero = inlineAsHero;
    await dispatchInsert(image, hero, false);
    inlineAsHero = false;
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex items-center justify-between gap-2 p-3 border-b border-dark-600">
    <div>
      <h3 class="text-xs font-semibold text-dark-300 uppercase tracking-wide">Hero Artwork</h3>
      <p class="text-xs text-dark-500">./_artwork</p>
    </div>
    <button
      onclick={() => loadArtwork(documentStore.filePath)}
      class="px-2 py-1 text-xs border border-dark-600 rounded hover:bg-dark-700 text-dark-300"
      disabled={loading}
    >
      Refresh
    </button>
  </div>
  <label class="flex items-center gap-2 px-3 py-2 border-b border-dark-700 text-xs text-dark-300">
    <input type="checkbox" bind:checked={inlineAsHero} class="accent-primary-500" />
    Mark inline insert as Hero
  </label>

  <div class="flex-1 overflow-y-auto p-3">
    {#if loading}
      <p class="text-sm text-dark-400">Loading artwork…</p>
    {:else if error}
      <p class="text-sm text-red-500">{error}</p>
    {:else if images.length === 0}
      <p class="text-sm text-dark-400">No images found in <code>./_artwork</code>.</p>
    {:else}
      <div class="grid grid-cols-2 gap-3">
        {#each images as image (image.path)}
          <div class="group overflow-hidden rounded-lg border border-dark-600 bg-dark-800">
            <img
              src={image.data_url}
              alt={image.name}
              class="aspect-video w-full object-cover bg-dark-700"
            />
            <span class="block truncate px-2 py-1.5 text-xs text-dark-300 group-hover:text-dark-100">
              {image.name}
            </span>
            {#if image.subtitle || image.credit}
              <div class="px-2 pb-1 text-[11px] text-dark-400">
                {#if image.subtitle}<div class="truncate">{image.subtitle}</div>{/if}
                {#if image.credit}<div class="truncate">Credit: {image.credit}</div>{/if}
              </div>
            {/if}
            <div class="grid grid-cols-2 gap-1 p-2">
              <button
                type="button"
                onclick={() => setHero(image)}
                class="rounded border border-amber-600/50 bg-amber-900/30 px-2 py-1 text-[11px] text-amber-300 hover:bg-amber-800/40"
                title={`Set ${image.name} as hero (replaces existing hero)`}
              >
                Set Hero
              </button>
              <button
                type="button"
                onclick={() => insertInline(image)}
                class="rounded border border-dark-500 bg-dark-700 px-2 py-1 text-[11px] text-dark-200 hover:bg-dark-600"
                title={`Insert ${image.name} at cursor`}
              >
                Inline
              </button>
            </div>
            <button
              type="button"
              onclick={() => editMetadata(image)}
              class="mx-2 mb-2 w-[calc(100%-1rem)] rounded border border-dark-600 px-2 py-1 text-[11px] text-dark-300 hover:bg-dark-700"
            >
              Edit subtitle/credit
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
