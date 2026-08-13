<script lang="ts">
  import { tick } from 'svelte';
  import { listen } from '@tauri-apps/api/event';
  import {
    generateImage,
    IMAGE_GENERATION_MODELS,
    type GeneratedImage,
    type ImageGenerationModel,
    saveGeneratedImageToArtwork,
  } from '$lib/services/imageGeneration';
  import { documentStore } from '$lib/stores/document.svelte';
  import { relativeArtworkSrc } from '$lib/utils/artworkReferences';

  let prompt = $state('');
  let model = $state<ImageGenerationModel>('openai/gpt-5.4-image-2');
  let image = $state<GeneratedImage | null>(null);
  let loading = $state(false);
  let status = $state('');
  let error = $state('');
  let altText = $state('');
  let savedPath = $state('');
  let savedSrc = $state('');
  let subtitleText = $state('');
  let creditText = $state('');

  function defaultAltText(text: string): string {
    return text.trim().replace(/\s+/g, ' ').slice(0, 80) || 'Generated image';
  }

  async function ensureArticlePath(): Promise<string | null> {
    if (documentStore.filePath) return documentStore.filePath;
    return new Promise((resolve) => {
      window.dispatchEvent(
        new CustomEvent('stacked:ensure-article-path', {
          detail: { resolve },
        }),
      );
    });
  }

  async function generate() {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;
    const articlePath = await ensureArticlePath();
    if (!articlePath) return;

    loading = true;
    status = '';
    error = '';
    image = null;
    savedPath = '';
    savedSrc = '';
    subtitleText = '';
    creditText = '';
    const unlisten = await listen<string>('image-gen:status', (e) => {
      status = e.payload;
    });
    try {
      const generated = await generateImage({ prompt: trimmed, model });
      const saved = await saveGeneratedImageToArtwork({
        articlePath,
        prompt: trimmed,
        dataUrl: generated.data_url,
      });
      image = { ...generated, data_url: saved.data_url };
      savedPath = saved.path;
      savedSrc = relativeArtworkSrc(saved.name);
      altText = defaultAltText(trimmed);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      unlisten();
      loading = false;
      status = '';
    }
  }

  async function insertImage() {
    if (!image || !savedSrc) return;
    if (!subtitleText) {
      subtitleText = window.prompt('Image subtitle (optional):', '')?.trim() ?? '';
    }
    if (!creditText) {
      creditText = window.prompt('Image credit (optional):', '')?.trim() ?? '';
    }
    window.dispatchEvent(new CustomEvent('stacked:open-editor'));
    await tick();
    window.dispatchEvent(
      new CustomEvent('stacked:insert-image', {
        detail: {
          src: savedSrc,
          alt: altText.trim() || defaultAltText(prompt),
          subtitle: subtitleText,
          credit: creditText,
          hero: false,
        },
      }),
    );
  }
</script>

<div class="flex flex-col h-full">
  <div class="flex flex-col gap-3 p-3 border-b border-dark-600">
    <div>
      <h3 class="text-xs font-semibold text-dark-300 uppercase tracking-wide">Generate Image</h3>
      <p class="text-xs text-dark-500">OpenRouter via SpockLock</p>
    </div>

    <label class="flex flex-col gap-1 text-xs text-dark-300">
      Model
      <select
        bind:value={model}
        class="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-dark-100"
      >
        {#each IMAGE_GENERATION_MODELS as option (option.id)}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </label>

    <label class="flex flex-col gap-1 text-xs text-dark-300">
      Prompt
      <textarea
        bind:value={prompt}
        rows="6"
        placeholder="Describe the image you want…"
        class="resize-y rounded border border-dark-600 bg-dark-900 px-2 py-2 text-sm text-dark-100 placeholder-dark-500"
      ></textarea>
    </label>

    <button
      onclick={generate}
      disabled={loading || !prompt.trim()}
      class="rounded bg-primary-600 px-3 py-2 text-sm font-medium text-dark-900 hover:bg-primary-700 disabled:opacity-50"
    >
      {loading ? 'Generating…' : 'Generate'}
    </button>

    {#if error}
      <p class="text-xs text-red-500">{error}</p>
    {/if}
    {#if savedPath}
      <p class="text-xs text-emerald-500">Saved to {savedPath}</p>
    {/if}
  </div>

  <div class="flex-1 overflow-y-auto p-3">
    {#if loading}
      <div class="rounded-lg border border-dark-600 bg-dark-800 p-4 text-sm text-dark-400">
        {status || 'Starting…'}
      </div>
    {:else if image}
      <div class="flex flex-col gap-3">
        <img
          src={image.data_url}
          alt={altText || defaultAltText(prompt)}
          class="w-full rounded-lg border border-dark-600 bg-dark-800 object-contain"
        />
        <label class="flex flex-col gap-1 text-xs text-dark-300">
          Alt text
          <input
            bind:value={altText}
            class="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-dark-100"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-dark-300">
          Subtitle
          <input
            bind:value={subtitleText}
            class="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-dark-100"
          />
        </label>
        <label class="flex flex-col gap-1 text-xs text-dark-300">
          Credit
          <input
            bind:value={creditText}
            class="rounded border border-dark-600 bg-dark-900 px-2 py-1.5 text-sm text-dark-100"
          />
        </label>
        <button
          onclick={insertImage}
          class="self-start rounded border border-dark-600 px-3 py-1.5 text-xs text-dark-200 hover:bg-dark-700"
        >
          Insert image
        </button>
      </div>
    {:else}
      <p class="text-sm text-dark-400">Generate a custom image, then insert it into the editor.</p>
    {/if}
  </div>
</div>
