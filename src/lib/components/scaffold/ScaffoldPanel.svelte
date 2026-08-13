<script lang="ts">
  import { invoke } from '@tauri-apps/api/core';
  import { documentStore } from '$lib/stores/document.svelte';
  import { readiness } from '$lib/utils/scaffold';
  import {
    isPostPayload,
    isNotePayload,
    type PostPayload,
    type PMDoc,
    type PMNode,
  } from '$lib/types/scaffold';
  import { publishToSubstack } from '$lib/services/substack/publisher';
  import { RecordingTransport } from '$lib/services/substack/recordingTransport';
  import {
    BUILT_IN_BODY_PRESETS,
    type BodyPreset,
    buildBodyFromPreset,
  } from '$lib/utils/bodyPresets';
  import TransportRecorderPanel from '$lib/components/dev/TransportRecorderPanel.svelte';
  import { getBuffer } from '$lib/stores/transportRecorder.svelte';
  import {
    applySeoDraft,
    SEO_FIELD_PATHS,
    buildSeoPrompt,
    parseSeoDraftJson,
  } from '$lib/services/seo';
  import { getTagVocabulary, cachePublicationTags } from '$lib/services/tagVocabulary';
  import { pmDocToText } from '$lib/utils/pmText';
  import {
    substackConnectionsStore,
    normaliseSubdomain,
  } from '$lib/stores/substackConnections.svelte';

  let scaffold = $derived(documentStore.scaffold);
  // The dropdown's value must match an option (which uses the normalised
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

  let rttVisible = $state(false);
  let showRecorder = $state(false);
  let rttTitle = $state('Round-trip test');
  let rttSubtitle = $state('');
  let rttSlug = $state(`rtt-${crypto.randomUUID().slice(0, 6)}`);
  let bodyRttVisible = $state(false);
  let bodyPreset = $state<BodyPreset>('multi-section');

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

  function diffBodies(
    sent: PMDoc,
    fetched: PMDoc,
  ): { matched: number; differing: Array<{ path: string; a: unknown; b: unknown }> } {
    const differing: Array<{ path: string; a: unknown; b: unknown }> = [];
    let matched = 0;

    function countNodes(n: PMNode): number {
      const children = n.content ?? [];
      return 1 + children.reduce((sum, c) => sum + countNodes(c), 0);
    }

    function walk(a: PMNode | undefined, b: PMNode | undefined, path: string): void {
      if (a === undefined && b === undefined) return;
      if (a === undefined || b === undefined) {
        differing.push({ path, a, b });
        return;
      }
      const sameShape =
        a.type === b.type && JSON.stringify(a.attrs ?? null) === JSON.stringify(b.attrs ?? null);
      const sameContent = JSON.stringify(a.content ?? null) === JSON.stringify(b.content ?? null);
      const sameText = (a.text ?? '') === (b.text ?? '');
      if (sameShape && sameContent && sameText) {
        matched += countNodes(a);
        return;
      }
      // Text-level diff: surface the .text leaf with the parent's path
      if (a.type === 'text' && b.type === 'text' && a.text !== b.text) {
        differing.push({ path: `${path}.text`, a: a.text ?? '', b: b.text ?? '' });
        return;
      }
      if (
        a.type === 'paragraph' &&
        b.type === 'paragraph' &&
        (a.content ?? []).length === 1 &&
        (b.content ?? []).length === 1 &&
        a.content?.[0]?.type === 'text' &&
        b.content?.[0]?.type === 'text' &&
        (a.content[0].text ?? '') !== (b.content[0].text ?? '')
      ) {
        differing.push({
          path: `${path}.text`,
          a: a.content[0].text ?? '',
          b: b.content[0].text ?? '',
        });
        return;
      }
      // Type-only diff: same text content, different node type (e.g. paragraph → heading)
      if (!sameShape && sameContent && sameText) {
        differing.push({ path, a: a.type, b: b.type });
        return;
      }
      // Walk children
      const aChildren = a.content ?? [];
      const bChildren = b.content ?? [];
      const len = Math.max(aChildren.length, bChildren.length);
      for (let i = 0; i < len; i++) {
        walk(aChildren[i], bChildren[i], `${path}.${i}`);
      }
    }

    walk(sent as PMNode, fetched as PMNode, 'draft_body');
    return { matched, differing };
  }

  async function runMinimalRoundTrip() {
    if (!scaffold) return;
    const publication = scaffold.remote.publication.trim();
    if (!publication) {
      alert(
        'Enter your Substack publication subdomain first (e.g. "myblog" for myblog.substack.com).',
      );
      return;
    }
    if (!window.confirm('Send minimal post to Substack drafts? Sends only title, subtitle, slug.'))
      return;

    publishing = true;
    publishStatus = 'Opening Substack...';

    try {
      const { WebViewTransport } = await import('$lib/services/substack/webviewTransport');
      const transport = new RecordingTransport(new WebViewTransport(publication));

      const { invoke } = await import('@tauri-apps/api/core');
      const readImageAsDataUrl = async (src: string): Promise<string> => {
        if (src.startsWith('data:')) return src;
        const { resolveArtworkImagePath } = await import('$lib/utils/artworkReferences');
        const path = resolveArtworkImagePath(documentStore.filePath, src);
        if (!path) throw new Error(`Cannot resolve image: ${src}`);
        return invoke<string>('read_image_data_url', { path });
      };

      const { emptyScaffold } = await import('$lib/types/scaffold');
      const fresh = emptyScaffold('post');
      if (isPostPayload(fresh.payload)) {
        fresh.payload.draft_title = rttTitle;
        fresh.payload.draft_subtitle = rttSubtitle;
        fresh.payload.slug = rttSlug;
        fresh.payload.send = false;
      }

      publishStatus = 'Uploading images and creating draft...';
      const result = await publishToSubstack(fresh, transport, readImageAsDataUrl);

      publishStatus = result.draftId
        ? `Draft created. ID: ${result.draftId}\nConfirm by opening ${publication}.substack.com/publish`
        : `Error: no draftId returned`;
    } catch (e) {
      const base = `Error: ${e instanceof Error ? e.message : String(e)}`;
      const hint = getBuffer().length > 0 ? '\nOpen the recorder (🔬) for the failed request.' : '';
      publishStatus = base + hint;
    } finally {
      publishing = false;
    }
  }

  async function runBodyRoundTrip() {
    if (!scaffold) return;
    const publication = scaffold.remote.publication.trim();
    if (!publication) {
      alert(
        'Enter your Substack publication subdomain first (e.g. "myblog" for myblog.substack.com).',
      );
      return;
    }
    if (
      !window.confirm(
        'Send body round-trip to Substack? Includes title, subtitle, slug, draft_body.',
      )
    )
      return;

    publishing = true;
    publishStatus = 'Opening Substack...';

    try {
      const { WebViewTransport } = await import('$lib/services/substack/webviewTransport');
      const transport = new RecordingTransport(new WebViewTransport(publication));

      const { invoke } = await import('@tauri-apps/api/core');
      const readImageAsDataUrl = async (src: string): Promise<string> => {
        if (src.startsWith('data:')) return src;
        const { resolveArtworkImagePath } = await import('$lib/utils/artworkReferences');
        const path = resolveArtworkImagePath(documentStore.filePath, src);
        if (!path) throw new Error(`Cannot resolve image: ${src}`);
        return invoke<string>('read_image_data_url', { path });
      };

      const { emptyScaffold } = await import('$lib/types/scaffold');
      const fresh = emptyScaffold('post');
      if (!isPostPayload(fresh.payload)) throw new Error('expected post payload');
      fresh.payload.draft_title = rttTitle;
      fresh.payload.draft_subtitle = rttSubtitle;
      fresh.payload.slug = rttSlug;
      fresh.payload.draft_body = buildBodyFromPreset(bodyPreset);
      fresh.payload.send = false;

      publishStatus = 'Uploading images and creating draft...';
      const result = await publishToSubstack(fresh, transport, readImageAsDataUrl);

      if (!result.draftId) {
        publishStatus = 'Error: no draftId returned';
        return;
      }

      publishStatus = 'Draft created. Fetching back...';
      const fetched = await transport.getDraft(result.draftId);

      if (!fetched.ok) {
        publishStatus = `Body round-trip: draft created (ID: ${result.draftId}), but fetch-back failed — status ${fetched.status}.\nOpen the recorder (🔬) to inspect the round-trip.`;
        return;
      }

      const fetchedBody = (fetched.body as { draft_body?: PMDoc }).draft_body;
      if (!fetchedBody) {
        publishStatus = `Body round-trip: draft created (ID: ${result.draftId}), but fetch-back body did not include draft_body.\nOpen the recorder (🔬) to inspect.`;
        return;
      }

      const diff = diffBodies(fresh.payload.draft_body, fetchedBody);
      const differingLines = diff.differing
        .slice(0, 5)
        .map((d) => `${d.path}: ${JSON.stringify(d.a)} vs ${JSON.stringify(d.b)}`)
        .join('; ');
      const moreCount = diff.differing.length > 5 ? ` (+${diff.differing.length - 5} more)` : '';
      const verdict =
        diff.differing.length === 0
          ? `matched (all ${diff.matched} nodes equal)`
          : `${diff.matched} matched, ${diff.differing.length} differs — ${differingLines}${moreCount}`;
      publishStatus = `Body round-trip: ${verdict}. Draft ID: ${result.draftId}\nConfirm by opening ${publication}.substack.com/publish`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const hint = getBuffer().length > 0 ? '\nOpen the recorder (🔬) for the failed request.' : '';
      publishStatus = `Error: ${msg}${hint}`;
    } finally {
      publishing = false;
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
      scaffold.payload && 'trigger_at' in scaffold.payload && scaffold.payload.trigger_at
        ? 'schedule'
        : scaffold.payload && 'send' in scaffold.payload && scaffold.payload.send
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
        // A live URL is now load-bearing — pin the slug so regen can't change it.
        if (result.published && !scaffold.locked.includes(SEO_FIELD_PATHS.slug)) {
          scaffold.locked = [...scaffold.locked, SEO_FIELD_PATHS.slug];
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
</script>

{#if !scaffold}
  <div class="p-4 text-sm text-dark-400">No file open.</div>
{:else}
  <div class="flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm">
    {#snippet errorTip(field: string)}
      {#if errorMap.has(field)}
        <div
          class="absolute left-0 top-full mt-1 z-50 bg-dark-900 border border-red-500 text-red-300 text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg"
        >
          {errorMap.get(field)}
        </div>
      {/if}
    {/snippet}

    {#if isPostPayload(scaffold.payload)}
      {@const p = scaffold.payload}
      <!-- Payload: Core fields -->
      <section>
        <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Post</h3>
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1 relative group">
            <span class="text-dark-400 text-xs">Title</span>
            <textarea
              rows={2}
              value={p.draft_title}
              onchange={(e) => patch('draft_title', e.currentTarget.value)}
              class="bg-dark-800 border rounded p-2 text-dark-100 resize-none focus:border-primary-500 {errorMap.has(
                'draft_title',
              )
                ? 'border-red-500'
                : 'border-dark-600'}"></textarea>
            {@render errorTip('draft_title')}
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
          <label class="flex flex-col gap-1 relative group">
            <span class="text-dark-400 text-xs">Author</span>
            <input
              type="text"
              value={p.draft_bylines.length > 0
                ? (p.draft_bylines[0].name ?? `User #${p.draft_bylines[0].id}`)
                : 'Not set — assigned on publish'}
              readonly
              class="bg-dark-800 border rounded p-2 text-dark-100 {errorMap.has('draft_bylines')
                ? 'border-red-500'
                : 'border-dark-600'} {p.draft_bylines.length === 0 ? 'text-dark-500 italic' : ''}"
            />
            {@render errorTip('draft_bylines')}
          </label>
        </div>
      </section>

      <!-- Payload: SEO -->
      <section>
        <div class="flex items-center justify-between mb-2">
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
          <p class="text-xs text-red-400 mb-2">{seoError}</p>
        {/if}
        <div class="flex flex-col gap-3">
          <label class="flex flex-col gap-1 relative group">
            <span class="text-dark-400 text-xs flex justify-between">
              <span>SEO Title</span>
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
              <span>SEO Description</span>
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
        </div>
      </section>

      <!-- Payload: Publishing -->
      <section>
        <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">
          Publishing
        </h3>
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
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">
        Workshop <span class="text-dark-600 normal-case">(not published)</span>
      </h3>
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

    <!-- Round-trip control (dev) -->
    {#if import.meta.env.DEV}
      <button
        class="self-start text-xs text-dark-500 hover:text-dark-300"
        onclick={() => {
          rttVisible = !rttVisible;
        }}>{rttVisible ? 'Hide' : 'Show'} round-trip control</button
      >
    {/if}
    {#if rttVisible}
      <div class="border border-dark-700 rounded p-3 flex flex-col gap-2">
        <div class="text-xs font-semibold uppercase tracking-wide text-dark-400">
          Round-trip (dev)
        </div>
        <label class="flex flex-col gap-1 text-xs">
          Title
          <input
            class="bg-dark-900 border border-dark-700 rounded px-2 py-1"
            bind:value={rttTitle}
          />
        </label>
        <label class="flex flex-col gap-1 text-xs">
          Subtitle
          <input
            class="bg-dark-900 border border-dark-700 rounded px-2 py-1"
            bind:value={rttSubtitle}
          />
        </label>
        <label class="flex flex-col gap-1 text-xs">
          Slug
          <input
            class="bg-dark-900 border border-dark-700 rounded px-2 py-1 font-mono"
            bind:value={rttSlug}
          />
        </label>
        <button
          class="self-start px-3 py-1 rounded bg-blue-700 text-white text-sm disabled:opacity-50"
          disabled={publishing}
          onclick={runMinimalRoundTrip}>Round-trip to Substack drafts</button
        >
      </div>
    {/if}

    <button
      class="self-start text-xs text-dark-500 hover:text-dark-300"
      onclick={() => {
        bodyRttVisible = !bodyRttVisible;
      }}>{bodyRttVisible ? 'Hide' : 'Show'} body round-trip (Phase 2)</button
    >
    {#if bodyRttVisible}
      <div class="border border-dark-700 rounded p-3 flex flex-col gap-2">
        <div class="text-xs font-semibold uppercase tracking-wide text-dark-400">
          Body round-trip (Phase 2 · step 1)
        </div>
        <label class="flex flex-col gap-1 text-xs">
          Body preset
          <select
            class="bg-dark-900 border border-dark-700 rounded px-2 py-1"
            bind:value={bodyPreset}
          >
            {#each BUILT_IN_BODY_PRESETS as preset}
              <option value={preset}>{preset}</option>
            {/each}
          </select>
        </label>
        {#if bodyPreset === 'full-mirror'}
          <div class="text-xs text-dark-500">
            // TODO: Phase 3 — replace with comprehensive legal-node mirror.
          </div>
        {/if}
        <button
          class="self-start px-3 py-1 rounded bg-blue-700 text-white text-sm disabled:opacity-50"
          disabled={publishing}
          onclick={runBodyRoundTrip}>Run Body Round-Trip</button
        >
      </div>
    {/if}

    <!-- Substack publishing -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Substack</h3>
      <div class="flex flex-col gap-3">
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
        <button
          onclick={handlePublish}
          disabled={publishing || (r !== null && r.blocking.length > 0)}
          class="px-4 py-2 bg-primary-600 text-dark-900 rounded text-sm font-medium hover:bg-primary-700
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {publishing ? 'Working...' : 'Publish to Substack'}
        </button>
        {#if publishStatus}
          <p
            class="text-xs whitespace-pre-line {publishStatus.startsWith('Error')
              ? 'text-red-400'
              : 'text-green-400'}"
          >
            {publishStatus}
          </p>
        {/if}
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

    {#if import.meta.env.DEV}
      <div class="sticky bottom-2 self-end">
        <button
          class="text-xs px-2 py-1 rounded bg-dark-800 border border-dark-700 text-dark-300 hover:text-dark-100"
          onclick={() => {
            showRecorder = !showRecorder;
          }}>🔬 {showRecorder ? 'Hide' : 'Show'} recorder</button
        >
      </div>
      {#if showRecorder}
        <div
          class="fixed inset-4 z-50 border border-dark-700 rounded bg-dark-900 shadow-lg overflow-hidden"
        >
          <TransportRecorderPanel />
          <button
            class="absolute top-2 right-2 text-dark-400 hover:text-dark-100"
            onclick={() => {
              showRecorder = false;
            }}>×</button
          >
        </div>
      {/if}
    {/if}
  </div>
{/if}
