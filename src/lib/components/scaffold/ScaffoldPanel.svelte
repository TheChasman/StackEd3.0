<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import { readiness } from '$lib/utils/scaffold';
  import { isPostPayload, isNotePayload, type PostPayload } from '$lib/types/scaffold';
  import { publishToSubstack } from '$lib/services/substack/publisher';

  let scaffold = $derived(documentStore.scaffold);
  let r = $derived(scaffold ? readiness(scaffold) : null);
  let publishStatus = $state('');
  let publishing = $state(false);

  function patch<K extends keyof PostPayload>(field: K, value: PostPayload[K]) {
    documentStore.patchPayload(field, value);
  }

  async function handlePublish() {
    if (!scaffold) return;
    if (r && r.blocking.length > 0) {
      alert('Cannot publish: ' + r.blocking.join(', '));
      return;
    }

    const publication = scaffold.remote.publication.trim();
    if (!publication) {
      alert('Enter your Substack publication subdomain first (e.g. "myblog" for myblog.substack.com).');
      return;
    }

    const action = scaffold.payload && 'trigger_at' in scaffold.payload && scaffold.payload.trigger_at
      ? 'schedule'
      : scaffold.payload && 'send' in scaffold.payload && scaffold.payload.send
        ? 'publish and email subscribers'
        : 'create a draft';

    if (!window.confirm(
      `Publish to Substack?\n\n` +
      `Publication: ${publication}.substack.com\n` +
      `Action: ${action}\n\n` +
      `This will open a Substack login window if you haven't logged in yet. ` +
      `A draft will be created on Substack. ` +
      `If scheduling is set, it will be scheduled. ` +
      `If email send is enabled, it will be published immediately (irreversible).`
    )) return;

    publishing = true;
    publishStatus = 'Opening Substack...';

    try {
      const { WebViewTransport } = await import('$lib/services/substack/webviewTransport');
      const transport = new WebViewTransport(publication);

      // Read local images as data URLs for upload
      const { invoke } = await import('@tauri-apps/api/core');
      const readImageAsDataUrl = async (src: string): Promise<string> => {
        if (src.startsWith('data:')) return src;
        // Resolve artwork-relative paths
        const { resolveArtworkImagePath } = await import('$lib/utils/artworkReferences');
        const path = resolveArtworkImagePath(documentStore.filePath, src);
        if (!path) throw new Error(`Cannot resolve image: ${src}`);
        return invoke<string>('read_image_data_url', { path });
      };

      publishStatus = 'Uploading images and creating draft...';
      const result = await publishToSubstack(scaffold, transport, readImageAsDataUrl);

      if (result.draftId) {
        scaffold.remote.draftId = result.draftId;
        scaffold.remote.scheduled = result.scheduled;
        documentStore.replaceScaffold(scaffold);
      }

      if (result.published) {
        publishStatus = `Published! Draft ID: ${result.draftId}`;
      } else if (result.scheduled) {
        publishStatus = `Scheduled! Draft ID: ${result.draftId}`;
      } else if (result.noteId) {
        publishStatus = `Note posted! ID: ${result.noteId}`;
      } else {
        publishStatus = `Draft created. ID: ${result.draftId}`;
      }
    } catch (e) {
      publishStatus = `Error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      publishing = false;
    }
  }
</script>

{#if !scaffold}
  <div class="p-4 text-sm text-dark-400">No file open.</div>
{:else}
  <div class="flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm">

    <!-- Readiness indicator -->
    {#if r}
      <div class="rounded border p-2 text-xs {r.blocking.length === 0 ? 'border-green-700 bg-green-900/20' : 'border-amber-700 bg-amber-900/20'}">
        {#if r.blocking.length === 0}
          <span class="text-green-400">Ready to publish</span>
          {#if r.advisory.length > 0}
            <span class="text-dark-400"> ({r.advisory.length} advisory)</span>
          {/if}
        {:else}
          <span class="text-amber-400">Blocking: {r.blocking.join(', ')}</span>
        {/if}
      </div>
    {/if}

    {#if isPostPayload(scaffold.payload)}
      {@const p = scaffold.payload}
      <!-- Payload: Core fields -->
      <section>
        <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Post</h3>
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Title</span>
            <textarea
              rows={2}
              value={p.draft_title}
              onchange={(e) => patch('draft_title', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
            ></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Subtitle</span>
            <textarea
              rows={2}
              value={p.draft_subtitle}
              onchange={(e) => patch('draft_subtitle', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
            ></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Type</span>
            <select
              value={p.type}
              onchange={(e) => patch('type', e.currentTarget.value as PostPayload['type'])}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500"
            >
              <option value="newsletter">Newsletter</option>
              <option value="podcast">Podcast</option>
              <option value="thread">Thread</option>
              <option value="video">Video</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Audience</span>
            <select
              value={p.audience}
              onchange={(e) => patch('audience', e.currentTarget.value as PostPayload['audience'])}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500"
            >
              <option value="everyone">Everyone</option>
              <option value="only_free">Free subscribers</option>
              <option value="only_paid">Paid subscribers</option>
              <option value="founding">Founding members</option>
            </select>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Comments</span>
            <select
              value={p.write_comment_permissions}
              onchange={(e) => patch('write_comment_permissions', e.currentTarget.value as PostPayload['write_comment_permissions'])}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500"
            >
              <option value="everyone">Everyone</option>
              <option value="only_paid">Paid only</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
      </section>

      <!-- Payload: SEO -->
      <section>
        <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">SEO</h3>
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">SEO Title</span>
            <input
              type="text"
              value={p.search_engine_title}
              onchange={(e) => patch('search_engine_title', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">SEO Description</span>
            <textarea
              rows={2}
              value={p.search_engine_description}
              onchange={(e) => patch('search_engine_description', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
            ></textarea>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Slug</span>
            <input
              type="text"
              value={p.slug}
              onchange={(e) => patch('slug', e.currentTarget.value)}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500 font-mono text-xs"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Tags (comma-separated)</span>
            <input
              type="text"
              value={p.tags.join(', ')}
              onchange={(e) => patch('tags', e.currentTarget.value.split(',').map(t => t.trim()).filter(Boolean))}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500"
            />
          </label>
        </div>
      </section>

      <!-- Payload: Publishing -->
      <section>
        <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Publishing</h3>
        <div class="flex flex-col gap-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={p.send}
              onchange={(e) => patch('send', e.currentTarget.checked)}
            />
            <span class="text-dark-300">Send via email</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={p.share_automatically}
              onchange={(e) => patch('share_automatically', e.currentTarget.checked)}
            />
            <span class="text-dark-300">Auto-share to Notes</span>
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-dark-400 text-xs">Schedule (ISO 8601)</span>
            <input
              type="datetime-local"
              value={p.trigger_at?.slice(0, 16) ?? ''}
              onchange={(e) => {
                const v = e.currentTarget.value;
                patch('trigger_at', v ? new Date(v).toISOString() : null);
              }}
              class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500"
            />
          </label>
        </div>
      </section>
    {:else if isNotePayload(scaffold.payload)}
      <section>
        <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Note</h3>
        <label class="flex flex-col gap-1">
          <span class="text-dark-400 text-xs">Reply audience</span>
          <select
            value={scaffold.payload.replyMinimumRole}
            onchange={(e) => documentStore.patchWorkshop('research', e.currentTarget.value)}
            class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500"
          >
            <option value="everyone">Everyone</option>
            <option value="free_subscriber">Free subscribers</option>
            <option value="paid_subscriber">Paid subscribers</option>
            <option value="founding_member">Founding members</option>
          </select>
        </label>
        <p class="text-xs text-dark-500 mt-2">Note body is edited in the main editor.</p>
      </section>
    {/if}

    <!-- Workshop zone (never ships) -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Workshop <span class="text-dark-600 normal-case">(not published)</span></h3>
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-dark-400 text-xs">Spark</span>
          <textarea
            rows={3}
            value={scaffold.workshop.spark}
            onchange={(e) => documentStore.patchWorkshop('spark', e.currentTarget.value)}
            class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-dark-400 text-xs">Hook</span>
          <textarea
            rows={3}
            value={scaffold.workshop.hook}
            onchange={(e) => documentStore.patchWorkshop('hook', e.currentTarget.value)}
            class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-dark-400 text-xs">Landing</span>
          <textarea
            rows={3}
            value={scaffold.workshop.landing}
            onchange={(e) => documentStore.patchWorkshop('landing', e.currentTarget.value)}
            class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
          ></textarea>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-dark-400 text-xs">Research</span>
          <textarea
            rows={4}
            value={scaffold.workshop.research}
            onchange={(e) => documentStore.patchWorkshop('research', e.currentTarget.value)}
            class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 resize-none focus:border-primary-500"
          ></textarea>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={scaffold.workshop.aiGen}
            onchange={(e) => documentStore.patchWorkshop('aiGen', e.currentTarget.checked)}
          />
          <span class="text-dark-300">AI-GEN mode</span>
        </label>
      </div>
    </section>

    <!-- Substack publishing -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Substack</h3>
      <div class="flex flex-col gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-dark-400 text-xs">Publication subdomain</span>
          <div class="flex items-center gap-1">
            <input
              type="text"
              value={scaffold.remote.publication}
              onchange={(e) => {
                scaffold!.remote.publication = e.currentTarget.value.trim();
                documentStore.replaceScaffold(scaffold!);
              }}
              placeholder="myblog"
              class="flex-1 bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500 text-sm"
            />
            <span class="text-dark-500 text-xs whitespace-nowrap">.substack.com</span>
          </div>
        </label>
        <button
          onclick={handlePublish}
          disabled={publishing || (r !== null && r.blocking.length > 0)}
          class="px-4 py-2 bg-primary-600 text-dark-900 rounded text-sm font-medium hover:bg-primary-700
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {publishing ? 'Working...' : 'Publish to Substack'}
        </button>
        {#if publishStatus}
          <p class="text-xs {publishStatus.startsWith('Error') ? 'text-red-400' : 'text-green-400'}">{publishStatus}</p>
        {/if}
        {#if r && r.blocking.length > 0}
          <p class="text-xs text-amber-400">Fix blocking issues before publishing: {r.blocking.join(', ')}</p>
        {/if}
      </div>
    </section>

    <!-- Metadata -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Metadata</h3>
      <div class="grid grid-cols-2 gap-2 text-xs text-dark-400">
        <span>Created: {scaffold.created.slice(0, 10)}</span>
        <span>Updated: {scaffold.updated.slice(0, 10)}</span>
        {#if scaffold.remote.draftId !== null}
          <span class="text-green-400">Draft ID: {scaffold.remote.draftId}</span>
        {/if}
        {#if scaffold.remote.scheduled}
          <span class="text-amber-400">Scheduled</span>
        {/if}
      </div>
    </section>

  </div>
{/if}
