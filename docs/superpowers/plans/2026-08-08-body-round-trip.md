# Body Round-Trip Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a body round-trip preset to ScaffoldPanel.svelte that ships a known multi-section ProseMirror JSON body through `publishToSubstack`, fetches the saved draft back from Substack via a new `getDraft` transport method, and surfaces a shape-comparison verdict in `publishStatus`.

**Architecture:** Pure-function `bodyPresets.ts` builder constructs ProseMirror `PMDoc` instances for four named presets. A new `getDraft(id)` method is added to `SubstackTransport`, `WebViewTransport`, and `RecordingTransport` (parallel to existing 12 methods, dev-gated). `ScaffoldPanel` gains a new "Body round-trip" section that calls the existing `publishToSubstack` flow with the preset body, fetches back via `transport.getDraft`, and surfaces a `diffBodies` match/differ verdict in `publishStatus`. No new components.

**Tech Stack:** Svelte 5 (runes), Tauri 2, TypeScript, Vitest. Existing `SubstackTransport` interface from `src/lib/services/substack/transport.ts`. Existing `PMDoc` type from `src/lib/types/scaffold`.

## Global Constraints

Project-wide rules from the spec, `CLAUDE.md`, and `AGENTS.md`. Every task implicitly honors them.

- **StackEd package version**: `0.1.51` (auto-bumped from `0.1.50` on the design commit).
- **Six body-preset types in `bodyPresets.ts` only**: `minimal-paragraph`, `paragraph-heading`, `multi-section`, `full-mirror`. No PRESET allowed outside this list.
- **`full-mirror` is a stub** for this sub-project: returns the `multi-section` shape unchanged. Carries a `// TODO: Phase 3 — ...` comment so future-me knows. Wholly functional today.
- **Default preset is `multi-section`**.
- **`getDraft` is a single new method** on `SubstackTransport`. Non-200 response resolves as `{ ok: false, status, body }` (matching every other method). Network/timeout rejects with `Error`.
- **`RecordingTransport.getDraft` follows the existing wrap pattern**: `method:'GET'`, `path:'/api/v1/drafts/<id>'`, body is `undefined`. The `wrap` helper in `recordingTransport.ts` already records the request and response shape; no helper changes needed.
- **Fetch-back is automatic, never manual.** It runs after `publishToSubstack` returns a draftId. Surface failures in `publishStatus`; do not silently retry.
- **`diffBodies` returns `{ matched: number; differing: Array<{ path; a; b }> }`.** Walks both PMDoc trees in parallel using path-based indexing. Truncate `differing` to first 5 entries with `+N more` when there are more.
- **`publishStatus` text on success is "matched (all <N> nodes equal)"** — never hardcode a number into the format string (presets are evolving; the count shifts).
- **Commit style**: Conventional Commits with `Co-authored-by: factory-droid[bot]` footer. SpockLock auto-bumps `package.json` + lockfiles + `Cargo.toml` + `Cargo.lock` + `tauri.conf.json` per commit. Stage those files in the same commit when they appear.
- **No new dependencies**. All needed APIs are already in the project.
- **Existing tests must remain green** at every commit. Today: 191 unit tests + 27 Rust. After this plan: ~197 unit + 27 Rust.

---

## File Structure

### Created
- `src/lib/utils/bodyPresets.ts` — the pure-function preset builder.
- `src/lib/utils/bodyPresets.test.ts` — its tests.

### Modified
- `src/lib/services/substack/transport.ts` — adds one method to the interface.
- `src/lib/services/substack/webviewTransport.ts` — adds the implementation.
- `src/lib/services/substack/recordingTransport.ts` — adds the wrap-method wrapper.
- `src/lib/services/substack/recordingTransport.test.ts` — adds 2 tests.
- `src/lib/components/scaffold/ScaffoldPanel.svelte` — adds new imports, state, function (`runBodyRoundTrip`), helper (`diffBodies`), and a new panel section.

