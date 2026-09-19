<script lang="ts">
  import { generateHTML } from '@tiptap/html';
  import { invoke } from '@tauri-apps/api/core';
  import { ArrowLeft, Copy } from 'lucide-svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import { readiness } from '$lib/utils/scaffold';
  import { isPostPayload, isNotePayload, type PostPayload } from '$lib/types/scaffold';
  import { publishToSubstack } from '$lib/services/substack/publisher';
  import { copyEditorHtmlForSubstack } from '$lib/services/substackClipboard';
  import {
    applySeoDraft,
    SEO_FIELD_PATHS,
    buildSeoPrompt,
    parseSeoDraftJson,
  } from '$lib/services/seo';
  import { getTagVocabulary, cachePublicationTags } from '$lib/services/tagVocabulary';
  import { pmDocToText } from '$lib/utils/pmText';
  import { substackExtensions } from '$lib/editor/schema';
  import {
    substackConnectionsStore,
    normaliseSubdomain,
  } from '$lib/stores/substackConnections.svelte';

  let scaffold = $derived(documentStore.scaffold);
  // The picker's value must match an option (which uses the normalised
  // subdomain). Resolve the document's raw publication to a known connection
  // case-insensitively WITHOUT rewriting the file — the doc only changes when
  // the user actively picks from the dropdown.
  let selectedSubdomain = $derived(
    scaffold?.remote.publication
      ? (substackConnectionsStore.findBySubdomain(scaffold.remote.publication)?.subdomain ?? '')
      : '',
  );

  // Legacy-file migration + deleted-connection recovery: if the active post
  // names a publication that isn't in the registry, silently (re)add it.
  $effect(() => {
    const pub = scaffold?.remote.publication;
    if (pub && !substackConnectionsStore.findBySubdomain(pub)) {
      void substackConnectionsStore.ensureConnectionForSubdomain(pub);
    }
  });

  let r = $derived(scaffold ? readiness(scaffold) : null);
  let slugLocked = $derived(scaffold ? scaffold.locked.includes(SEO_FIELD_PATHS.slug) : false);
  let errorMap = $derived(new Map(r?.blocking.map((b) => [b.split(' ')[0], b]) ?? []));
  let publishStatus = $state('');
  let publishing = $state(false);
  let seoLoading = $state(false);
  let seoError = $state('');
  let copyStatus = $state('');

  let actionLabel = $derived.by(() => {
    if (!scaffold) return 'Publish';
    if (isPostPayload(scaffold.payload)) {
      const p = scaffold.payload;
      if (p.trigger_at) return 'Schedule';
      if (p.send) return 'Publish now';
      return 'Create draft';
    }
    return 'Post note';
  });

  function patch<K extends keyof PostPayload>(field: K, value: PostPayload[K]) {
    documentStore.patchPayload(field, value);
  }

  async function generateSeo() {
    if (!scaffold || !isPostPayload(scaffold.payload)) return;
    const p = scaffold.payload;
    const anyFilled = Boolean(
      p.search_engine_title.trim() ||
      p.search_engine_description.trim() ||
      p.slug.trim() ||
      p.tags.length > 0,
    );
    if (
      anyFilled &&
      !window.confirm(
        'Regenerate all four SEO fields? Current values will be replaced (locked fields are kept).',
      )
    ) {
      return;
    }

    seoError = '';
    seoLoading = true;
    try {
      const vocabulary = await getTagVocabulary(
        documentStore.filePath,
        scaffold.remote.publication,
      );
      const prompt = buildSeoPrompt({
        scaffold,
        bodyText: pmDocToText(documentStore.body),
        filePath: documentStore.filePath,
        tagVocabulary: vocabulary,
      });
      // Key is resolved from SpockLock inside the Rust command; it never enters the WebView.
      const raw = await invoke<string>('generate_seo_text', { prompt });
      const draft = parseSeoDraftJson(raw);
      documentStore.replaceScaffold(applySeoDraft(scaffold, draft, vocabulary));
    } catch (e) {
      seoError =
        typeof e === 'string' ? e : e instanceof Error ? e.message : 'SEO generation failed.';
    } finally {
      seoLoading = false;
    }
  }

  function toggleSlugLock() {
    if (!scaffold) return;
    if (
      slugLocked &&
      !window.confirm(
        "Unlock the slug? Changing a published post's slug breaks every existing link to it.",
      )
    )
      return;
    documentStore.toggleLocked(SEO_FIELD_PATHS.slug);
  }

  async function handlePublish() {
    if (!scaffold) return;
    if (r && r.blocking.length > 0) {
      alert('Cannot publish: ' + r.blocking.join(', '));
      return;
    }

    const publication = scaffold.remote.publication.trim();
    if (!publication) {
      alert(
        'Enter your Substack publication subdomain first (e.g. "myblog" for myblog.substack.com).',
      );
      return;
    }

    const action =
      isPostPayload(scaffold.payload) && scaffold.payload.trigger_at
        ? 'schedule'
        : isPostPayload(scaffold.payload) && scaffold.payload.send
          ? 'publish and email subscribers'
          : 'create a draft';

    const seoReview = isPostPayload(scaffold.payload)
      ? `SEO title: ${scaffold.payload.search_engine_title}\n` +
        `URL slug: /p/${scaffold.payload.slug}\n` +
        `Tags: ${scaffold.payload.tags.join(', ') || '(none)'}\n\n`
      : '';

    if (
      !window.confirm(
        `Publish to Substack?\n\n` +
          `Publication: ${publication}.substack.com\n` +
          `Action: ${action}\n\n` +
          seoReview +
          `This will open a Substack login window if you haven't logged in yet. ` +
          `A draft will be created on Substack. ` +
          `If scheduling is set, it will be scheduled. ` +
          `If email send is enabled, it will be published immediately (irreversible).`,
      )
    )
      return;

    publishing = true;
    publishStatus = 'Opening Substack...';

    try {
      const { WebViewTransport } = await import('$lib/services/substack/webviewTransport');
      const transport = new WebViewTransport(publication);

      // Read local images as data URLs for upload
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
        // A live URL is now load-bearing — pin the slug so regen can't change it.
        if (result.published) {
          scaffold.remote.publishedAt = new Date().toISOString();
          if (!scaffold.locked.includes(SEO_FIELD_PATHS.slug)) {
            scaffold.locked = [...scaffold.locked, SEO_FIELD_PATHS.slug];
          }
        }
        documentStore.replaceScaffold(scaffold);
      }

      if (result.publicationTags.length > 0) {
        cachePublicationTags(publication, result.publicationTags);
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

      if (result.tagWarnings.length > 0) {
        publishStatus += `\nTag issues: ${result.tagWarnings.join('; ')}`;
      }
    } catch (e) {
      publishStatus = `Error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      publishing = false;
    }
  }

  async function copyForSubstack() {
    copyStatus = 'Copying…';
    try {
      const html = generateHTML(documentStore.body, substackExtensions as any);
      await copyEditorHtmlForSubstack(html, documentStore.filePath);
      copyStatus = 'Copied';
      window.setTimeout(() => (copyStatus = ''), 2000);
    } catch (e) {
      copyStatus = e instanceof Error ? e.message : 'Copy failed';
    }
  }
</script>

<div class="flex flex-col h-full min-h-0">
  <header class="flex items-center gap-3 px-5 py-3 border-b border-dark-700 bg-dark-800 shrink-0">
    <button
      onclick={() => viewStore.backToWrite()}
      class="flex items-center gap-1.5 text-sm text-dark-300 hover:text-dark-100"
      title="Back to writing"
    >
      <ArrowLeft class="h-4 w-4" />
      Write
    </button>
    <h1 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">Finish</h1>
    <span class="text-xs text-dark-500 truncate">{documentStore.title || 'Untitled'}</span>
  </header>

  <div class="flex-1 overflow-y-auto min-h-0">
    <div class="mx-auto w-full max-w-2xl px-6 py-6 flex flex-col gap-6 pb-16 text-sm">
      {#if !scaffold}
        <p class="text-sm text-dark-400">No file open.</p>
      {:else}
        {#snippet errorTip(field: string)}
          {#if errorMap.has(field)}
            <div
              class="absolute left-0 top-full mt-1 z-50 bg-dark-900 border border-red-500 text-red-300 text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg"
            >
              {errorMap.get(field)}
            </div>
          {/if}
        {/snippet}

        <!-- 1. Readiness -->
        <section class="flex flex-col gap-2">
          <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">Readiness</h3>
          {#if r}
            {#if r.blocking.length === 0 && r.advisory.length === 0}
              <p class="text-xs text-green-400">Ready to publish.</p>
            {:else}
              {#each r.blocking as check (check)}
                <p class="text-xs text-red-400">✕ {check}</p>
              {/each}
              {#each r.advisory as check (check)}
                <p class="text-xs text-amber-400">△ {check}</p>
              {/each}
            {/if}
          {/if}
        </section>

        {#if isPostPayload(scaffold.payload)}
          {@const p = scaffold.payload}
          <!-- 2. SEO -->
          <section class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">SEO</h3>
              <button
                onclick={generateSeo}
                disabled={seoLoading}
                class="text-xs px-2 py-1 border border-dark-600 rounded hover:bg-dark-700 disabled:opacity-50"
              >
                {seoLoading ? 'Generating…' : 'Generate'}
              </button>
            </div>
            {#if seoError}
              <p class="text-xs text-red-400">{seoError}</p>
            {/if}
            <label class="flex flex-col gap-1 relative group">
              <span class="text-dark-400 text-xs flex justify-between">
                <span>Search title</span>
                <span
                  class={p.search_engine_title.length >= 40 && p.search_engine_title.length <= 60
                    ? 'text-green-500'
                    : 'text-amber-500'}>{p.search_engine_title.length}/40–60</span
                >
              </span>
              <input
                type="text"
                value={p.search_engine_title}
                onchange={(e) => patch('search_engine_title', e.currentTarget.value)}
                class="bg-dark-800 border rounded p-2 text-dark-100 focus:border-primary-500 {errorMap.has(
                  'search_engine_title',
                )
                  ? 'border-red-500'
                  : 'border-dark-600'}"
              />
              {@render errorTip('search_engine_title')}
            </label>
            <label class="flex flex-col gap-1 relative group">
              <span class="text-dark-400 text-xs flex justify-between">
                <span>Search description</span>
                <span
                  class={p.search_engine_description.length >= 140 &&
                  p.search_engine_description.length <= 160
                    ? 'text-green-500'
                    : 'text-amber-500'}>{p.search_engine_description.length}/140–160</span
                >
              </span>
              <textarea
                rows={2}
                value={p.search_engine_description}
                onchange={(e) => patch('search_engine_description', e.currentTarget.value)}
                class="bg-dark-800 border rounded p-2 text-dark-100 resize-none focus:border-primary-500 {errorMap.has(
                  'search_engine_description',
                )
                  ? 'border-red-500'
                  : 'border-dark-600'}"></textarea>
              {@render errorTip('search_engine_description')}
            </label>
            <label class="flex flex-col gap-1 relative group">
              <span class="text-dark-400 text-xs flex justify-between">
                <span>Slug</span>
                <button
                  type="button"
                  onclick={toggleSlugLock}
                  class="text-dark-500 hover:text-dark-300"
                >
                  {slugLocked ? '🔒 locked — unlock' : 'lock'}
                </button>
              </span>
              <input
                type="text"
                value={p.slug}
                readonly={slugLocked}
                onchange={(e) => patch('slug', e.currentTarget.value)}
                class="bg-dark-800 border rounded p-2 text-dark-100 focus:border-primary-500 font-mono text-xs {slugLocked
                  ? 'opacity-60 cursor-not-allowed'
                  : ''} {errorMap.has('slug') ? 'border-red-500' : 'border-dark-600'}"
              />
              {#if slugLocked}
                <span class="text-dark-500 text-xs"
                  >This URL is live — changing it breaks existing links.</span
                >
              {/if}
              {@render errorTip('slug')}
            </label>
            <label class="flex flex-col gap-1 relative group">
              <span class="text-dark-400 text-xs">Tags (comma-separated)</span>
              <input
                type="text"
                value={p.tags.join(', ')}
                onchange={(e) =>
                  patch(
                    'tags',
                    e.currentTarget.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  )}
                class="bg-dark-800 border rounded p-2 text-dark-100 focus:border-primary-500 {errorMap.has(
                  'tags',
                )
                  ? 'border-red-500'
                  : 'border-dark-600'}"
              />
              {@render errorTip('tags')}
            </label>
          </section>

          <!-- 3. Destination -->
          <section class="flex flex-col gap-3">
            <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Destination
            </h3>
            <label class="flex flex-col gap-1">
              <span class="text-dark-400 text-xs">Publication</span>
              <select
                value={selectedSubdomain}
                onchange={(e) => {
                  scaffold!.remote.publication = normaliseSubdomain(e.currentTarget.value);
                  documentStore.replaceScaffold(scaffold!);
                }}
                class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500 text-sm"
              >
                <option value="">— Select a connection —</option>
                {#each substackConnectionsStore.connections as conn (conn.id)}
                  <option value={conn.subdomain}>
                    {conn.nickname}{conn.nickname !== conn.subdomain
                      ? ` (${conn.subdomain}.substack.com)`
                      : ''}
                  </option>
                {/each}
              </select>
              {#if substackConnectionsStore.connections.length === 0}
                <span class="text-dark-500 text-xs">Add a connection in Settings to publish.</span>
              {/if}
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-dark-400 text-xs">Audience</span>
              <select
                value={p.audience}
                onchange={(e) =>
                  patch('audience', e.currentTarget.value as PostPayload['audience'])}
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
                onchange={(e) =>
                  patch(
                    'write_comment_permissions',
                    e.currentTarget.value as PostPayload['write_comment_permissions'],
                  )}
                class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500"
              >
                <option value="everyone">Everyone</option>
                <option value="only_paid">Paid only</option>
                <option value="none">None</option>
              </select>
            </label>
          </section>

          <!-- 4. Delivery -->
          <section class="flex flex-col gap-2">
            <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">Delivery</h3>
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
          </section>

          <!-- 5. Timing -->
          <section class="flex flex-col gap-3">
            <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">Timing</h3>
            {#if scaffold.workshop.targetDate}
              <p class="text-xs text-dark-400">
                Target date (from Plan): <span class="text-dark-200"
                  >{scaffold.workshop.targetDate}</span
                >
              </p>
            {/if}
            <label class="flex flex-col gap-1">
              <span class="text-dark-400 text-xs">Substack schedule</span>
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
          </section>
        {:else if isNotePayload(scaffold.payload)}
          <!-- Notes: reply audience is the only destination choice -->
          <section class="flex flex-col gap-3">
            <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">
              Destination
            </h3>
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
            <label class="flex flex-col gap-1">
              <span class="text-dark-400 text-xs">Publication</span>
              <select
                value={selectedSubdomain}
                onchange={(e) => {
                  scaffold!.remote.publication = normaliseSubdomain(e.currentTarget.value);
                  documentStore.replaceScaffold(scaffold!);
                }}
                class="bg-dark-800 border border-dark-600 rounded p-2 text-dark-100 focus:border-primary-500 text-sm"
              >
                <option value="">— Select a connection —</option>
                {#each substackConnectionsStore.connections as conn (conn.id)}
                  <option value={conn.subdomain}>
                    {conn.nickname}{conn.nickname !== conn.subdomain
                      ? ` (${conn.subdomain}.substack.com)`
                      : ''}
                  </option>
                {/each}
              </select>
              {#if substackConnectionsStore.connections.length === 0}
                <span class="text-dark-500 text-xs">Add a connection in Settings to publish.</span>
              {/if}
            </label>
            <p class="text-xs text-dark-500">Note body is edited in Write.</p>
          </section>
        {/if}

        <!-- 6. Action -->
        <section class="flex flex-col gap-3 border-t border-dark-700 pt-5">
          <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">Action</h3>
          {#if r && r.blocking.length > 0}
            <p class="text-xs text-amber-400">
              Fix blocking issues before publishing: {r.blocking.join(', ')}
            </p>
            {#if r.blocking.some((b) => b.startsWith('search_engine') || b === 'slug is empty' || b === 'tags is empty')}
              <button
                onclick={generateSeo}
                disabled={seoLoading}
                class="self-start text-xs px-2 py-1 border border-dark-600 rounded hover:bg-dark-700 disabled:opacity-50"
              >
                {seoLoading ? 'Generating…' : 'Generate SEO'}
              </button>
            {/if}
          {/if}
          <div class="flex items-center gap-3">
            <button
              onclick={handlePublish}
              disabled={publishing || (r !== null && r.blocking.length > 0)}
              class="px-4 py-2 bg-primary-600 text-dark-900 rounded text-sm font-medium hover:bg-primary-700
                disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {publishing ? 'Working...' : actionLabel}
            </button>
            <button
              onclick={copyForSubstack}
              class="flex items-center gap-1.5 px-3 py-2 border border-dark-600 rounded text-sm text-dark-200 hover:bg-dark-700"
              title="Copy article for Substack paste"
            >
              <Copy class="h-4 w-4" />
              {copyStatus || 'Copy for Substack'}
            </button>
          </div>
          {#if publishStatus}
            <p
              class="text-xs whitespace-pre-line {publishStatus.startsWith('Error')
                ? 'text-red-400'
                : 'text-green-400'}"
            >
              {publishStatus}
            </p>
          {/if}
          <div class="grid grid-cols-2 gap-2 text-xs text-dark-400">
            <span>Created: {scaffold.created.slice(0, 10)}</span>
            <span>Updated: {scaffold.updated.slice(0, 10)}</span>
            {#if scaffold.remote.draftId !== null}
              <span class="text-green-400">Draft ID: {scaffold.remote.draftId}</span>
            {/if}
            {#if scaffold.remote.scheduled}
              <span class="text-amber-400">Scheduled</span>
            {/if}
            {#if scaffold.remote.publishedAt !== null}
              <span class="text-green-400"
                >Published: {scaffold.remote.publishedAt.slice(0, 10)}</span
              >
            {/if}
          </div>
        </section>
      {/if}
    </div>
  </div>
</div>
