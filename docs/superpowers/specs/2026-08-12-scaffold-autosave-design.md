# Debounced Scaffold Autosave — Design

## Problem

`documentStore` holds the active scaffold entirely in memory
(`$state<TabState[]>`) until the user explicitly saves. Nothing writes
to disk in between. The app's own unsaved-changes guard
(`onCloseRequested` in `App.svelte`) only fires on a real window close
— it never runs when the in-memory state is reset some other way.

This surfaced concretely during manual verification of the body
round-trip: the Vite dev server's dependency re-optimization triggers
a full page reload of the Tauri webview (`✨ optimized dependencies
changed. reloading`), which re-mounts the whole Svelte app from
scratch. That wipes `documentStore` without ever consulting the
close-confirmation flow. A crash or force-quit in a production build
would have the identical effect, even though the specific reload
trigger is dev-only.

The round-trip flow itself was not the cause — `runBodyRoundTrip` and
`runMinimalRoundTrip` build a disposable `emptyScaffold('post')`
fixture that is never connected to `documentStore`, so persisting it
would not have protected the document the user actually had open.

## Goal

Once a scaffold document has been saved at least once (has a real
file path), further edits should be written back to that same file a
few seconds after the user stops editing — with no new file format,
no change to what "Save" or "Save As" mean, and no user-visible
behavior when everything is working. At most a handful of seconds of
work should ever be at risk from an unexpected reload, crash, or
force-quit.

## Decisions

- **Only documents that already have a file path.** A brand-new,
  never-saved ("untitled") tab has nowhere to autosave to; assigning
  it an automatic location adds complexity and scatters files the
  user didn't choose to create. That gap is accepted, not fixed,
  here — a manual first `Cmd+S` remains required, exactly as today.
- **Debounced, not interval-based.** A timer resets on every edit and
  fires 4 seconds after the last one, only while the document is
  dirty. A steady stream of edits never triggers repeated disk
  writes; a pause in editing is what triggers the save.
- **Overwrites the real file in place.** Autosave calls the exact
  same underlying write path (`saveScaffoldPath`) that manual `Save`
  already uses. There is no separate recovery-slot file and no new
  serialization format to keep in sync.
- **Silent on success.** A successful autosave only clears the dirty
  flag; there is no toast, status-bar flash, or other visible
  indicator. Manual `Save`/`Save As` behavior and their existing
  feedback are untouched.
- **Silent-but-durable on failure.** A failed autosave write logs to
  the console and leaves the document dirty. It does not show an
  `alert()` — a background timer should never pop a blocking modal.
  Because the document stays dirty, the next debounce cycle retries,
  and the existing close-time "unsaved changes" prompt still protects
  the user if they try to quit with a persistently failing autosave.
- **Scoped to the active tab.** The autosave timer only watches the
  currently active tab's `dirty`/`filePath`/edit state. If the user
  edits a background tab and switches away inside the 4-second
  window before the timer fires, that specific edit is not
  autosaved until the tab is revisited and goes quiet again. This is
  the same class of risk that exists today (no worse), and is not
  addressed by this design.

## Design

### 1. `editTick` counter on `DocumentStore`

`src/lib/stores/document.svelte.ts` gains a private `$state<number>`
counter, exposed as a read-only getter:

```ts
private _editTick = $state(0);

get editTick(): number {
  return this._editTick;
}
```

Every existing mutator that currently sets `tab.dirty = true` also
increments it: `setBody`, `patchPayload`, `patchWorkshop`,
`toggleLocked`, `replaceScaffold`. This gives one reactive signal that
changes on every edit regardless of which field changed — including
edits like `ScaffoldPanel`'s publication field, which calls
`replaceScaffold` directly rather than `patchPayload`.

`editTick` is not persisted and not reset on save; it only exists to
drive the debounce timer's re-arming.

### 2. Debounce effect in `App.svelte`

`App.svelte` already owns `handleSave()` and has direct access to
`documentStore`. It gains one `$effect` and one new function:

```ts
const AUTOSAVE_DEBOUNCE_MS = 4000;
let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

$effect(() => {
  // Reading these makes the effect re-run on every edit, dirty
  // transition, and file-path change (including tab switches).
  const dirty = documentStore.dirty;
  const filePath = documentStore.filePath;
  void documentStore.editTick;

  if (autosaveTimer) clearTimeout(autosaveTimer);

  if (dirty && filePath) {
    autosaveTimer = setTimeout(() => {
      void handleAutosave();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  return () => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
  };
});

async function handleAutosave(): Promise<void> {
  if (!documentStore.scaffold || !documentStore.filePath || !documentStore.dirty) return;
  try {
    await saveScaffoldPath(documentStore.filePath, documentStore.scaffold);
    documentStore.markClean();
  } catch (e) {
    console.error('Autosave failed:', e);
  }
}
```

Because the effect clears and re-arms the timer on every dependency
change, this is a true debounce: only a 4-second quiet period with the
document still dirty and path-backed triggers a write. Switching to a
tab with no path, or to a clean tab, clears any pending timer via the
same effect re-run (reading `dirty`/`filePath` for the new active tab).

No changes to `handleSave`, `handleSaveAs`, `saveScaffoldPath`, or any
existing UI. `handleAutosave` deliberately never calls `handleSaveAs`
— per the scope decision above, a path-less document is simply never
armed.

## Out of scope

- **Never-saved ("untitled") documents.** No automatic path
  assignment, no prompt-to-save-on-first-edit. Accepted gap.
- **Cross-tab / background-tab autosave.** Only the active tab is
  watched; see the scoped decision above.
- **User-facing settings.** No toggle to disable autosave, no
  configurable debounce interval. If this proves too aggressive or
  too passive in practice, that's a follow-up iteration.
- **Visible save indicator.** No "Autosaved" flash or status-bar
  text; success is silent by design.
- **A separate recovery-slot file format.** Explicitly rejected in
  favor of reusing the existing save path in place.

## Testing

Unit tests on `DocumentStore` (`document.test.ts`):
- Each of `setBody`, `patchPayload`, `patchWorkshop`, `toggleLocked`,
  `replaceScaffold` increments `editTick` by exactly 1 per call.
- `editTick` starts at 0 on a fresh store / after `reset()`.

Manual verification (the `$effect` timer behavior is awkward to unit
test in isolation given Svelte 5's effect scheduling, so this is
confirmed by hand):
1. Open an existing `.stacked.json` file (already has a path).
2. Edit the title. Wait 4+ seconds without further edits.
3. Confirm via `cat` on the file (or reload the app) that the edit
   landed on disk and the in-app dirty indicator cleared.
4. Edit again, and edit a second time within 4 seconds of the first.
   Confirm (e.g. via a temporary console log, removed before commit)
   that only one write occurs, not two.
5. Create a **new, unsaved** tab, edit it, wait 4+ seconds. Confirm
   nothing is written to disk (no path yet) and no error is thrown.
6. Simulate a write failure (e.g. temporarily point `filePath` at a
   non-writable location) and confirm: no `alert()` fires, the
   console logs the error, and the document remains dirty.
