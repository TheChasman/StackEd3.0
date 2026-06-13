<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let {
    label,
    field,
  }: {
    label: string;
    field: keyof ArticleFrontmatter;
  } = $props();

  let rawValue = $derived(documentStore.frontmatter?.[field]);
  let tags = $derived(Array.isArray(rawValue) ? (rawValue as string[]) : []);
</script>

<div class="flex flex-col gap-0.5">
  <span class="text-xs font-medium text-dark-300 uppercase tracking-wide">{label}</span>
  {#if tags.length}
    <div class="flex flex-wrap gap-1">
      {#each tags as tag}
        <span class="text-xs bg-dark-700 rounded px-1.5 py-0.5 text-dark-200">{tag}</span>
      {/each}
    </div>
  {:else}
    <p class="text-sm italic text-dark-400">None yet</p>
  {/if}
</div>
