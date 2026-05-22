<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import FieldFree from './FieldFree.svelte';
  import FieldPadlocked from './FieldPadlocked.svelte';
  import FieldReadonly from './FieldReadonly.svelte';

  let fm = $derived(documentStore.frontmatter);
  let isLocked = $derived(documentStore.isLocked);
  let canUnlock = $derived(documentStore.canUnlock);

  const PIPELINE_COLOURS: Record<string, string> = {
    spark: 'bg-yellow-100 text-yellow-700',
    hook: 'bg-orange-100 text-orange-700',
    opening: 'bg-amber-100 text-amber-700',
    research: 'bg-blue-100 text-blue-700',
    writing: 'bg-indigo-100 text-indigo-700',
    final_draft: 'bg-purple-100 text-purple-700',
    seo: 'bg-pink-100 text-pink-700',
    fact_check: 'bg-red-100 text-red-700',
    staged: 'bg-green-100 text-green-700',
    posted: 'bg-gray-100 text-gray-700',
  };
</script>

{#if !fm}
  <div class="p-4 text-sm text-gray-400">No file open.</div>
{:else}
  <div class="flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm">

    <!-- Status group -->
    <section>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</h3>
      <div class="flex items-center gap-2 mb-2">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium {PIPELINE_COLOURS[fm.pipeline_stage] ?? 'bg-gray-100 text-gray-600'}">
          {fm.pipeline_stage.replace('_', ' ')}
        </span>
        {#if isLocked}
          <span class="text-xs text-red-600 font-medium">🔒 Content locked</span>
        {/if}
      </div>
      {#if fm.substack_url}
        <a href={fm.substack_url} target="_blank" rel="noopener" class="text-xs text-indigo-600 underline truncate block">
          {fm.substack_url}
        </a>
      {/if}
      <div class="grid grid-cols-2 gap-2 mt-2">
        <FieldReadonly label="Created" value={fm.created} />
        <FieldReadonly label="Updated" value={fm.updated} />
      </div>
      {#if canUnlock}
        <button
          onclick={() => {
            if (confirm('Unlock content? This resets the article to fact_check stage for re-review.')) {
              documentStore.unlock();
            }
          }}
          class="mt-2 text-xs text-red-600 hover:text-red-800 underline"
        >
          Unlock Content
        </button>
      {/if}
    </section>

    <!-- Content group (author-free fields) -->
    <section>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Content</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="Title" field="title" />
        <FieldFree label="Subtitle" field="subtitle" />
        <FieldFree label="Spark Notes" field="spark_notes" type="textarea" />
        <FieldFree label="Hook" field="hook" type="textarea" />
        <FieldFree label="Opening" field="opening" type="textarea" />
        <FieldFree label="Research Notes" field="research_notes" type="textarea" />
        <FieldFree label="Legal Notes" field="legal_notes" type="textarea" />
      </div>
    </section>

    <!-- AI-generated group (padlocked) -->
    <section>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">AI Generated</h3>
      <div class="flex flex-col gap-3">
        <FieldPadlocked label="AI Draft" field="ai_draft" />
        <FieldPadlocked label="Fact Check Notes" field="fact_check_notes" />
        <FieldPadlocked label="SEO Title" field="seo_title" />
        <FieldPadlocked label="SEO Description" field="seo_description" />
        <FieldPadlocked label="SEO Slug" field="seo_slug" />
        <FieldPadlocked label="Tags" field="substack_tags" />
      </div>
    </section>

    <!-- Publishing group (author-free fields) -->
    <section>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Publishing</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="Publication" field="publication" />
        <FieldFree label="Section" field="section" />
        <FieldFree label="Publish At" field="publish_at" type="datetime" />
        <FieldFree label="Audience" field="audience" type="select" options={['everyone', 'paid', 'none']} />
        <FieldFree label="Allow Comments" field="allow_comments" type="select" options={['everyone', 'paid', 'none']} />
        <FieldFree label="Send Email" field="send_email" type="toggle" />
      </div>
    </section>

  </div>
{/if}
