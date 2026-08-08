# Body Round-Trip — Design

## Problem

Phase 1 of the scaffold-to-Substack round-trip pipeline landed in v0.1.50
(`fix(recorder): dedupe buffer entries, record real status, dev-gate
round-trip`): the metadata round-trip works end-to-end. Title, subtitle,
slug, byline, and the publish-or-schedule decision all round-trip
correctly through the private `/api/v1/*` endpoints plus the dev-only
transport recorder.

But the **body** has not been verified. The current minimal round-trip
preset sends `draft_body` as `JSON.stringify({ type:'doc', content: [] })`
— an empty document. We have no evidence that:

- Stringified ProseMirror JSON survives the round trip without distortion.
- Substack's save path is round-trip-stable (i.e., `GET
  /api/v1/drafts/{id}` returns the same `draft_body` we sent).
- The legal-node set in `src/lib/editor/schema.ts` (paragraphs, headings
  2–4, blockquote, marks, captures, images, callouts, recipes, polls,
  embeds, etc.) maps cleanly to Substack's accepted subset.

Without a body round-trip verified against real Substack, the rest of
the pipeline is flying on metadata only. Every subsequent sub-phase of
Phase 2 (body → images → tags → scheduling) depends on this foundation.

## Goal

Add a **body round-trip preset** that builds a known multi-section body
in code, ships it through the existing publisher pipeline as
`payload.draft_body`, fetches the freshly-created draft back from
Substack, and surfaces a shape-comparison verdict in
`ScaffoldPanel.publishStatus`.

A "body round-trip" is defined as: a scaffold with `draft_title`,
`draft_subtitle`, `slug`, *and* a populated `draft_body` containing
**multiple paragraphs + one H2 heading + one blockquote** (the chosen
step-1 scope from the brainstormed conversation). `getUserInfo`
auto-assigns the byline; no images, no tags, no scheduling, no email
send. Retry/fetch-back is automatic on the same trigger; the user
clicks one button.

Result is a real draft appearing in the user's Substack drafts list
whose body, when rendered, shows the same paragraphs, heading, and
blockquote that we sent.

## Decisions

- **Two sections, two buttons in ScaffoldPanel.** Phase 1's minimal
  section stays untouched. A new "Body round-trip" section sits beside
  it, separated by a divider, with its own preset dropdown and Run
  button. This keeps each preset's surface area independent and
  lets us diagnose failures by section name (`publishStatus` includes
  which section produced it).
- **Body built from scratch in code.** The preset builder lives at
  `src/lib/utils/bodyPresets.ts`. Each call returns a fresh
  `PMDoc`. No dependency on whatever the user happens to be editing
  in `documentStore.body`.
- **Default preset is `multi-section`** (paragraphs + H2 + blockquote).
  Other presets (`minimal-paragraph`, `paragraph-heading`,
  `full-mirror`) live in the same file as alternatives.
- **`full-mirror` is a stub for this sub-project.** Because every
  legal Substack node needs a separate round-trip test cycle (images,
  embeds, recipes, etc.), pushing a single "all-nodes" round-trip
  would defeat the minimal-first principle. The stub returns the
  `multi-section` shape and is flagged as the natural target of
  future sub-projects (Phase 2 images in particular).
- **Fetch-back is automatic, not manual.** After `publishToSubstack`
  successfully returns a `draftId`, immediately call
  `transport.getDraft(draftId)`. The fetch-back result lands in the
  recorder as a third entry, and the diff verdict surfaces in
  `publishStatus`.
- **Diff verdict is a text summary, not a visual diff panel.** A
  count "matched (12/12)" or "11/12 matched, 1 differs — <path>:
  '<a>' vs '<b>'" is enough for the first body round-trip. A side-by-
  side visual diff panel is a future iteration if the text summary
  proves insufficient.
- **No auto-correction of differences.** If the fetched body differs
  from the sent body, we report it; we don't silently re-send the
  modified body.

## Design

### 1. Body preset builder — new file `bodyPresets.ts`

Lives at `src/lib/utils/bodyPresets.ts`.

Pure-function module. Exports:

```ts
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

