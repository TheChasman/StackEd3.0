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

  let inputId = $derived(`field-tags-${field.toLowerCase().replaceAll('_', '-')}`);
  let rawValue = $state('');
  let isEditing = $state(false);

  function valueFromStore() {
    const value = documentStore.frontmatter?.[field];
    return Array.isArray(value) ? value.join(', ') : String(value ?? '');
  }

  $effect(() => {
    const nextValue = valueFromStore();
    if (!isEditing && rawValue !== nextValue) {
      rawValue = nextValue;
    }
  });

  function update(value: string) {
    isEditing = true;
    rawValue = value;
    documentStore.patchField(
      field,
      value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    );
  }

  function finishEditing() {
    isEditing = false;
    rawValue = valueFromStore();
  }
</script>

<div class="flex flex-col gap-0.5">
  <label for={inputId} class="text-xs font-medium text-dark-300 uppercase tracking-wide">{label}</label>
  <input
    id={inputId}
    type="text"
    value={rawValue}
    placeholder="tag one, tag two, tag three"
    onfocus={() => (isEditing = true)}
    oninput={(e) => update((e.target as HTMLInputElement).value)}
    onblur={finishEditing}
    class="text-sm border border-dark-600 rounded px-2 py-1"
  />
</div>
