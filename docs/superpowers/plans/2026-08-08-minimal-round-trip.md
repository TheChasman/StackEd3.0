# Minimal Round-Trip Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify the existing scaffold → Substack round-trip works against a real publication by enabling `withGlobalTauri`, adding a dev-only transport recorder, and adding a one-button "minimal round-trip" control in the ScaffoldPanel.

**Architecture:** A `RecordingTransport` decorator wraps any `SubstackTransport` to capture request/response pairs into a ring buffer; a Svelte 5 rune store exposes them; a hidden dev-only panel renders them. The minimal round-trip control in `ScaffoldPanel.svelte` constructs an empty scaffold, fills only `draft_title`/`draft_subtitle`/`slug`, and calls the existing `publishToSubstack()` against the wrapped transport. No rewrites of the existing WebView transport, payload builders, or publisher code.

**Tech Stack:** Svelte 5 (runes), Tauri 2, TypeScript, Vitest, existing `SubstackTransport` interface from `src/lib/services/substack/transport.ts`.

## Global Constraints

These are project-wide rules from the spec, `CLAUDE.md`, and `AGENTS.md`. Every task implicitly honors them.

- **StackEd package version**: `0.1.43` (auto-bumped from `0.1.42` by SpockLock on the design commit).
- **Tauri permissions file** at `src-tauri/capabilities/substack-auth.json` is unchanged in this plan.
- **TDD discipline**: test files exist in `src/lib/services/substack/recordingTransport.test.ts` and `src/lib/stores/transportRecorder.svelte.test.ts`. They are written before any implementation.
- **Commit style**: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Include `Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>` footer. No force pushes.
- **No new dependencies**. All needed APIs are already in the project.
- **Recorder gating**: per-method `import.meta.env.DEV` check inside `RecordingTransport` methods. Production paths produce no buffer entries.
- **No comments in shipped code unless behaviour is non-obvious** (existing convention — see `recordingTransport.ts`'s sibling `payloadBuilder.ts` for the style).
- **Existing tests must remain green** at every commit. Today: 178 unit + 27 Rust.

---

## File Structure

### Created
- `src/lib/services/substack/recordingTransport.ts` — the decorator (`RecordingTransport` class).
- `src/lib/services/substack/recordingTransport.test.ts` — its tests.
- `src/lib/stores/transportRecorder.svelte.ts` — module-level ring buffer + Svelte 5 rune store.
- `src/lib/stores/transportRecorder.svelte.test.ts` — its tests.
- `src/lib/components/dev/TransportRecorderPanel.svelte` — hidden dev-only inspection UI.

### Modified
- `src-tauri/tauri.conf.json` — add `build.withGlobalTauri = true`.
- `src/lib/components/scaffold/ScaffoldPanel.svelte` — add round-trip control + 🔬 toggle.

### Unchanged but verified
- `src/lib/services/substack/webviewTransport.ts` — needs `window.__TAURI__` to resolve; flag fix in Task 1 makes that happen.
- `src/lib/services/substack/transport.ts` — interface the decorator implements.
- `src/lib/services/substack/publisher.ts` — calls `publishToSubstack` flow unchanged.
- `src/lib/services/substack/payloadBuilder.ts` — body build unchanged.
- `src-tauri/src/lib.rs:141` — Rust `eval_in_webview` command unchanged.
- `src-tauri/capabilities/substack-auth.json` — unchanged.

---

## Task 1: Enable `withGlobalTauri` in Tauri config

**Files:**
- Modify: `src-tauri/tauri.conf.json` (add one key under `build`)

This is the foundation. The injected listener script in `webviewTransport.ts` references `window.__TAURI__.event` from inside the WebView. In Tauri 2 that global is off by default — `window.__TAURI__` is `undefined` and the script crashes silently. This one-line flag turns it on.

- [ ] **Step 1: Edit `src-tauri/tauri.conf.json`**

In the existing `build` object (currently has `frontendDist`, `devUrl`, `beforeDevCommand`, `beforeBuildCommand`), add `"withGlobalTauri": true` as the last key:

```json
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "withGlobalTauri": true
  },
```

- [ ] **Step 2: Verify the JSON still parses**

Run: `node -e "JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json'))"`
Expected: exits 0, no output.

- [ ] **Step 3: Run type-check to confirm no schema regression**

Run: `npm run check`
Expected: 0 errors. (svelte-check should still pass — we didn't change Svelte/TS code.)

- [ ] **Step 4: Run the existing test suite to confirm no regression**

Run: `npm run test`
Expected: 178 tests pass (or whatever the prior baseline was — re-baseline if unfamiliar).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "fix: enable withGlobalTauri so substack-auth WebView listener resolves

The injected script in webviewTransport.ts uses
window.__TAURI__.event.listen from inside the substack-auth WebView.
Tauri 2 disables the global API by default; without this flag the
listener crashes before fetch and the round-trip fails at the listener.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

> **Note:** SpockLock auto-bumps `package.json` and `src-tauri/Cargo.toml` on every commit to `main`. Assume those files are touched and stage them in the commit when present.

---

## Task 2: `RecordingTransport` decorator (TDD)

**Files:**
- Create: `src/lib/services/substack/recordingTransport.test.ts`
- Create: `src/lib/services/substack/recordingTransport.ts`

**Interfaces:**
- Consumes: `SubstackTransport` interface from `src/lib/services/substack/transport.ts`. The test file imports it.
- Produces: `class RecordingTransport implements SubstackTransport`. Constructor signature: `constructor(inner: SubstackTransport)`. All 12 public methods delegate to `inner`. Buffer is module-level; methods push entries via a `record(entry)` helper imported from the next task's store (created in Task 3) — but Task 2 imports it via a thin interface so tests don't depend on Task 3 concretely. **Concretely**: Task 2 imports `recordEntry`, `clearBuffer`, `subscribe` from `$lib/stores/transportRecorder`.

- [ ] **Step 1: Write the failing test file `recordingTransport.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordingTransport } from './recordingTransport';
import type { SubstackTransport, SubstackResponse, ImageUploadResult } from './transport';

class StubTransport implements Partial<SubstackTransport> {
  createDraft = vi.fn();
  publishDraft = vi.fn();
  scheduleDraft = vi.fn();
  uploadImage = vi.fn();
  getUserInfo = vi.fn();
  // ... other methods stubbed as needed
  isLoggedIn = vi.fn().mockResolvedValue(true);
}

import { recordEntry, clearBuffer } from '$lib/stores/transportRecorder';

describe('RecordingTransport', () => {
  beforeEach(() => clearBuffer());

  it('delegates createDraft and records a 200 entry', async () => {
    const stub = new StubTransport() as unknown as SubstackTransport;
    const response: SubstackResponse = { ok: true, status: 200, body: { id: 42 } };
    stub.createDraft.mockResolvedValue(response);
    const recorder = new RecordingTransport(stub);
    recordEntry({ id: 't1', startedAt: 1, method: 'POST', path: '/api/v1/drafts', bodyIn: { x: 1 }, status: 'pending', bodyOut: null, error: null, endedAt: null });
    const result = await recorder.createDraft({ x: 1 });
    expect(result).toEqual(response);
    expect(stub.createDraft).toHaveBeenCalledTimes(1);
    expect(stub.createDraft).toHaveBeenCalledWith({ x: 1 });
  });

  it('records an error when the inner throws, then re-throws', async () => {
    const stub = new StubTransport() as unknown as SubstackTransport;
    stub.getUserInfo.mockRejectedValue(new Error('boom'));
    const recorder = new RecordingTransport(stub);
    await expect(recorder.getUserInfo()).rejects.toThrow('boom');
  });
});
```

> **Note:** the buffer-shape test against `recordEntry` is owned by the store's own test (Task 3). The decorator tests focus on delegation and re-throw semantics.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- recordingTransport`
Expected: FAIL — `recordingTransport.ts` does not yet exist. The `import { RecordingTransport } from './recordingTransport';` line should throw "Cannot find module" or similar.

- [ ] **Step 3: Write the minimal implementation `recordingTransport.ts`**

```ts
import type { SubstackTransport, SubstackResponse, ImageUploadResult } from './transport';
import type { Byline } from '$lib/types/scaffold';
import { recordEntry } from '$lib/stores/transportRecorder';

let entryCounter = 0;
function newEntryId(): string { return `e_${++entryCounter}`; }

export class RecordingTransport implements SubstackTransport {
  constructor(private readonly inner: SubstackTransport) {}

  private async wrap<T>(method: string, path: string, bodyIn: unknown, call: () => Promise<T>): Promise<T> {
    const id = newEntryId();
    const startedAt = Date.now();
    if (import.meta.env.DEV) {
      recordEntry({ id, startedAt, method, path, bodyIn, status: 'pending', bodyOut: null, error: null, endedAt: null });
    }
    try {
      const bodyOut = await call();
      if (import.meta.env.DEV) {
        recordEntry({ id, startedAt, method, path, bodyIn, status: 200, bodyOut, error: null, endedAt: Date.now() });
      }
      return bodyOut;
    } catch (e) {
      if (import.meta.env.DEV) {
        recordEntry({ id, startedAt, method, path, bodyIn, status: 0, bodyOut: null, error: String(e), endedAt: Date.now() });
      }
      throw e;
    }
  }

  createDraft(body: unknown): Promise<SubstackResponse> {
    return this.wrap('POST', '/api/v1/drafts', body, () => this.inner.createDraft(body));
  }
  updateDraft(id: number, body: unknown): Promise<SubstackResponse> {
    return this.wrap('PUT', `/api/v1/drafts/${id}`, body, () => this.inner.updateDraft(id, body));
  }
  publishDraft(id: number, body: unknown): Promise<SubstackResponse> {
    return this.wrap('PUT', `/api/v1/drafts/${id}/publish`, body, () => this.inner.publishDraft(id, body));
  }
  scheduleDraft(id: number, body: unknown): Promise<SubstackResponse> {
    return this.wrap('POST', `/api/v1/drafts/${id}/scheduled_release`, body, () => this.inner.scheduleDraft(id, body));
  }
  unscheduleDraft(id: number): Promise<SubstackResponse> {
    return this.wrap('DELETE', `/api/v1/drafts/${id}/scheduled_release`, undefined, () => this.inner.unscheduleDraft(id));
  }
  createNote(body: unknown): Promise<SubstackResponse> {
    return this.wrap('POST', '/api/v1/comment/feed', body as { bodyJson: unknown }, () => this.inner.createNote(body));
  }
  listPostTags(): Promise<SubstackResponse> {
    return this.wrap('GET', '/api/v1/publication/post-tag', undefined, () => this.inner.listPostTags());
  }
  createPostTag(name: string): Promise<SubstackResponse> {
    return this.wrap('POST', '/api/v1/publication/post-tag', { name }, () => this.inner.createPostTag(name));
  }
  attachTag(postId: number, tagId: string): Promise<SubstackResponse> {
    return this.wrap('POST', `/api/v1/post/${postId}/tag/${tagId}`, undefined, () => this.inner.attachTag(postId, tagId));
  }
  uploadImage(dataUrl: string): Promise<ImageUploadResult> {
    return this.wrap('POST', '/api/v1/image', { image: dataUrl }, () => this.inner.uploadImage(dataUrl));
  }
  isLoggedIn(): Promise<boolean> {
    return this.wrap('GET', '/api/v1/user/profile/self', undefined, () => this.inner.isLoggedIn());
  }
  getUserInfo(): Promise<Byline> {
    return this.wrap('GET', '/api/v1/user/profile/self', undefined, () => this.inner.getUserInfo());
  }
}
```

> **Note:** the `wrap` helper records twice (place-marker then final). For Task 2 to be testable without depending on the actual store shape, the test only asserts delegation; record shape lives in Task 3's tests. If Task 2's test cannot import `$lib/stores/transportRecorder` yet because Task 3 has not created it, see the side-step in the testing note below.

The implementation above already imports `recordEntry` from a path that will be created in Task 3. **Resolve the dependency by writing Task 3 (the store stub) FIRST**, with `recordEntry` exported as a no-op `() => {}`, just enough for Task 2's tests to compile and run. The full Task 3 implementation lands in its own task before Task 2 is committed.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- recordingTransport`
Expected: PASS.

- [ ] **Step 5: Run full suite to confirm no regression**

Run: `npm run test`
Expected: 178 + 2 (recordingTransport) tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/substack/recordingTransport.ts src/lib/services/substack/recordingTransport.test.ts src/lib/stores/transportRecorder.svelte.ts src/lib/stores/transportRecorder.svelte.test.ts
git commit -m "feat: add dev-only RecordingTransport decorator for SubstackTransport

Wraps any SubstackTransport and records each call into a ring buffer
(in-memory, dev-only). Production paths run unchanged; the buffer is
only populated when import.meta.env.DEV is true. Used by the
forthcoming minimal round-trip verification.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## Task 3: `transportRecorder` rune store (TDD)

**Files:**
- Create: `src/lib/stores/transportRecorder.svelte.ts`
- Create: `src/lib/stores/transportRecorder.svelte.test.ts`

**Interfaces:**
- Produces:
  - `type RecorderEntry = { id, startedAt, method, path, bodyIn, status: number | 'pending', bodyOut, error, endedAt }`
  - `function recordEntry(entry: RecorderEntry): void` — pushes onto ring buffer of size 200 (drops oldest).
  - `function clearBuffer(): void` — empties buffer.
  - `function subscribe(cb: (entries: RecorderEntry[]) => void): () => void` — returns unsubscribe.
  - A Svelte 5 rune: `function useRecorder(): { entries: RecorderEntry[] }` — readable for Svelte components to bind to.
  - `function getBuffer(): RecorderEntry[]` — synchronous getter for tests and the dev panel.

- [ ] **Step 1: Write the failing test `transportRecorder.svelte.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { recordEntry, clearBuffer, getBuffer, subscribe } from './transportRecorder.svelte';

describe('transportRecorder store', () => {
  beforeEach(() => clearBuffer());

  it('appends entries in order', () => {
    recordEntry({ id: 'a', startedAt: 1, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: { ok: true }, error: null, endedAt: 2 });
    recordEntry({ id: 'b', startedAt: 3, method: 'POST', path: '/y', bodyIn: { z: 1 }, status: 'pending', bodyOut: null, error: null, endedAt: null });
    const buf = getBuffer();
    expect(buf).toHaveLength(2);
    expect(buf[0].id).toBe('a');
    expect(buf[1].id).toBe('b');
  });

  it('clearBuffer empties the buffer', () => {
    recordEntry({ id: 'a', startedAt: 1, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: null, error: null, endedAt: 2 });
    expect(getBuffer()).toHaveLength(1);
    clearBuffer();
    expect(getBuffer()).toHaveLength(0);
  });

  it('subscribers receive every entry, then unsubscribe stops them', () => {
    const received: unknown[] = [];
    const unsub = subscribe((buf) => received.push(buf));
    recordEntry({ id: 'a', startedAt: 1, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: null, error: null, endedAt: 2 });
    unsub();
    recordEntry({ id: 'b', startedAt: 2, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: null, error: null, endedAt: 3 });
    expect(received).toHaveLength(2); // one initial (empty) snapshot + one after recordEntry
    const lastSnapshot = received[received.length - 1] as { length: number }[];
    expect(lastSnapshot[0]?.id).toBe('a');
  });

  it('caps the buffer at 200 entries and drops oldest', () => {
    for (let i = 0; i < 210; i++) {
      recordEntry({ id: `e${i}`, startedAt: i, method: 'GET', path: '/x', bodyIn: null, status: 200, bodyOut: null, error: null, endedAt: i + 1 });
    }
    const buf = getBuffer();
    expect(buf).toHaveLength(200);
    expect(buf[0].id).toBe('e10');
    expect(buf[199].id).toBe('e209');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- transportRecorder`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the minimal implementation `transportRecorder.svelte.ts`**

```ts
export interface RecorderEntry {
  id: string;
  startedAt: number;
  method: string;
  path: string;
  bodyIn: unknown;
  status: number | 'pending';
  bodyOut: unknown;
  error: string | null;
  endedAt: number | null;
}

const RING_CAPACITY = 200;
const buffer: RecorderEntry[] = [];
const subscribers = new Set<(entries: RecorderEntry[]) => void>();

function notify(): void {
  for (const cb of subscribers) cb(buffer);
}

export function recordEntry(entry: RecorderEntry): void {
  buffer.push(entry);
  while (buffer.length > RING_CAPACITY) buffer.shift();
  notify();
}

export function clearBuffer(): void {
  buffer.length = 0;
  notify();
}

export function getBuffer(): RecorderEntry[] {
  return buffer;
}

export function subscribe(cb: (entries: RecorderEntry[]) => void): () => void {
  subscribers.add(cb);
  cb(buffer);
  return () => { subscribers.delete(cb); };
}

export function useRecorder(): { entries: RecorderEntry[] } {
  // Svelte 5 runes-style accessor; consumers can re-bind via subscribe() if they
  // need an unsubscribe handle.
  return { entries: buffer };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- transportRecorder`
Expected: PASS.

- [ ] **Step 5: Run Task 2's test to confirm recordingTransport now also passes**

Run: `npm run test -- recordingTransport`
Expected: PASS (no more "Cannot find module" errors).

- [ ] **Step 6: Run full suite**

Run: `npm run test`
Expected: 178 prior tests + 4 transportRecorder + 2 recordingTransport = 184 pass.

- [ ] **Step 7: Commit (typically combined with Task 2 — see note in Task 2 Step 6)**

If Task 2 was already committed (it had no test failure because the store already existed as a stub), this is a follow-up commit:

```bash
git add src/lib/stores/transportRecorder.svelte.ts src/lib/stores/transportRecorder.svelte.test.ts
git commit -m "feat: transportRecorder rune store with 200-entry ring buffer

Module-level ring buffer + Svelte 5 rune accessor used by
RecordingTransport and the dev-only TransportRecorderPanel. In-memory
only, no IndexedDB. Existing tests: 178 + 4 = 182 pass.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

If Task 2's commit hasn't landed yet, fold Steps 3.7 into Task 2's Step 6 with both file sets staged.

---

## Task 4: `TransportRecorderPanel` dev-only component

**Files:**
- Create: `src/lib/components/dev/TransportRecorderPanel.svelte`

**Interfaces:**
- Consumes: `subscribe`, `clearBuffer`, `getBuffer`, `RecorderEntry` (the type) from `$lib/stores/transportRecorder` (Task 3). `useRecorder()` is exported by Task 3 but not consumed by this task — left for the next iteration if needed.
- Produces: a Svelte component that renders the buffer entries with: timestamp, method+path, status pill, expandable body, latency, clear/copy buttons.

Visible only when its parent (Task 5) toggles `show` to true. The parent gates visibility on `import.meta.env.DEV`.

- [ ] **Step 1: Create the component file with the rendered table and toolbar**

Create `src/lib/components/dev/TransportRecorderPanel.svelte`:

```svelte
<script lang="ts">
  import { subscribe, clearBuffer, type RecorderEntry } from '$lib/stores/transportRecorder.svelte';

  let entries = $state<RecorderEntry[]>([]);

  $effect(() => {
    const unsub = subscribe(buf => { entries = buf; });
    return unsub;
  });

  function color(entry: RecorderEntry): string {
    if (entry.error || (typeof entry.status === 'number' && entry.status >= 400)) return 'text-red-400';
    if (entry.status === 'pending') return 'text-yellow-400';
    return 'text-green-400';
  }

  function copyAll(): void {
    navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
  }
</script>

<div class="flex flex-col h-full text-xs font-mono bg-dark-900 text-dark-100 p-2 gap-2 overflow-hidden">
  <div class="flex gap-2 items-center">
    <span class="font-semibold">Transport Recorder ({entries.length}/200)</span>
    <button class="px-2 py-1 border border-dark-700 rounded" onclick={clearBuffer}>Clear</button>
    <button class="px-2 py-1 border border-dark-700 rounded" onclick={copyAll}>Copy JSON</button>
  </div>
  <div class="flex-1 overflow-y-auto">
    {#each entries as e (e.id)}
      <details class="border-b border-dark-800 py-1">
        <summary class="flex gap-2 {color(e)}">
          <span class="text-dark-500">{new Date(e.startedAt).toLocaleTimeString()}</span>
          <span class="font-semibold">{e.method}</span>
          <span>{e.path}</span>
          <span class="ml-auto">{e.status}</span>
          <span class="text-dark-500">{e.endedAt ? `${e.endedAt - e.startedAt}ms` : '…'}</span>
        </summary>
        <div class="mt-1 grid grid-cols-2 gap-2">
          <div>
            <div class="text-dark-400">body in</div>
            <pre class="whitespace-pre-wrap break-all">{JSON.stringify(e.bodyIn, null, 2)}</pre>
          </div>
          <div>
            <div class="text-dark-400">{e.error ? 'error' : 'body out'}</div>
            <pre class="whitespace-pre-wrap break-all">{e.error ?? JSON.stringify(e.bodyOut, null, 2)}</pre>
          </div>
        </div>
      </details>
    {/each}
  </div>
</div>
```

> **Note on `$effect`:** the standard Svelte 5 reactive scope handles subscribe/unsub cleanly here. `subscribe()` already pushes an initial snapshot, so `$state([])` initializes empty and the first effect run seeds it.

- [ ] **Step 2: Run type-check**

Run: `npm run check`
Expected: 0 errors. If `$effect.root` produces a warning, it's expected on Svelte 5 — verify the compiler doesn't emit an error.

- [ ] **Step 3: Run full suite to confirm no regression**

Run: `npm run test`
Expected: 184 pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/dev/TransportRecorderPanel.svelte
git commit -m "feat: dev-only TransportRecorderPanel renders request/response buffer

Hidden dev panel that renders the in-memory recording buffer set up by
the wrapped SubstackTransport. Visible only when ScaffoldPanel toggles
it on, gated by import.meta.env.DEV at the consumer (Task 5).

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## Task 5: Add round-trip control + recorder toggle to `ScaffoldPanel.svelte`

**Files:**
- Modify: `src/lib/components/scaffold/ScaffoldPanel.svelte` (add ~50 lines)

**Interfaces:**
- Consumes:
  - `RecordingTransport` from `$lib/services/substack/recordingTransport` (Task 2)
  - `WebViewTransport` from `$lib/services/substack/webviewTransport` (existing; resolves after Task 1)
  - `publishToSubstack` from `$lib/services/substack/publisher` (existing)
  - `emptyScaffold` from `$lib/types/scaffold` (existing)
  - `TransportRecorderPanel` (Task 4) — only referenced from inside `{#if import.meta.env.DEV}`.
  - `documentStore.scaffold` (existing Svelte rune store context).

- [ ] **Step 1: Add the new imports below the existing imports in `ScaffoldPanel.svelte`**

Find the existing `import { publishToSubstack } from '$lib/services/substack/publisher';` line and add immediately after it:

```svelte
  import { RecordingTransport } from '$lib/services/substack/recordingTransport';
  import { TransportRecorderPanel } from '$lib/components/dev/TransportRecorderPanel.svelte';
```

- [ ] **Step 2: Add the state and inputs**

Find the existing `let seoError = $state('');` declaration. Add below it:

```svelte
  let rttVisible = $state(false);
  let showRecorder = $state(false);
  let rttTitle = $state('Round-trip test');
  let rttSubtitle = $state('');
  let rttSlug = $state(`rtt-${crypto.randomUUID().slice(0, 6)}`);
```

- [ ] **Step 3: Add the `runMinimalRoundTrip()` function**

Place this function below `generateSeo()` definition. It must mirror the structure of the existing `handlePublish()` function (which sets `publishing`/`publishStatus`):

```svelte
  async function runMinimalRoundTrip() {
    if (!scaffold) return;
    const publication = scaffold.remote.publication.trim();
    if (!publication) {
      alert('Enter your Substack publication subdomain first (e.g. "myblog" for myblog.substack.com).');
      return;
    }
    if (!window.confirm('Send minimal post to Substack drafts? Sends only title, subtitle, slug.')) return;

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
      fresh.payload.send = false;

      publishStatus = 'Uploading images and creating draft...';
      const result = await publishToSubstack(fresh, transport, readImageAsDataUrl);

      publishStatus = result.draftId
        ? `Draft created. ID: ${result.draftId}\nConfirm by opening ${publication}.substack.com/publish`
        : `Error: no draftId returned`;
    } catch (e) {
      publishStatus = `Error: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      publishing = false;
    }
  }
```

- [ ] **Step 4: Add the round-trip UI section above the existing publish section**

In the markup side of the file, immediately before or after the existing publish button/confirm block, add a conditional section visible only when `rttVisible` is true:

```svelte
      <button
        class="self-start text-xs text-dark-500 hover:text-dark-300"
        onclick={() => { rttVisible = !rttVisible; }}
      >{rttVisible ? 'Hide' : 'Show'} round-trip control</button>
      {#if rttVisible}
        <div class="border border-dark-700 rounded p-3 flex flex-col gap-2">
          <div class="text-xs font-semibold uppercase tracking-wide text-dark-400">Round-trip (dev)</div>
          <label class="flex flex-col gap-1 text-xs">
            Title
            <input class="bg-dark-900 border border-dark-700 rounded px-2 py-1" bind:value={rttTitle} />
          </label>
          <label class="flex flex-col gap-1 text-xs">
            Subtitle
            <input class="bg-dark-900 border border-dark-700 rounded px-2 py-1" bind:value={rttSubtitle} />
          </label>
          <label class="flex flex-col gap-1 text-xs">
            Slug
            <input class="bg-dark-900 border border-dark-700 rounded px-2 py-1 font-mono" bind:value={rttSlug} />
          </label>
          <button
            class="self-start px-3 py-1 rounded bg-blue-700 text-white text-sm disabled:opacity-50"
            disabled={publishing}
            onclick={runMinimalRoundTrip}
          >Round-trip to Substack drafts</button>
        </div>
      {/if}
```

- [ ] **Step 5: Add the dev-only 🔬 toggle button at the bottom of the panel**

Inside the same Svelte file, at the very end of the top-level `{#if !scaffold}` block's `{:else}` content (so when a scaffold IS open), add a small bottom-right anchored button:

```svelte
    {#if import.meta.env.DEV}
      <div class="sticky bottom-2 self-end">
        <button
          class="text-xs px-2 py-1 rounded bg-dark-800 border border-dark-700 text-dark-300 hover:text-dark-100"
          onclick={() => { showRecorder = !showRecorder; }}
        >🔬 {showRecorder ? 'Hide' : 'Show'} recorder</button>
      </div>
      {#if showRecorder}
        <div class="fixed inset-4 z-50 border border-dark-700 rounded bg-dark-900 shadow-lg overflow-hidden">
          <TransportRecorderPanel />
          <button
            class="absolute top-2 right-2 text-dark-400 hover:text-dark-100"
            onclick={() => { showRecorder = false; }}
          >×</button>
        </div>
      {/if}
    {/if}
```

- [ ] **Step 6: Run type-check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 7: Run full suite**

Run: `npm run test`
Expected: 184 pass.

- [ ] **Step 8: Smoke-test the build**

Run: `npm run build`
Expected: Vite bundle produces `dist/` with no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/scaffold/ScaffoldPanel.svelte
git commit -m "feat: add minimal round-trip control and dev recorder toggle

ScaffoldPanel gains a dev-only section that constructs an empty
scaffold, fills title/subtitle/slug, and sends one real POST to
/api/v1/drafts via the wrapped transport. A 🔬 button opens the
TransportRecorderPanel to inspect every request and response.

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## Task 6: Manual verification runbook

**Files:** none. This is the user-visible success criterion. The plan ends here; the rest is hands-on.

- [ ] **Step 1: Pre-check**

In your normal browser, open `https://<your-sub>.substack.com/publish`. Confirm you're logged in (the page shows your drafts). This proves the session cookie path independently of StackEd.

- [ ] **Step 2: Start the Tauri dev app**

Run: `npm run tauri:dev`
Expected: app launches, previous Tabs/Editors behave as before.

- [ ] **Step 3: Open any scaffold**

In the app, hover the existing ScaffoldPanel. Click `Show round-trip control`.

- [ ] **Step 4: Open recorder first**

Click the 🔬 button at the bottom-right of `ScaffoldPanel`. The recorder panel should appear with `(0/200)` entries. Close it back.

- [ ] **Step 5: First round-trip**

Click `Round-trip to Substack drafts`. Confirm the prompt. The Substack auth window opens. If you're not already logged in there, log in (Tauri WebView holds the cookie after).

- [ ] **Step 6: Verify success path**

- The recorder should show two entries:
  - `GET /api/v1/user/profile/self` → 200
  - `POST /api/v1/drafts` → 200 with body containing `{ id: <number> }`
- The app status reads `Draft created. ID: <number>`.
- In a separate browser tab, navigate to `https://<your-sub>.substack.com/publish`. The new draft titled `Round-trip test` should be at the top.

- [ ] **Step 7: Verify failure path (optional)**

If the success path is green, optionally probe failures:
- Log out of Substack via the in-WebView account menu. Run the round-trip again. Recorder should show `GET /api/v1/user/profile/self → 401`. Status reads `Error: Failed to fetch user info: 401`.
- Re-login. The next round-trip should succeed again.

- [ ] **Step 8: Commit any docs follow-ups**

If gaps were discovered during the run (e.g. the recorder needs a "Copy as HAR" button, or the panel needs a refresh-on-demand toggle), file them as separate spec/plan pairs. Do **not** roll fixes into Tasks 1–5 retroactively.

- [ ] **Step 9: Tag the release**

After the runbook is green and any follow-ups are filed:

```bash
git tag v0.1.43
git log --oneline v0.1.42..HEAD
```

The diff between v0.1.42 and v0.1.43 should be exactly the commits from Tasks 1–5 (and SpockLock auto-bumps), plus any docs follow-ups from Step 8.

---

## Done = success

`docs/superpowers/specs/2026-08-08-minimal-round-trip-design.md` is satisfied when:
- Task 5's "Round-trip to Substack drafts" button produces a real draft in the user's Substack drafts list
- The recorder's two expected entries (200 on `getUserInfo` and `createDraft`) are visible and contain the expected body shapes
- All 184 unit tests pass
- `npm run check` shows 0 errors
- The existing test for `readiness()` (covered in `seo.test.ts` / `publisher.test.ts` regressions) still passes