export function buildBodyFromPreset(preset: BodyPreset): PMDoc;
```

Each preset returns a fresh `PMDoc`. Mutating the returned doc never
affects subsequent calls. Implementation:

- `minimal-paragraph`:
  `{ type:'doc', content:[
      {type:'paragraph', content:[{type:'text', text:'Body round-trip test.'}]}
  ]}` — 1 paragraph, 1 leaf.

- `paragraph-heading`:
  `{ type:'doc', content:[
      {type:'paragraph', content:[{type:'text', text:'Body round-trip test — paragraph 1.'}]},
      {type:'heading', attrs:{level:2}, content:[{type:'text', text:'Section heading'}]}
  ]}` — 1 paragraph + 1 H2.

- `multi-section` (default):
  `{ type:'doc', content:[
      {type:'paragraph', content:[{type:'text', text:'Body round-trip test — paragraph 1.'}]},
      {type:'paragraph', content:[{type:'text', text:'Body round-trip test — paragraph 2.'}]},
      {type:'heading', attrs:{level:2}, content:[{type:'text', text:'Section heading'}]},
      {type:'blockquote', content:[
          {type:'paragraph', content:[{type:'text', text:'A quoted passage for testing blockquotes.'}]}
      ]}
  ]}` — 2 paragraphs + 1 H2 + 1 blockquote (containing 1 paragraph).

- `full-mirror` placeholder:
  For this sub-project, returns `multi-section` shape. Marked with a
  `// TODO: Phase 3 — replace with comprehensive legal-node mirror`,
  but the function still works. Future iterations expand it.

Throws on unknown preset name with a descriptive `Error` (the caller
in `runBodyRoundTrip` catches and surfaces it).

### 2. `getDraft` on the transport — interface + impl

`src/lib/services/substack/transport.ts` gains one method:

```ts
/** GET /api/v1/drafts/{id} — fetch an existing draft back from Substack. */
getDraft(draftId: number): Promise<SubstackResponse>;
```

`src/lib/services/substack/webviewTransport.ts` gains the impl:

```ts
async getDraft(draftId: number): Promise<SubstackResponse> {
  return this.send('GET', `/api/v1/drafts/${draftId}`);
}
```

Non-200 responses resolve as `{ ok: false, status, body }` (existing
pattern, matches every other method). Network/timeout rejects with a
typed `Error` containing the request line.

### 3. `getDraft` wrapper in `recordingTransport.ts`

Same wrap pattern as the existing 12 methods:

```ts
getDraft(draftId: number): Promise<SubstackResponse> {
  return this.wrap('GET', `/api/v1/drafts/${draftId}`, undefined, () => this.inner.getDraft(draftId));
}
```

The buffer entry records `method:'GET'`, `path:'/api/v1/drafts/<id>'`,
`bodyIn: undefined`, `bodyOut: <response.body>`, `status: <response.status>`
(non-throwing) or `status: 0, error: <message>` (throwing). All
matching the dev-only gating from Phase 1.

### 4. `diffBodies` helper — pure, no I/O

Lives at `src/lib/components/scaffold/ScaffoldPanel.svelte` as a
top-level function. (It's small enough to live inside the Svelte
file. If it grows past ~30 lines we move it to a utility module in a
subsequent iteration.)

Returns:

```ts
{
  matched: number;
  differing: Array<{ path: string; a: unknown; b: unknown }>;
}
```

Walks both `PMDoc` trees in parallel using the path-based indexing
that `findForeignImages` already uses (see
`payloadBuilder.ts:findForeignImages`). At each comparable node pair
(structural shape), increments `matched` when deep-equal, or pushes
to `differing` with the dot-path string. Truncate `differing` to the
first 5 entries; the rest are counted and reported as `+N more`.

### 5. ScaffoldPanel additions — three edits in one file

`src/lib/components/scaffold/ScaffoldPanel.svelte`:

1. **New imports** below `import { RecordingTransport } from '$lib/services/substack/recordingTransport';`:
   ```ts
   import { BUILT_IN_BODY_PRESETS, type BodyPreset, buildBodyFromPreset } from '$lib/utils/bodyPresets';
   ```

2. **New state** below the existing `let rttSlug = $state(...)`:
   ```ts
   let bodyPreset = $state<BodyPreset>('multi-section');
   let bodyRttVisible = $state(false);
   ```

3. **New `runBodyRoundTrip()` function** below `runMinimalRoundTrip()`.
   Mirrors the structure: publication-subdomain check, `window.confirm`,
   `publishing`/`publishStatus` lifecycle, try/catch, finally reset.
   Body-specific additions:
   - `fresh.payload.draft_body = buildBodyFromPreset(bodyPreset);`
   - After `publishToSubstack` returns with a `draftId`, call
     `await transport.getDraft(result.draftId)`.
   - Pass the sent body and the fetched `draft_body` to
     `diffBodies(...)`.
   - On full match: `"Body round-trip: matched (all <N> nodes equal).
     Draft ID: <id>\nConfirm by opening ${publication}.substack.com/publish"`.
     The `<N>` is whatever node count `diffBodies` actually counted
     against the multi-section preset; today that's roughly 9
     comparable nodes (4 top-level + their text/blockquote children).
     The text format is "all <N> nodes equal" to never imply a fixed
     total that drifts if the preset changes.
   - On partial match: `"Body round-trip: <matched>/<total> matched,
     <N> differs — <path>: <a> vs <b>\nDraft ID: <id>\nConfirm by..."`
     (one line per differing field, capped at 5).
   - On fetch-back failure: `"Body round-trip: draft created (ID:
     <id>), but fetch-back failed: <message>\nOpen the recorder (🔬)
     to inspect the round-trip."`
   - On round-trip failure (publisher threw): same `Error: ${e.message}`
     path as Phase 1.

