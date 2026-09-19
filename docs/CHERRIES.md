# CHERRIES — what StackEd 3.0 removed, and how to get it back

StackEd 3.0 is a fork of StackEd 2.0. Features demoted in the redesign were
**deleted, not hidden**: no feature flags, no dead code behind `if (false)`.

Every removal is recoverable, because this repository contains the complete
StackEd 2.0 git history. The restore point is:

```
9069b4c  docs: note lint/format tooling and hooks in AGENTS.md   ← last 2.0 commit
```

Restore any deleted file verbatim with:

```bash
git checkout 9069b4c -- <path>
```

Then re-wire it: 3.0 has no permanent sidebar, so a restored panel needs a host
(`WriteView.svelte`'s tools drawer, `FinishView.svelte`, or a new space).

Read a deleted file without restoring it:

```bash
git show 9069b4c:<path>
```

---

## 1. Deleted files

### 1.1 Substack transport round-trip harness

Dev-only diagnostics that sent fixture posts to Substack and diffed what came
back. It proved the wire format during 2.0 development; it is not an authoring
feature.

| Path | What it was |
|---|---|
| `src/lib/services/substack/recordingTransport.ts` | Transport decorator that recorded every request/response |
| `src/lib/services/substack/recordingTransport.test.ts` | Its tests |
| `src/lib/stores/transportRecorder.svelte.ts` | In-memory ring buffer of recorded exchanges |
| `src/lib/stores/transportRecorder.svelte.test.ts` | Its tests |
| `src/lib/components/dev/TransportRecorderPanel.svelte` | 🔬 recorder inspector overlay |
| `src/lib/utils/bodyPresets.ts` | Fixture `draft_body` documents (`multi-section`, `full-mirror`, …) |
| `src/lib/utils/bodyPresets.test.ts` | Its tests |

```bash
git checkout 9069b4c -- \
  src/lib/services/substack/recordingTransport.ts \
  src/lib/services/substack/recordingTransport.test.ts \
  src/lib/stores/transportRecorder.svelte.ts \
  src/lib/stores/transportRecorder.svelte.test.ts \
  src/lib/components/dev/TransportRecorderPanel.svelte \
  src/lib/utils/bodyPresets.ts \
  src/lib/utils/bodyPresets.test.ts
```

The UI that drove them lived inside `ScaffoldPanel.svelte` (§1.3): the
`Round-trip (dev)` block, the `body round-trip (Phase 2)` block, and the
`diffBodies` / `runMinimalRoundTrip` / `runBodyRoundTrip` functions. Recover
those from `git show 9069b4c:src/lib/components/scaffold/ScaffoldPanel.svelte`.

**Note:** `webviewTransport.ts` and `transport.ts` were **kept** — they are the
real publishing path, not diagnostics.

### 1.2 base16 theme catalogue and custom theme editor

2.0 shipped 27 base16 colour schemes, a theme browser, a live theme editor and
an IndexedDB store for user-authored themes. In practice the visible app chrome
(`dark-*`, `primary-*`) is hardcoded in `src/app.css`; only the `--cat-*`
variables consumed by `src/lib/themes/catppuccin.css` ever changed. 3.0 keeps
the four Catppuccin flavours, chosen in Settings.

| Path | What it was |
|---|---|
| `src/lib/themes/base16.ts` | 27 schemes + base16→app colour mapping |
| `src/lib/themes/base16.test.ts` | Its tests |
| `src/lib/services/themeStorage.ts` | IndexedDB persistence for custom themes |
| `src/lib/stores/customThemes.svelte.ts` | Custom theme state |
| `src/lib/services/catalogueSync.ts` | Fetched/synced the scheme catalogue |
| `src/lib/components/ThemeBrowser.svelte` | Browse/preview all schemes |
| `src/lib/components/ThemeEditor.svelte` | Edit the 16 colours of a scheme |
| `src/lib/components/ThemePreview.svelte` | Swatch preview |
| `src/lib/components/ThemeSwitcher.svelte` | Header dropdown + cycle buttons |

```bash
git checkout 9069b4c -- \
  src/lib/themes/base16.ts src/lib/themes/base16.test.ts \
  src/lib/services/themeStorage.ts src/lib/services/catalogueSync.ts \
  src/lib/stores/customThemes.svelte.ts \
  src/lib/components/ThemeBrowser.svelte src/lib/components/ThemeEditor.svelte \
  src/lib/components/ThemePreview.svelte src/lib/components/ThemeSwitcher.svelte \
  src/lib/stores/theme.svelte.ts
```

Restoring the catalogue means restoring `theme.svelte.ts` too (3.0's version is
Catppuccin-only) and deleting `src/lib/stores/theme.svelte.test.ts`, which
tests the flavour-only API.

`src/lib/themes/catppuccin.ts` and `catppuccin.css` were **kept**.

### 1.3 `ScaffoldPanel.svelte`

The 800-line sidebar panel that held everything at once. Its contents were
split across the new spaces rather than deleted wholesale:

| Was in ScaffoldPanel | Now |
|---|---|
| Title, Subtitle | In the Write canvas (`Editor.svelte`) |
| SEO title/description/slug/tags + `Generate` | `FinishView.svelte` §SEO |
| Publication picker, Audience, Comments | `FinishView.svelte` §Destination |
| Send via email, Auto-share to Notes | `FinishView.svelte` §Delivery |
| Schedule (`trigger_at`) | `FinishView.svelte` §Timing |
| Publish button, readiness warnings, metadata | `FinishView.svelte` §Readiness/§Action |
| Workshop (Spark/Hook/Landing/Research/AI-GEN) | `PlanView.svelte` |
| Note reply audience | `FinishView.svelte` §Destination (note branch) |
| Round-trip + recorder blocks | Removed (§1.1) |
| **Post `type` picker** (newsletter/podcast/thread/video) | **Removed** (§2.6) |
| **Author readonly field** (`draft_bylines`) | **Removed** (§2.6) |

```bash
git checkout 9069b4c -- src/lib/components/scaffold/ScaffoldPanel.svelte
```

### 1.4 Build label plumbing

| Path | What it was |
|---|---|
| `src/lib/utils/buildInfo.ts` | `buildInfo` / `buildLabel` from Vite `define`s |
| `src/lib/utils/buildInfo.test.ts` | Its tests |

Consumed by the status bar's click-to-copy version chip, the dev-only `Reload`
button, and the window title (`StackEd v3.0.0+abc1234 - file.json`). 3.0's
window title is `StackEd 3 — <document title>`. The Vite `define`s
(`__APP_VERSION__`, `__APP_COMMIT__`, `__APP_BUILT_AT__`) are still declared in
`vite.config.ts`, so restoring the module needs no build-config change.

```bash
git checkout 9069b4c -- src/lib/utils/buildInfo.ts src/lib/utils/buildInfo.test.ts
```

### 1.5 `src/App.sidebar.test.ts`

Asserted the exact CSS of the permanent sidebar and its resize clamps. Replaced
by `src/App.shell.test.ts`, which asserts the three-space shell and autosave.
Restoring it only makes sense alongside the sidebar itself (§2.1).

```bash
git checkout 9069b4c -- src/App.sidebar.test.ts
```

---

## 2. Features removed from files that still exist

These are not whole-file restores. Read the 2.0 version of the file
(`git show 9069b4c:<path>`) and lift the block back out.

### 2.1 Permanent four-tab sidebar (`src/App.svelte`)

2.0 kept Scaffold / Research / Artwork / Generate on screen at all times in a
drag-resizable right sidebar (320–600px, width persisted to
`localStorage.sidebarWidth`, visibility to `localStorage.sidebarVisible`).

3.0 replaces it with the on-demand Tools drawer in `WriteView.svelte`: fixed
360px, Research / Artwork / Generate only, closed by default, remembered in
`localStorage.toolsDrawerOpen` / `activeTool`. The drag-resize handle,
`clampSidebarWidth`, `SIDEBAR_MIN_WIDTH`/`MAX_WIDTH` and the
`settingsStore.sidebarVisible` / `toggleSidebar()` API are gone.

Source: `git show 9069b4c:src/App.svelte`, `git show 9069b4c:src/lib/stores/settings.svelte.ts`

### 2.2 Theme cycling keyboard shortcut (`src/App.svelte`)

`Cmd/Ctrl+Shift+ArrowRight` / `ArrowLeft` cycled through the 27 schemes via
`themeStore.cycleNext()` / `cyclePrev()`. Those methods no longer exist; the
flavour is chosen in Settings. `Cmd/Ctrl+T` (new tab) was kept.

### 2.3 Status-bar build controls (`src/lib/components/StatusBar.svelte`)

Removed: the click-to-copy `StackEd v…+sha` chip and the dev-only `Reload`
button. Kept: file name, dirty dot, word count. Added: a quiet
`Unsaved` / `Saving…` / `Saved` line driven by autosave.

### 2.4 `Copy Substack` in the editor toolbar (`src/lib/components/editor/Toolbar.svelte`)

Moved, not deleted: it is now `Copy for Substack` in `FinishView.svelte`'s
action row. The underlying `substackClipboard.ts` service is unchanged; Finish
feeds it `generateHTML(documentStore.body, substackExtensions)` instead of a
live editor instance.

### 2.5 Pipeline folder / StackPipe vocabulary

2.0 let you "Connect folder…" to a *StackPipe vault* and remembered it. Nothing
read the value back — it was a stub for a pipeline that does not exist in 3.0.

Removed:

- `openFolder()` in `src/lib/services/files.ts`
- `savePipelineFolderPath()` / `loadPipelineFolderPath()` in `src/lib/services/storage.ts`
  (the `pipelineFolderPath` key is left in IndexedDB untouched, not migrated)
- the `Pipeline Folder` section of `src/lib/components/SettingsModal.svelte`

`localStorage['stacked:lastSavedFolder']`, which actually drives open/save
dialog defaults, was **kept**.

### 2.6 Post type and author fields (`FinishView.svelte`)

The `type` picker (newsletter / podcast / thread / video) and the readonly
`Author` display of `draft_bylines` were not carried into Finish. `type` still
defaults to `newsletter` in `emptyPostPayload()` and bylines are still assigned
by Substack on publish, so both round-trip correctly in `.stacked.json` — they
just have no UI. Readiness still reports empty bylines as advisory.

Restore the markup from
`git show 9069b4c:src/lib/components/scaffold/ScaffoldPanel.svelte`
(the `<!-- Payload: Core fields -->` section).

---

## 3. Things that look removed but are not

| Concern | Reality |
|---|---|
| Multiple tabs | Kept. The tab bar shows when 2+ tabs are open, in Write/Plan/Finish |
| Recent files | Kept, reachable from the Library header and the native menu |
| Research / Artwork / Generate panels | Kept, inside the Write tools drawer |
| Markdown mirror for Obsidian | Kept, still written on every save |
| SEO generation via Claude | Kept, in Finish |
| Publishing to Substack | Kept, in Finish, with the same confirm dialog |
| Zoom shortcuts | Kept (`src/lib/utils/zoom.ts`) |
| SpockLock secret handling | Kept, unchanged |

---

## 4. If you restore something

1. Restore the file(s) with the command above.
2. Give it a host — 3.0 has no permanent sidebar. Most panels belong in
   `WriteView.svelte`'s drawer or as a section of `FinishView.svelte`.
3. Run `npm run check && npm run test`. Restored 2.0 code may reference
   `settingsStore.sidebarVisible`, `themeStore.cycleNext()` or
   `documentStore` mutators that changed shape.
4. Update this file: move the entry to a "restored" note so the catalogue stays
   true.
