# Minimal Round-Trip Verification — Design

## Problem

StackEd 2.0's scaffold-first data model, payload builders, publisher, and
Tauri-WebView transport are fully wired (`e4953b2` and later). Tests pass —
178 unit + 27 Rust. v0.1.42 deploys the publish flow's UI surface in
`ScaffoldPanel.svelte`, including a `handlePublish()` button that opens the
`substack-auth` WebView, calls `publishToSubstack()`, and reports a result.

The end-to-end happy path has never been exercised against a real Substack
session. The likely cause is one specific bug: `webviewTransport.ts`
references `window.__TAURI__.event` from inside the injected listener
script, but `withGlobalTauri: true` is **not** set in
`src-tauri/tauri.conf.json`. In Tauri 2, that flag is off by default, so
`window.__TAURI__` is undefined inside the WebView and the script crashes
before any fetch. Every subsequent round-trip would fail at the listener.
There's no second-tier diagnostic surface either — failures surface only as
a generic `Error: …` string in `publishStatus`, with no visibility into the
generated request or response.

## Goal

Verify the existing scaffold → Substack round-trip works against a real
publication, with the smallest possible code delta, and surface every
network request and response to a dev-only inspection panel.

A "minimal round-trip" is defined as: a scaffold with **only `draft_title`,
`draft_subtitle`, and `slug` populated**, an empty body, no images, no tags,
no scheduling, no email send (so the publisher's natural draft-only path
runs). `getUserInfo()` auto-assigns the byline as today. Result is a real
draft appearing in the user's Substack drafts list.

## Decisions

- **Decorator, not new transport**: introduce `RecordingTransport` as a
  thin wrapper around any `SubstackTransport`. It records but does not
  alter the wrapped instance. Production code paths are identical with or
  without the recorder present.
- **Dev-only by import-site gating**: the recorder is gated to
  `import.meta.env.DEV`. Even if accidentally imported in a production
  build, the file short-circuits at module load. No new env flags, no new
  build configuration knobs.
- **Persist nothing**: the recorder buffer is in-memory only, ring-capped at
  200 entries, drops oldest. Closing the app clears it. No IndexedDB, no
  localStorage write. The minimal round-trip test scaffold uses
  `slug: rtt-<uuid6>` so test drafts are findable and removable from
  Substack's drafts list manually.
- **No retries, no pre-flight**: the goal is to learn what happens. A
 401/403/captcha gets surfaced verbatim through the recorder panel; a
 user decision follows.
- **One config flag, no rebuild of transport plumbing**: the
  `withGlobalTauri` fix is one line in `tauri.conf.json`. No rewrites of
  `webviewTransport.ts`, the injected script, or the IPC mechanism.
- **No body/images/tags/scheduling in this iteration**: those can fail
  independently. The first round-trip tests the WebView plumbing + draft
  endpoint against a real session; subsequent iterations expand scope
  once that path is green.

## Design

### 1. Config change — `src-tauri/tauri.conf.json`

Add one key to the existing top-level `build` object:

```json
"withGlobalTauri": true
```

This makes Tauri 2's global API (`window.__TAURI__`) accessible inside the
`substack-auth` WebView. The existing injected script in
`webviewTransport.ts` (`const { listen, emit } = window.__TAURI__.event;`)
then resolves to a real object instead of crashing. No other `build`-key
changes. Capability permissions file (`src-tauri/capabilities/substack-auth.json`)
is unchanged.

### 2. Recorder transport — new file `recordingTransport.ts`

Lives at `src/lib/services/substack/recordingTransport.ts`.

A `class RecordingTransport implements SubstackTransport` whose
constructor takes one `SubstackTransport`. Every public method:

1. Builds a `RecorderEntry` place-marker: `{ id, startedAt, method,
   path, bodyIn, status: 'pending', bodyOut: null, error: null, endedAt: null }`.
2. Pushes the entry into the buffer *before* awaiting the inner call so
   the dev panel can render rows as they fly by.
3. Awaits `inner.method(...)`.
4. On success: updates the entry with `status: response.status`,
   `bodyOut: response.body`, `endedAt: Date.now()`.
5. On failure: updates with `error: String(e)`, `status: 0`,
   `endedAt: Date.now()`, then re-throws.

The buffer is a module-level singleton (so dev panel and recorder share
state) — `getBuffer()`, `clearBuffer()`, `subscribe(cb)` semantics
matching a tiny event emitter. A ring cap of 200 drops oldest.

Gated: each public method checks `import.meta.env.DEV` before pushing
to the buffer. In a production build the recorder still wraps, still
delegates to `inner`, but produces no entries — call sites stay uniform,
no compile-time edges, no separate identity class. Buffer writes are
zero-cost in production (one boolean check per call).

Methods that wrap: every public method of `SubstackTransport` listed in
`transport.ts` — `uploadImage`, `createDraft`, `updateDraft`,
`publishDraft`, `scheduleDraft`, `unscheduleDraft`, `createNote`,
`listPostTags`, `createPostTag`, `attachTag`, `isLoggedIn`,
`getUserInfo` (twelve total). Each gets a one- or two-line wrapper
plus a buffered `RecorderEntry`.

### 3. Recorder store — new file `transportRecorder.svelte.ts`