4. **New section markup** — a divider-then-section after the Phase 1
   "Round-trip" section, before the existing "Substack publishing"
   block. Wrapped in `{#if bodyRttVisible}` for toggling. Inside:
   - Header: "Body round-trip (Phase 2 · step 1)"
   - `bind:value` dropdown for `bodyPreset`, options sourced from
     `BUILT_IN_BODY_PRESETS`.
   - A small subtitle/description text saying which preset
     corresponds to which shape.
   - "Run Body Round-Trip" button mirroring Phase 1's button styling.
   - A subtle "// TODO: replace `full-mirror` with comprehensive
     legal-node mirror in Phase 3" hint near the full-mirror option
     so future-you knows why it's stubbed.

### 6. Tests

New: `src/lib/utils/bodyPresets.test.ts`:

- `multi-section` has 4 top-level nodes (paragraph, paragraph, heading,
  blockquote) in that order.
- Each paragraph's text matches the expected message verbatim.
- The H2 has `attrs.level === 2`.
- The blockquote's first child is a paragraph.
- Calling `buildBodyFromPreset('multi-section')` twice returns two
  structurally-equal but **distinct** `PMDoc` instances (no shared
  reference).
- Unknown preset name throws an `Error`.
- `full-mirror` placeholder returns `multi-section` shape for now.

Modify: `src/lib/services/substack/recordingTransport.test.ts` — add 2 tests:

- `delegates getDraft with the id-interpolated path`
- `records non-throwing SubstackResponse status on a getDraft that
  returns 404`

Existing tests stay untouched and form the regression net.

## Out of scope

- **`full-mirror` body preset as a comprehensive legal-node mirror.**
  Sub-project 1 in Phase 2 (this design) covers paragraphs + H2 +
  blockquote. Future sub-projects fill the rest of the legal-node set
  in their own round-trip cycles: images (Phase 2 sub-project #2),
  embeds, recipes, polls, footnotes, calls, etc.
- **Visual diff panel** for the fetch-back verdict. The text summary
  in `publishStatus` is sufficient for step 1; add a real diff panel
  only if practical experience shows it's needed.
- **Auto-correction of differences.** If `diffBodies` reports a
  difference (e.g., normalized whitespace), we don't silently re-send
  the sent body. The user decides.
- **Multi-publication / multi-subdomain fetch-back.** The fetch-back
  uses the same publication as the round-trip; cross-publication
  diffs are not exercised in this sub-project.
- **Composer polish (`RecordingTransport` cross-method coverage for
  `getDraft`).** The two added tests (delegation + non-throwing
  status) are enough; full coverage comes from the live round-trip
  recorder entry.

## Manual verification (the signal this iteration succeeded)

1. Open `https://<your-sub>.substack.com/publish` in your normal
   browser, confirm logged in (cookie path independent of StackEd).
2. Run `npm run tauri:dev`. App launches; ScaffoldPanel visible.
3. In ScaffoldPanel, click "Show body round-trip". The new section
   appears with preset dropdown defaulting to `multi-section`.
4. Click the 🔬 button to open the recorder overlay; buffer at
   `(0/200)`.
5. Click "Run Body Round-Trip". Confirm the prompt. The Substack
   auth window opens if not already; log in if needed.
6. **Verify success path:**
   - Recorder shows **3 entries**:
     - `GET /api/v1/user/profile/self → 200`
     - `POST /api/v1/drafts → 200` (body in shows the multi-section
       PMDoc stringified)
     - `GET /api/v1/drafts/<id> → 200` (body out shows Substack's
       stored PMDoc)
   - `publishStatus` reads "Body round-trip: matched (all <N> nodes
     equal). Draft ID: <id>\nConfirm by opening
     <sub>.substack.com/publish".
   - Open `<sub>.substack.com/publish` in a regular browser. The
     new draft appears in your drafts list. Open it in Substack's
     editor:
     - Two paragraphs of body text appear (the "Body round-trip
       test — paragraph 1/2" lines).
     - An H2 reads "Section heading".
     - A blockquote contains one paragraph with the quoted passage.
7. **Cleanup** — delete the `rtt-` drafts from the drafts list.

The design is considered verified only when step 6 succeeds AND the
user visually confirms the rendered body in Substack. Unit tests
passing is required but not sufficient.
