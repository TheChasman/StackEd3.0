# Local storage consolidation — stub (NOT YET BRAINSTORMED)

Status: stub / parking lot. Do not implement from this doc. Brainstorm first.
Date: 2026-08-12

## Why this exists

Raised during the Substack Connections brainstorm ("Is SQLite3 overkill?").
Verdict: overkill for the connections registry alone (3–5 tiny rows), but a
real win for the broader storage sprawl. Captured here so it is not forgotten,
to be brainstormed as its own project later.

## Current state (inventory)

Persistence is spread across **two storage APIs, ~10 keys, and 9 files that each
talk to storage directly**. No module owns it.

### IndexedDB (`stacked` DB, v1, via `idb`) — `src/lib/services/storage.ts`

- `pipelineFolderPath` (single string under `settings` store)
- `recents` object store — hand-rolled sort / prune / limit-to-20 logic that is
  effectively a manual `ORDER BY opened_at DESC LIMIT 20`
- `substackConnections` (added by the connections project; array blob)

### localStorage — scattered across components/stores

- `activeToolTab`, `sidebarWidth` (App.svelte)
- `sidebarVisible` (settings.svelte.ts)
- `catppuccinFlavor`, `themeSchemeId` (themes/*)
- `activeCustomThemeId` (customThemes.svelte.ts)
- zoom level (utils/zoom.ts)
- `stacked:tagvocab:{publication}` (tagVocabulary.ts) — **one unbounded key per
  publication, never evicted**

## Known smells

1. `recents` reimplements ordered-collection-with-cap by hand.
2. Tag vocabulary cache is a per-publication table masquerading as string keys,
   with no eviction.

## Queued additions that will worsen the sprawl

- Sections cache (per connection) — from the Sections sub-project.
- Connection session/health state — from the refresh sub-project.
- Autosave state — from the scaffold-autosave design.

## Proposed split (to validate during its own brainstorm)

- **Config blob** (a single JSON doc / key) for singleton prefs: `sidebarWidth`,
  `sidebarVisible`, active theme, active custom theme, zoom, active tool tab.
  These have no schema and make poor SQL citizens — do not migrate them to SQL
  just to be uniform.
- **SQLite** for collections and caches: `recents`, tag vocabulary, sections
  cache, connection registry + health. These want real tables, ordering,
  eviction, and joins.

## Enabling seam already in place

The connections registry hides all persistence behind its store module API
(`list/add/rename/delete/ensure`). Whatever backend wins, connections migrate by
rewriting one file's internals, not by touching components. New collections
should adopt the same store-module discipline.