### Unchanged but newly exercised
- `src/lib/services/substack/publisher.ts` — `publishToSubstack` works as-is. The fetch-back wiring lives in `ScaffoldPanel.svelte`'s function, after `publishToSubstack` returns.
- `src/lib/stores/transportRecorder.svelte.ts` — works as-is; the new `getDraft` wrapper lands in the buffer like any other call.
- `src/lib/components/dev/TransportRecorderPanel.svelte` — works as-is.
- `src/lib/services/substack/payloadBuilder.ts` — works as-is; `buildCreateDraftRequest` already JSON-stringifies `draft_body` correctly.
- `src/types/scaffold.ts` — works as-is; re-uses existing `PMDoc` and `PMNode` types.

---

## Task 1: Body preset builder (TDD)

**Files:**
- Create: `src/lib/utils/bodyPresets.ts`
- Create: `src/lib/utils/bodyPresets.test.ts`

**Interfaces:**
- Consumes: `PMDoc` type from `$lib/types/scaffold`.
- Produces:
  - `type BodyPreset = 'minimal-paragraph' | 'paragraph-heading' | 'multi-section' | 'full-mirror'`
  - `const BUILT_IN_BODY_PRESETS: ReadonlyArray<BodyPreset>` — array of all four types, in declared order.
  - `function buildBodyFromPreset(preset: BodyPreset): PMDoc` — returns a fresh PMDoc; mutating the returned doc never affects subsequent calls (i.e., do not share references).

- [ ] **Step 1: Write the failing test `bodyPresets.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { buildBodyFromPreset, BUILT_IN_BODY_PRESETS, type BodyPreset } from './bodyPresets';

describe('bodyPresets', () => {
  it('exposes all four preset names in declared order', () => {
    expect(BUILT_IN_BODY_PRESETS).toEqual([
      'minimal-paragraph', 'paragraph-heading', 'multi-section', 'full-mirror',
    ]);
  });

  it('multi-section has 4 top-level nodes in the expected order', () => {
    const doc = buildBodyFromPreset('multi-section');
    expect(doc.type).toBe('doc');
    expect(doc.content.map(n => n.type)).toEqual(['paragraph', 'paragraph', 'heading', 'blockquote']);
  });

  it('multi-section paragraphs contain the expected body text', () => {
    const doc = buildBodyFromPreset('multi-section');
    const p1 = doc.content[0];
    const p2 = doc.content[1];
    expect(p1.content?.[0]).toMatchObject({ type: 'text', text: 'Body round-trip test — paragraph 1.' });
    expect(p2.content?.[0]).toMatchObject({ type: 'text', text: 'Body round-trip test — paragraph 2.' });
  });

  it('multi-section heading is H2 with the expected text', () => {
    const doc = buildBodyFromPreset('multi-section');
    const heading = doc.content[2];
    expect(heading).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect(heading.content?.[0]).toMatchObject({ type: 'text', text: 'Section heading' });
  });

  it('multi-section blockquote first child is a paragraph', () => {
    const doc = buildBodyFromPreset('multi-section');
    const blockquote = doc.content[3];
    expect(blockquote.type).toBe('blockquote');
    expect(blockquote.content?.[0]?.type).toBe('paragraph');
    expect(blockquote.content?.[0]?.content?.[0]).toMatchObject({
      type: 'text', text: 'A quoted passage for testing blockquotes.',
    });
  });

  it('returns structurally-equal but distinct instances across calls', () => {
    const a = buildBodyFromPreset('multi-section');
    const b = buildBodyFromPreset('multi-section');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.content).not.toBe(b.content);
  });

  it('throws on unknown preset name', () => {
    expect(() => buildBodyFromPreset('bogus' as BodyPreset)).toThrow(/bogus/);
  });

  it('full-mirror stub returns the multi-section shape', () => {
    expect(buildBodyFromPreset('full-mirror')).toEqual(buildBodyFromPreset('multi-section'));
  });

  it('minimal-paragraph returns one paragraph with the body text', () => {
    const doc = buildBodyFromPreset('minimal-paragraph');
    expect(doc.content.map(n => n.type)).toEqual(['paragraph']);
    expect(doc.content[0].content?.[0]).toMatchObject({ type: 'text', text: 'Body round-trip test.' });
  });

  it('paragraph-heading returns a paragraph plus an H2', () => {
    const doc = buildBodyFromPreset('paragraph-heading');
    expect(doc.content.map(n => n.type)).toEqual(['paragraph', 'heading']);
    expect(doc.content[1]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- bodyPresets`
Expected: FAIL — `./bodyPresets` does not exist.

