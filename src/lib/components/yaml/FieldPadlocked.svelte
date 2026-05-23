<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let { label, field }: { label: string; field: keyof ArticleFrontmatter } = $props();

  let value = $derived(documentStore.frontmatter?.[field] ?? '');
  let overrides = $derived(documentStore.frontmatter?.overrides ?? []);
  let isOverridden = $derived(overrides.includes(field as string));
  let isUnlocked = $state(false);

  function unlock() { isUnlocked = true; }

  function save(newValue: string) {
    documentStore.patchPadlockedField(field, newValue);
    isUnlocked = false;
  }

  function resetToAI() {
    documentStore.clearOverride(field);
    isUnlocked = false;
  }
</script>

<div class="flex flex-col gap-0.5">
  <div class="flex items-center gap-1">
    <label class="text-xs font-medium text-dark-300 uppercase tracking-wide">{label}</label>
    {#if isOverridden}
      <span class="text-xs text-amber-600 font-medium">overridden</span>
    {:else}
      <span class="text-xs text-primary-400">AI</span>
    {/if}
  </div>

  {#if isUnlocked}
    <div class="flex flex-col gap-1">
      <span class="text-xs text-amber-600">Overriding AI content</span>
      <textarea
        value={String(value)}
        rows={3}
        class="text-sm border border-amber-600 rounded px-2 py-1 resize-none"
        onblur={(e) => save((e.target as HTMLTextAreaElement).value)}
      ></textarea>
      <button onclick={resetToAI} class="text-xs text-dark-400 hover:text-dark-200 self-start">
        ↩ Reset to AI
      </button>
    </div>
  {:else}
    <div class="flex items-start gap-1">
      <p class="text-sm text-dark-300 flex-1 line-clamp-3">{value || '—'}</p>
      <button
        onclick={unlock}
        title="Unlock to edit (overrides AI)"
        class="text-dark-500 hover:text-dark-300 shrink-0 mt-0.5"
        aria-label="Unlock field"
      >🔒</button>
    </div>
  {/if}
</div>