Lives at `src/lib/stores/transportRecorder.svelte.ts`. A thin Svelte 5
rune store exposing `entries`, `clear()`, and `subscribe(cb)`. Holds the
ring buffer module-globally so the recorder and the panel share state
without prop-drilling.

### 4. Dev panel UI — new component `TransportRecorderPanel.svelte`

Lives at `src/lib/components/dev/TransportRecorderPanel.svelte`. Hidden
behind a `🔬` button rendered in `ScaffoldPanel.svelte` footer when
`import.meta.env.DEV` is true.

Renders:
- Header: `Show / hide` toggle, `Clear`, `Copy all as JSON`.
- Body: a list of `RecorderEntry` rows. Each row has timestamp (relative
  `xx ms ago` or absolute on hover), method, path, status pill, request
  body preview (expandable), response body preview (expandable),
  latency (`xx ms`).
- Color coding: green for `status < 400`, red for `status >= 400` or
  `error != null`.

### 5. Minimal round-trip control — additions to `ScaffoldPanel.svelte`

Three additions, all small:

1. A small "Round-trip" section near the existing publish UI with three
   inputs (`Title`, `Subtitle`, `Slug` — slug pre-filled with
   `rtt-` + a 6-character random suffix; user can edit before sending).
2. An async `runMinimalRoundTrip()` function that:
   - Builds `const scaffold = emptyScaffold('post')` from
     `$lib/types/scaffold`.
   - Patches `payload.draft_title`, `payload.draft_subtitle`, `payload.slug`
     from the inputs.
   - Reads `scaffold.remote.publication` (already required by the existing
     UI; the existing input is reused, no second field).
   - Confirms with the user via `window.confirm("Send minimal post to
     drafts?")`.
   - Constructs `transport = new RecordingTransport(new
     WebViewTransport(publication))`.
   - Calls the existing `publishToSubstack(scaffold, transport,
     readImageAsDataUrl)` from `$lib/services/substack/publisher`.
   - Sets `publishStatus` on success: `"Draft created. ID: <id>"` plus
     `"Confirm by opening ${publication}.substack.com/publish"`.
   - Sets `publishStatus` on failure: `"Error: <message>"` plus a
     `🔬 Open recorder` shortcut when the buffer has entries.
3. The dev-only `🔬` button bottom-right that toggles the panel.

### 6. Tests

New: `src/lib/services/substack/recordingTransport.test.ts`.
- Wraps a stub `SubstackTransport` that resolves or throws on demand.
- Verifies: delegation (call count, args match), entry ordering, success
entries have `status`/`bodyOut`/`endedAt`, throw entries have `error`/`
status: 0` and re-throw, ring cap drops oldest.

New: `src/lib/stores/transportRecorder.svelte.test.ts`.
- Push entries through `record()`. Verify `subscribe` contract delivers in
order. `clear()` empties. Pure-JS test, no DOM.

Existing tests (`payloadBuilder.test.ts`, `publisher.test.ts`,
`substackClipboard.test.ts`, `seo.test.ts`) stay untouched and form the
regression net.

No browser/E2E test is added in this iteration — the goal *is* the live
end-to-end verification, and the recorder panel plus the user's eyes fill
that role for v0.1.43.

## Out of scope

- **Production hardening of `withGlobalTauri` exposure**. Setting the flag
  exposes Tauri APIs to any script on substack.com. Mitigated today only by
  the existing `substack-auth` capability. A future iteration can replace
  the Tauri-event IPC with `window.addEventListener` (Approach B from the
  brainstorm) so the exposure goes away. Noted, not done here.
- **Multi-subdomain testing**. The existing `currentPublication` tracking
  in `webviewTransport.ts` already handles cross-publication navigation.
  Exercising it is the next iteration's problem.
- **Body shaping / images / tags / scheduling** in the round-trip preset.
  These are all things we deliberately leave empty so first-run failures
  point at the WebView plumbing, not at body serialization or image
  upload.
- **Session-cookie persistence across app sessions**. Today every start
  prompts a fresh Substack login. Fine for verification; flagged for
  "as efficiently as possible" follow-up.
- **Cleanup of test drafts**. The `rtt-` slug makes them trivially
  findable in Substack's drafts list; user removes them by hand.

## Manual verification (the signal that this iteration succeeded)

The success criterion is a live round-trip:

1. User opens a Substack drafts page in their normal browser; verifies
   they are logged in there. Independent of StackEd, proves the cookie
   path.
2. User starts the app with `withGlobalTauri: true` set.
3. User clicks `🔬` to open the recorder panel (buffer is empty), then the
   `Round-trip to Substack drafts` button, confirms the prompt.
4. Substack auth window opens, logs in if not already.
5. On success: a new draft titled `Round-trip test` (or whatever the user
   set) appears at `${publication}.substack.com/p/rtt-xxxxxx` in the user's
   drafts list. Recorder shows two entries: `GET
   /api/v1/user/profile/self → 200`, `POST /api/v1/drafts → 200`.
6. On failure: status reads `Error: <message>`, recorder shows the
   failing request and response so the user can diagnose without leaving
   StackEd.

The design is considered verified only after step 5 succeeds AND the user
visually confirms the draft. "Tests pass" is required but not sufficient.