- [ ] **Step 3: Write minimal implementation `bodyPresets.ts`**

```ts
import type { PMDoc, PMNode } from '$lib/types/scaffold';

export type BodyPreset =
  | 'minimal-paragraph'
  | 'paragraph-heading'
  | 'multi-section'
  | 'full-mirror';

export const BUILT_IN_BODY_PRESETS: ReadonlyArray<BodyPreset> = [
  'minimal-paragraph',
  'paragraph-heading',
  'multi-section',
  'full-mirror',
];

function paragraph(text: string): PMNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function heading(text: string, level: 2): PMNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function blockquote(text: string): PMNode {
  return { type: 'blockquote', content: [paragraph(text)] };
}

function multiSectionBody(): PMDoc {
  return {
    type: 'doc',
    content: [
      paragraph('Body round-trip test — paragraph 1.'),
      paragraph('Body round-trip test — paragraph 2.'),
      heading('Section heading', 2),
      blockquote('A quoted passage for testing blockquotes.'),
    ],
  };
}

export function buildBodyFromPreset(preset: BodyPreset): PMDoc {
  switch (preset) {
    case 'minimal-paragraph':
      return { type: 'doc', content: [paragraph('Body round-trip test.')] };
    case 'paragraph-heading':
      return { type: 'doc', content: [paragraph('Body round-trip test — paragraph 1.'), heading('Section heading', 2)] };
    case 'multi-section':
      return multiSectionBody();
    case 'full-mirror':
      // TODO: Phase 3 — replace with comprehensive legal-node mirror.
      return multiSectionBody();
    default:
      throw new Error(`Unknown body preset: ${String(preset)}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- bodyPresets`
Expected: 10 tests pass; output pristine.

- [ ] **Step 5: Run full suite + type-check**

Run: `npm run test && npm run check`
Expected: 191 → 201 unit tests pass (191 + 10 new); type-check 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/bodyPresets.ts src/lib/utils/bodyPresets.test.ts
git commit -m "feat: body preset builder for round-trip presets

Pure-function builder for four named presets (minimal-paragraph,
paragraph-heading, multi-section, full-mirror). full-mirror is a
stub for Phase 3. Each call returns a fresh PMDoc; mutation does
not bleed across calls.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

> SpockLock will auto-bump version files for this commit. Stage them in the same commit when they appear.

---

## Task 2: `getDraft` transport method (interface + impl + recording wrapper + tests)

**Files:**
- Modify: `src/lib/services/substack/transport.ts` — add `getDraft(draftId: number): Promise<SubstackResponse>` to the `SubstackTransport` interface.
- Modify: `src/lib/services/substack/webviewTransport.ts` — add the implementation.
- Modify: `src/lib/services/substack/recordingTransport.ts` — add a `getDraft` wrapper using the existing `wrap` helper.
- Modify: `src/lib/services/substack/recordingTransport.test.ts` — add 2 tests.

**Interfaces:**
- Consumes: `SubstackResponse` (existing); the `wrap` helper and `RecordingTransport` class (existing).
- Produces:
  - `SubstackTransport.getDraft(draftId: number): Promise<SubstackResponse>` — interface method.
  - `WebViewTransport.getDraft(draftId: number)` — delegates to existing `this.send('GET', \`/api/v1/drafts/${draftId}\`)`.
  - `RecordingTransport.getDraft(draftId: number)` — wraps via `this.wrap('GET', \`/api/v1/drafts/${draftId}\`, undefined, () => this.inner.getDraft(draftId))`.

- [ ] **Step 1: Add `getDraft` to `transport.ts` interface**

In `src/lib/services/substack/transport.ts`, inside the `SubstackTransport` interface, just before the `isLoggedIn` declaration:

```ts
  /** GET /api/v1/drafts/{id} — fetch an existing draft back from Substack. */
  getDraft(draftId: number): Promise<SubstackResponse>;
```

- [ ] **Step 2: Add `getDraft` to `webviewTransport.ts`**

In `src/lib/services/substack/webviewTransport.ts`, alongside the other 12 public methods (e.g., directly after `unscheduleDraft`):

```ts
  async getDraft(draftId: number): Promise<SubstackResponse> {
    return this.send('GET', `/api/v1/drafts/${draftId}`);
  }
```

> No additional imports — `send` and `SubstackResponse` are already in scope.

- [ ] **Step 3: Add `getDraft` to `recordingTransport.ts`**

In `src/lib/services/substack/recordingTransport.ts`, alongside the other 12 wrapper methods (e.g., directly after `unscheduleDraft`):

```ts
  getDraft(draftId: number): Promise<SubstackResponse> {
    return this.wrap('GET', `/api/v1/drafts/${draftId}`, undefined, () => this.inner.getDraft(draftId));
  }
```

- [ ] **Step 4: Write the failing tests in `recordingTransport.test.ts`**

Append the following two tests inside the existing `describe('RecordingTransport', …)` block at the end of the file (after the existing 9 tests):

```ts
  it('delegates getDraft with the id-interpolated path and forwards the id', async () => {
    const stub = new StubTransport() as unknown as SubstackTransport;
    const response: SubstackResponse = { ok: true, status: 200, body: { id: 42, draft_title: 'X' } };
    stub.getDraft = vi.fn().mockResolvedValue(response);
    const recorder = new RecordingTransport(stub);
    const result = await recorder.getDraft(42);
    expect(result).toEqual(response);
    expect(stub.getDraft).toHaveBeenCalledTimes(1);
    expect(stub.getDraft).toHaveBeenCalledWith(42);
  });

  it('records non-throwing SubstackResponse status on a getDraft that returns 404', async () => {
    const stub = new StubTransport() as unknown as SubstackTransport;
    const response: SubstackResponse = { ok: false, status: 404, body: { error: 'not found' } };
    stub.getDraft = vi.fn().mockResolvedValue(response);
    const recorder = new RecordingTransport(stub);
    const result = await recorder.getDraft(404);
    expect(result).toEqual(response);
    expect(getBuffer()).toHaveLength(1);
    expect(getBuffer()[0].status).toBe(404);
  });
```

Also ensure `StubTransport` in the test file has a `getDraft = vi.fn();` line (extend the existing mock class).

- [ ] **Step 5: Run tests to verify they fail (RED)**

Run: `npm run test -- recordingTransport`
Expected: FAIL — `RecordingTransport` does not yet implement `getDraft`. The TypeScript compile errors about missing method on the class.

- [ ] **Step 6: Run tests to verify the wrapper changes make them pass (GREEN)**

Run: `npm run test -- recordingTransport`
Expected: After Steps 1–3 are in place, PASS. The 2 new tests pass alongside the 9 existing tests. Total: 11 tests in this file.

- [ ] **Step 7: Run full suite + type-check**

Run: `npm run test && npm run check`
Expected: 201 → 203 unit tests pass (201 + 2 getDraft tests). Type-check 0 errors. Since `getDraft` was added to the interface, the new implementation is covered by existing stub through the modified test file; all earlier tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/services/substack/transport.ts \
        src/lib/services/substack/webviewTransport.ts \
        src/lib/services/substack/recordingTransport.ts \
        src/lib/services/substack/recordingTransport.test.ts
git commit -m "feat: getDraft transport method for fetch-back verification

Adds GET /api/v1/drafts/{id} across the transport interface, the
WebView implementation, and the dev-only RecordingTransport wrapper.
Same pattern as the existing 12 methods; non-200 resolves as
{ok:false,status,body}; throws on network/timeout. Tests cover
delegation with the id-interpolated path and non-throwing 404
recording.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

> SpockLock will auto-bump version files. Stage them in the same commit.

---

## Task 3: ScaffoldPanel body round-trip section

**Files:**
- Modify: `src/lib/components/scaffold/ScaffoldPanel.svelte` — adds new imports, state, a `runBodyRoundTrip()` function, a `diffBodies()` helper, and a new panel section.

**Interfaces:**
- Consumes:
  - `BUILT_IN_BODY_PRESETS`, `BodyPreset`, `buildBodyFromPreset` from `$lib/utils/bodyPresets` (Task 1).
  - `RecordingTransport`, `WebViewTransport`, `publishToSubstack`, `emptyScaffold` (existing; mirror Phase 1's imports).
  - All existing runes: `scaffold`, `rttTitle`, `rttSubtitle`, `rttSlug`, `publishing`, `publishStatus`, `documentStore`, the publication-check pattern in `runMinimalRoundTrip`.
  - `PMDoc`, `PMNode` from `$lib/types/scaffold` (existing types — only re-typed for the helper signature).
  - `getBuffer` from `$lib/stores/transportRecorder.svelte` (for "open recorder" hint logic, mirroring Task 5's spec).
- Produces:
  - State: `bodyPreset`, `bodyRttVisible`.
  - Function: `runBodyRoundTrip()` — symmetric with `runMinimalRoundTrip()`; uses preset body; calls `transport.getDraft` after draft is created; runs `diffBodies`; sets `publishStatus`.
  - Helper: `diffBodies(sent: PMDoc, fetched: PMDoc): { matched: number; differing: Array<{ path: string; a: unknown; b: unknown }> }` — recursive parallel walk.
  - Markup: a divider-separated section with header, preset dropdown, Run button.

- [ ] **Step 1: Add new imports below the existing RecordingTransport import**

In `src/lib/components/scaffold/ScaffoldPanel.svelte`, find `import { RecordingTransport } from '$lib/services/substack/recordingTransport';` and add directly below:

```svelte
  import { BUILT_IN_BODY_PRESETS, type BodyPreset, buildBodyFromPreset } from '$lib/utils/bodyPresets';
```

> The `.svelte` import for rune stores (`transportRecorder.svelte`) is re-used via the existing `getBuffer` import that was added in the Phase 1 fix wave.

- [ ] **Step 2: Add new state declarations**

Find the existing `let rttSlug = $state(\`rtt-${crypto.randomUUID().slice(0, 6)}\`);` declaration and add below it:

```svelte
  let bodyRttVisible = $state(false);
  let bodyPreset = $state<BodyPreset>('multi-section');
```

- [ ] **Step 3: Add the `diffBodies()` helper above `runMinimalRoundTrip`**

Insert this helper in the script block. It can sit anywhere above `runMinimalRoundTrip`; placing it directly above the new `runBodyRoundTrip` is cleanest:

```svelte
  function diffBodies(sent: PMDoc, fetched: PMDoc): { matched: number; differing: Array<{ path: string; a: unknown; b: unknown }> } {
    const differing: Array<{ path: string; a: unknown; b: unknown }> = [];
    let matched = 0;

    function walk(a: PMNode | undefined, b: PMNode | undefined, path: string): void {
      if (a === undefined && b === undefined) return;
      if (a === undefined || b === undefined) {
        differing.push({ path, a, b });
        return;
      }
      const sameShape = a.type === b.type
        && JSON.stringify(a.attrs ?? null) === JSON.stringify(b.attrs ?? null);
      const sameContent = JSON.stringify(a.content ?? null) === JSON.stringify(b.content ?? null);
      if (sameShape && sameContent) {
        matched++;
        return;
      }
      if ((a.type === 'text' && b.type === 'text') || (a.type === 'paragraph' && b.type === 'paragraph')) {
        if ((a.content ?? []).length === 1 && (b.content ?? []).length === 1 && (a.content?.[0]?.text ?? '') !== (b.content?.[0]?.text ?? '')) {
          differing.push({ path, a: a.content?.[0]?.text, b: b.content?.[0]?.text });
          return;
        }
      }
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
```

> The helper uses `JSON.stringify` for stable comparison rather than deep-equality libraries (no new dependency). `path` is dot-indexed (`draft_body.2.text`) for compactness. Capped at 5 `differing` entries by the caller, not the helper.

- [ ] **Step 4: Add the `runBodyRoundTrip()` function below `runMinimalRoundTrip`**

```svelte
  async function runBodyRoundTrip() {
    if (!scaffold) return;
    const publication = scaffold.remote.publication.trim();
    if (!publication) {
      alert('Enter your Substack publication subdomain first (e.g. "myblog" for myblog.substack.com).');
      return;
    }
    if (!window.confirm('Send body round-trip to Substack? Includes title, subtitle, slug, draft_body.')) return;

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
      fresh.payload.draft_title = rttTitle;
      fresh.payload.draft_subtitle = rttSubtitle;
      fresh.payload.slug = rttSlug;
      fresh.payload.draft_body = buildBodyFromPreset(bodyPreset);
      fresh.payload.send = false;
      if (isPostPayload(fresh.payload)) {
        // type narrow — payload is currently PostPayload; the guard mirrors Phase 1.
        fresh.payload.send = false;
      }

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
      const differingLines = diff.differing.slice(0, 5).map(d =>
        `${d.path}: ${JSON.stringify(d.a)} vs ${JSON.stringify(d.b)}`
      ).join('; ');
      const moreCount = diff.differing.length > 5 ? ` (+${diff.differing.length - 5} more)` : '';
      const verdict = diff.differing.length === 0
        ? `matched (all ${diff.matched} nodes equal)`
        : `${diff.matched} matched, ${diff.differing.length} differs — ${differingLines}${moreCount}`;
      publishStatus = `Body round-trip: ${verdict}. Draft ID: ${result.draftId}\nConfirm by opening ${publication}.substack.com/publish`;
    } catch (e) {
      publishStatus = `Error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      publishing = false;
    }
  }
```

> Notes on the function:
> - The `isPostPayload(fresh.payload)` guard is for TypeScript narrowing. `emptyScaffold('post')` returns a Scaffold with a `payload: PostPayload | NotePayload` union; assignments to `draft_title` etc. need a narrow. Mirror Phase 1's pattern.
> - `transport.getDraft` calls the fetch-back. Same `RecordingTransport` decorator; an additional buffer entry lands at index 2 automatically.
> - `diffBodies` compares the original `fresh.payload.draft_body` (the sent body) against `fetched.body.draft_body` (Substack's response).
> - Verdict text uses the variable form "matched (all N nodes equal)" — never hardcode.

- [ ] **Step 5: Add the new section markup above the existing "Substack publishing" block**

Find the existing divider that ends the Phase 1 "Round-trip" section (the closing `</div>` of `{#if rttVisible}`) and add directly below, before the existing `{/* TODO / Substack publishing field */}` area:

```svelte
      <button
        class="self-start text-xs text-dark-500 hover:text-dark-300"
        onclick={() => { bodyRttVisible = !bodyRttVisible; }}
      >{bodyRttVisible ? 'Hide' : 'Show'} body round-trip (Phase 2)</button>
      {#if bodyRttVisible}
        <div class="border border-dark-700 rounded p-3 flex flex-col gap-2">
          <div class="text-xs font-semibold uppercase tracking-wide text-dark-400">Body round-trip (Phase 2 · step 1)</div>
          <label class="flex flex-col gap-1 text-xs">
            Body preset
            <select class="bg-dark-900 border border-dark-700 rounded px-2 py-1" bind:value={bodyPreset}>
              {#each BUILT_IN_BODY_PRESETS as preset}
                <option value={preset}>{preset}</option>
              {/each}
            </select>
          </label>
          {#if bodyPreset === 'full-mirror'}
            <div class="text-xs text-dark-500">// TODO: Phase 3 — replace with comprehensive legal-node mirror.</div>
          {/if}
          <button
            class="self-start px-3 py-1 rounded bg-blue-700 text-white text-sm disabled:opacity-50"
            disabled={publishing}
            onclick={runBodyRoundTrip}
          >Run Body Round-Trip</button>
        </div>
      {/if}
```

> Notes:
> - The full-mirror placeholder TODO is **explicitly intended** per the spec. Do NOT remove or "fix up" — it documents the deferred feature.
> - Tailwind classes used here (`bg-dark-900`, `border-dark-700`, `bg-blue-700`, etc.) are present and used elsewhere in the file. No new theme tokens.

- [ ] **Step 6: Run type-check**

Run: `npm run check`
Expected: 0 errors. (The script has 11 pre-existing warnings in unrelated files that don't grow.)

- [ ] **Step 7: Run the full test suite**

Run: `npm run test`
Expected: 203 unit tests pass (191 + 10 bodyPresets + 2 getDraft).

- [ ] **Step 8: Smoke-test the build**

Run: `npm run build`
Expected: Vite bundle produces `dist/` with no errors. (Chunk-size warnings on `App.svelte` are pre-existing.)

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/scaffold/ScaffoldPanel.svelte
git commit -m "feat: body round-trip section in ScaffoldPanel with fetch-back

Adds a new 'Show body round-trip (Phase 2)' section beside Phase 1's
minimal preset. Default preset is multi-section (paragraphs + H2 +
blockquote). After publishToSubstack returns a draftId, transitively
calls transport.getDraft and surfaces a diffBodies verdict in
publishStatus (matched / N-differ / fetch-back-failed). Recorder
panel picks up the new GET automatically.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

> SpockLock will auto-bump version files. Stage them in the same commit.

---

## Task 4: Manual verification runbook

**Files:** none. Manual user-driven step.

- [ ] **Step 1: Pre-check**

Open `https://<your-sub>.substack.com/publish` in your normal browser. Confirm you're logged in. This proves the session-cookie path independently of StackEd.

- [ ] **Step 2: Start `npm run tauri:dev`**

Run: `npm run tauri:dev`
Expected: Tauri app launches. ScaffoldPanel visible.

- [ ] **Step 3: Open the recorder**

Click the 🔬 button at the bottom-right of ScaffoldPanel. The recorder overlay opens with `(0/200)` entries. Close it back, or leave it open — entries will appear once the run starts.

- [ ] **Step 4: Open the body round-trip section**

Click "Show body round-trip (Phase 2)". The new section appears with the preset dropdown defaulting to `multi-section`.

- [ ] **Step 5: Run Body Round-Trip**

Click the "Run Body Round-Trip" button. Confirm the prompt. The Substack auth window opens; log in if not already.

- [ ] **Step 6: Verify success path (matched)**

- The recorder shows **3 entries** in invocation order:
  - `GET /api/v1/user/profile/self → 200` (SubstackResponse body is the user profile)
  - `POST /api/v1/drafts → 200` (body in is the multi-section payload; body out is `{ id: <n> }`)
  - `GET /api/v1/drafts/<n> → 200` (body out is the full draft, including the stored `draft_body`)
- `publishStatus` reads `"Body round-trip: matched (all <N> nodes equal). Draft ID: <id>\nConfirm by opening <sub>.substack.com/publish"`.
- Open `<sub>.substack.com/publish` in a separate browser tab. The new draft titled with `rttTitle` appears in your drafts list. Open it in Substack's editor:
  - Two paragraphs of body text appear (paragraph 1 + paragraph 2).
  - An H2 reads "Section heading".
  - A blockquote contains the quoted passage.

- [ ] **Step 7: *(optional)* Verify partial-match reporting**

In Substack's editor, open the new draft and edit one piece of body text (e.g., change "Section heading" to "Section heading (edited)"). Save. The body has now diverged from what we sent.

Click "Run Body Round-Trip" again. The new run creates a *new* draft — it won't fetch back the manually-edited one. To verify partial-match reporting, the easier path is: copy the `draftDraftId` that you saw in the previous run, and try `transport.getDraft(<thatID>)` directly from the dev console, or just trust the multi-section test case to surface a difference if Substack normalizes whitespace. (If `publishStatus` reads "matched" anyway, that means Substack stores verbatim, which is what we want — and that's also confirmation.)

A second option: edit a sent body, run again, intentionally diverge; check that the verdict picks up the difference. This is optional polish.

- [ ] **Step 8: Tag the release (or wait — it's the user's call)**

After step 6 succeeds AND the user has visually confirmed the rendered body in Substack:

```bash
git tag v0.1.51
git log --oneline v0.1.50..HEAD
```

The diff between v0.1.50 and v0.1.51 should be exactly the commits from Tasks 1–3 + SpockLock auto-bumped version files.

- [ ] **Step 9: Cleanup**

Delete the `rtt-` drafts from Substack's drafts list. (Manual. The slug pattern `rtt-` + 6 hex chars is unique enough to find them with a quick filter.)

---

## Done = success

`docs/superpowers/specs/2026-08-08-body-round-trip-design.md` is satisfied when:

- Task 3's "Run Body Round-Trip" button produces a real draft in the user's Substack drafts list.
- The recorder's three expected entries (`getUserInfo`, `createDraft`, `getDraft`) are visible.
- `publishStatus` reports "matched (all N nodes equal)" on the first successful run.
- All 203 unit tests pass.
- `npm run check` shows 0 errors.
- `npm run build` succeeds.
- The existing runbook step 6 confirms the body in Substack matches the multi-section preset's two paragraphs, H2, and blockquote.
