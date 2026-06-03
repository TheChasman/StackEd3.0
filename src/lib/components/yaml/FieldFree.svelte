<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let {
    label,
    field,
    type = 'text',
    options,
    rows = 3,
  }: {
    label: string;
    field: keyof ArticleFrontmatter;
    type?: 'text' | 'textarea' | 'select' | 'toggle' | 'datetime';
    options?: string[];
    rows?: number;
  } = $props();

  let value = $derived(documentStore.frontmatter?.[field] ?? '');

  function update(newValue: unknown) {
    documentStore.patchField(field, newValue);
  }
</script>

<div class="flex flex-col gap-0.5">
  <label class="text-xs font-medium text-dark-300 uppercase tracking-wide">{label}</label>

  {#if type === 'toggle'}
    <button
      role="switch"
      aria-checked={Boolean(value)}
      onclick={() => update(!value)}
      class="w-10 h-5 rounded-full relative transition-colors {value ? 'bg-primary-600' : 'bg-dark-600'}"
    >
      <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-dark-800 shadow transition-transform {value ? 'translate-x-5' : ''}"></span>
    </button>

  {:else if type === 'select'}
    <select
      value={String(value)}
      onchange={(e) => update((e.target as HTMLSelectElement).value)}
      class="text-sm border border-dark-600 rounded px-2 py-1 bg-dark-800"
    >
      {#each options ?? [] as opt}
        <option value={opt}>{opt}</option>
      {/each}
    </select>

  {:else if type === 'textarea'}
    <textarea
      value={String(value)}
      oninput={(e) => update((e.target as HTMLTextAreaElement).value)}
      rows={rows}
      class="text-sm border border-dark-600 rounded px-2 py-1 resize-none"
    ></textarea>

  {:else if type === 'datetime'}
    <input
      type="datetime-local"
      value={String(value)}
      oninput={(e) => update((e.target as HTMLInputElement).value)}
      class="text-sm border border-dark-600 rounded px-2 py-1"
    />

  {:else}
    <input
      type="text"
      value={String(value)}
      oninput={(e) => update((e.target as HTMLInputElement).value)}
      class="text-sm border border-dark-600 rounded px-2 py-1"
    />
  {/if}
</div>
