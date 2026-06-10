<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import FieldFree from './FieldFree.svelte';
  import FieldReadonly from './FieldReadonly.svelte';
  import FieldTags from './FieldTags.svelte';

  let fm = $derived(documentStore.frontmatter);
</script>

{#if !fm}
  <div class="p-4 text-sm text-dark-400">No file open.</div>
{:else}
  <div class="flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm">

    <!-- Metadata group -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Metadata</h3>
      <div class="grid grid-cols-2 gap-2">
        <FieldReadonly label="Created" value={fm.created} />
        <FieldReadonly label="Updated" value={fm.updated} />
      </div>
    </section>

    <!-- Article Structure group -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Article Structure</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="Hero Image" field="IMAGE" type="text" />
        <FieldFree label="Spark" field="SPARK" type="textarea" rows={3} />
        <FieldFree label="Title" field="TITLE" type="textarea" rows={2} />
        <FieldFree label="Subtitle" field="SUBTITLE" type="textarea" rows={2} />
        <FieldFree label="Hook" field="HOOK" type="textarea" rows={3} />
        <FieldFree label="Landing" field="LANDING" type="textarea" rows={3} />
      </div>
    </section>

    <!-- SEO group -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">SEO</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="SEO Title" field="SEO_TITLE" type="textarea" rows={2} />
        <FieldFree label="SEO Description" field="SEO_DESCRIPTION" type="textarea" rows={3} />
        <FieldFree label="SEO Slug" field="SEO_SLUG" type="text" />
        <FieldTags label="SEO Tags" field="SEO_TAGS" />
      </div>
    </section>

  </div>
{/if}
