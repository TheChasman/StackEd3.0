<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import { runBodyParserUpsertOnly } from '$lib/utils/frontmatter';
  import { RefreshCw } from 'lucide-svelte';
  import FieldFree from './FieldFree.svelte';
  import FieldTags from './FieldTags.svelte';

  let fm = $derived(documentStore.frontmatter);
  let hookWarning = $derived(documentStore.hookWarning);

  function refreshYamlFromEditor() {
    if (!fm) return;
    documentStore.replaceFrontmatter(runBodyParserUpsertOnly(fm, documentStore.body));
  }
</script>

{#if !fm}
  <div class="p-4 text-sm text-dark-400">No file open.</div>
{:else}
  <div class="flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm">
    <button
      type="button"
      onclick={refreshYamlFromEditor}
      class="inline-flex items-center justify-center gap-2 rounded border border-dark-600 px-3 py-2 text-xs font-medium text-dark-300 hover:bg-dark-700 hover:text-dark-100"
      title="Harvest tagged Live Editor changes into YAML without deleting existing fields"
    >
      <RefreshCw size={14} aria-hidden="true" />
      YAML Refresh
    </button>

    <!-- Article Structure group -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Article Structure</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="Hero Image" field="IMAGE" type="text" readonly={true} />
        <FieldFree label="Spark" field="SPARK" type="textarea" rows={3} readonly={true} />
        <FieldFree label="Title" field="TITLE" type="textarea" rows={2} readonly={true} />
        {#if fm.TITLE_SELECTED}
          <FieldFree label="Title (Selected)" field="TITLE_SELECTED" type="textarea" rows={2} readonly={true} />
        {/if}
        <FieldFree label="Subtitle" field="SUBTITLE" type="textarea" rows={2} readonly={true} />
        {#if fm.SUBTITLE_SELECTED}
          <FieldFree label="Subtitle (Selected)" field="SUBTITLE_SELECTED" type="textarea" rows={2} readonly={true} />
        {/if}
        <FieldFree label="Hook" field="HOOK" type="textarea" rows={3} readonly={true} />
        {#if hookWarning}
          <p class="text-xs text-amber-400">⚠ Hook exceeds 150 words — keep it short and sharp.</p>
        {/if}
        {#if fm.HOOK_SELECTED}
          <FieldFree label="Hook (Selected)" field="HOOK_SELECTED" type="textarea" rows={3} readonly={true} />
        {/if}
        <FieldFree label="Landing" field="LANDING" type="textarea" rows={3} readonly={true} />
        {#if fm.LANDING_SELECTED}
          <FieldFree label="Landing (Selected)" field="LANDING_SELECTED" type="textarea" rows={3} readonly={true} />
        {/if}
      </div>
    </section>

    <!-- SEO group -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">SEO</h3>
      {#if fm.SEO_TITLE || fm.SEO_DESCRIPTION || fm.SEO_SLUG || fm.SEO_TAGS?.length}
        <div class="flex flex-col gap-3">
          <FieldFree label="SEO Title" field="SEO_TITLE" type="textarea" rows={2} readonly={true} />
          <FieldFree label="SEO Description" field="SEO_DESCRIPTION" type="textarea" rows={3} readonly={true} />
          <FieldFree label="SEO Slug" field="SEO_SLUG" type="text" readonly={true} />
          <FieldTags label="SEO Tags" field="SEO_TAGS" />
        </div>
      {:else}
        <p class="text-sm italic text-dark-400">SEO fields are generated automatically at Publish.</p>
      {/if}
    </section>

    <!-- AI-GEN toggle -->
    <section>
      <button
        role="checkbox"
        aria-checked={fm.AI_GEN}
        onclick={() => documentStore.patchField('AI_GEN', !fm.AI_GEN)}
        class="flex items-center gap-2 text-xs text-dark-300 hover:text-dark-100"
      >
        <span class="w-4 h-4 border border-dark-500 rounded-sm flex items-center justify-center">
          {#if fm.AI_GEN}✓{/if}
        </span>
        AI-GEN ({fm.AI_GEN ? 'generative' : 'rescan'})
      </button>
    </section>

    <!-- Metadata group -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Metadata</h3>
      <div class="grid grid-cols-2 gap-2">
        <FieldFree label="Created" field="created" type="text" readonly={true} />
        <FieldFree label="Updated" field="updated" type="text" readonly={true} />
      </div>
    </section>

  </div>
{/if}
