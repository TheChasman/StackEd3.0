<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let {
    label,
    field,
    type = 'text',
    options,
    rows = 3,
    readonly = false,
  }: {
    label: string;
    field: keyof ArticleFrontmatter;
    type?: 'text' | 'textarea' | 'select' | 'toggle' | 'datetime';
    options?: string[];
    rows?: number;
    readonly?: boolean;
  } = $props();

  let value = $derived(documentStore.frontmatter?.[field] ?? '');
  let inputId = $derived(`field-${String(field).toLowerCase().replaceAll('_', '-')}`);

  function update(newValue: unknown) {
    if (readonly) return;
    documentStore.patchField(field, newValue);
  }
</script>

<div class="flex flex-col gap-0.5">
  <label for={inputId} class="text-xs font-medium text-dark-300 uppercase tracking-wide">{label}</label>

  {#if type === 'toggle'}
    <button
      id={inputId}
      role="switch"
      aria-label={label}
      aria-checked={Boolean(value)}
      onclick={() => update(!value)}
      disabled={readonly}
      class="w-10 h-5 rounded-full relative transition-colors {value ? 'bg-primary-600' : 'bg-dark-600'} {readonly ? 'opacity-60 cursor-default' : ''}"
    >
      <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-dark-800 shadow transition-transform {value ? 'translate-x-5' : ''}"></span>
    </button>

  {:else if type === 'select'}
    <select
      id={inputId}
      value={String(value)}
      onchange={(e) => update((e.target as HTMLSelectElement).value)}
      disabled={readonly}
      class="text-sm border border-dark-600 rounded px-2 py-1 bg-dark-800 {readonly ? 'opacity-60 cursor-default' : ''}"
    >
      {#each options ?? [] as opt}
        <option value={opt}>{opt}</option>
      {/each}
    </select>

  {:else if type === 'textarea'}
    <textarea
      id={inputId}
      value={String(value)}
      oninput={(e) => update((e.target as HTMLTextAreaElement).value)}
      rows={rows}
      readonly={readonly}
      class="text-sm border border-dark-600 rounded px-2 py-1 resize-none {readonly ? 'opacity-60 cursor-default bg-dark-800' : ''}"
    ></textarea>

  {:else if type === 'datetime'}
    <input
      id={inputId}
      type="datetime-local"
      value={String(value)}
      oninput={(e) => update((e.target as HTMLInputElement).value)}
      readonly={readonly}
      class="text-sm border border-dark-600 rounded px-2 py-1 {readonly ? 'opacity-60 cursor-default bg-dark-800' : ''}"
    />

  {:else}
    <input
      id={inputId}
      type="text"
      value={String(value)}
      oninput={(e) => update((e.target as HTMLInputElement).value)}
      readonly={readonly}
      class="text-sm border border-dark-600 rounded px-2 py-1 {readonly ? 'opacity-60 cursor-default bg-dark-800' : ''}"
    />
  {/if}
</div>
