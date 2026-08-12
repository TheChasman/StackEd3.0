# Substack Connections registry — design

Status: implementing (Phase 2 sub-project 1 of 3)
Date: 2026-08-12

## Problem

Every `.stacked.json` post carries a free-text `scaffold.remote.publication`
subdomain that the user retypes by hand in each post. There is no saved list of
the Substacks the user posts to, no friendly names, and no protection against
typos. Manually retyping the subdomain to seed a cookie into each post is the
specific pain point being removed.

## Scope

In scope: a saved, named registry of Substack publications, managed in Settings,
surfaced as a per-post dropdown that replaces the free-text input.

Out of scope (queued as the next two sub-projects):

- Cookie/session health + refresh when a login goes stale.
- Substack "Sections" listing and per-post section selection.

## Source-of-truth model (settled)

Three concerns, three authorities. They must not be collapsed.

| Concern | SSOT | Lives where |
|---|---|---|
| Where does *this post* publish? | `scaffold.remote.publication` (raw subdomain string) | the `.stacked.json` file |
| What Substacks do I know about, and what do I call them? | the connections registry | machine-local (IndexedDB today) |
| Am I authenticated? | the webview cookie jar | not owned by StackEd |

The document wins. The registry is a **rebuildable index** of
`subdomain -> nickname`; it is never the thing a post points at. The
asymmetry that justifies this: the registry can be rebuilt from the documents
(via `ensureConnectionForSubdomain`), but the documents can never be rebuilt
from the registry. If IndexedDB is wiped, opening posts repopulates the list.

Consequently there are **no changes** to the on-disk file format, the
`Scaffold` / `RemoteState` types, `publisher.ts`, `webviewTransport.ts`, or
`tagVocabulary.ts`. They keep consuming `scaffold.remote.publication` as a plain
subdomain string exactly as today. `nickname` is presentation-only and never
written into a document.

## Data model

```ts
// src/lib/types/connection.ts
export interface SubstackConnection {
  id: string;        // crypto.randomUUID()
  subdomain: string; // normalised, e.g. "chasman1"
  nickname: string;  // display label; defaults to subdomain
}
```

## Storage seam

All persistence lives behind `substackConnections.svelte.ts`. No component
touches storage directly. Today it writes a JSON array under a new
`substackConnections` key in the existing IndexedDB `settings` object store
(same pattern as `pipelineFolderPath`, no schema/version bump). A later SQLite
consolidation (see the storage-consolidation stub) rewrites only this one
file's internals — zero component changes. That seam is the insurance that makes
deferring the storage-backend decision a non-decision rather than debt.

## Store API

```
connections: SubstackConnection[]         // $state
load()                                     // hydrate at startup
normaliseSubdomain(input): string          // trim, strip scheme/slash/.substack.com, lowercase
addConnection({subdomain, nickname?})      // -> {ok:true, connection} | {ok:false, error:'empty'|'duplicate'}
renameConnection(id, nickname)
deleteConnection(id)
findBySubdomain(subdomain)                  // case-insensitive
ensureConnectionForSubdomain(subdomain)     // idempotent: existing match, else create nickname=subdomain; null for ''
```

`addConnection` returns a result union rather than throwing, so the Settings
form can render inline errors. `ensureConnectionForSubdomain` never throws and
never blocks rendering.

## UI

### Settings modal — new "Substack Connections" section

- One row per connection: inline-editable nickname (commit on blur/Enter),
  muted `subdomain.substack.com`, delete button.
- Add form: subdomain input + optional nickname input + Add button, with inline
  empty/duplicate errors (no alerts/toasts).
- Empty state when no connections exist.
- Deleting a connection does not touch any document. If a post using that
  subdomain is later reopened, `ensureConnectionForSubdomain` re-adds a row.

### ScaffoldPanel — dropdown replaces the free-text input

- `<select>` bound to `scaffold.remote.publication`; placeholder
  `— Select a connection —` (value `''`). Option value = subdomain, label =
  nickname (plus ` (subdomain.substack.com)` when they differ).
- `onchange` writes the normalised subdomain via the existing
  `documentStore.replaceScaffold(scaffold)` path.
- An `$effect` calls `ensureConnectionForSubdomain` when the active scaffold has
  a non-empty, unmatched publication. This single idempotent rule is both the
  legacy-file migration path and the deleted-connection recovery path.
- **Case wrinkle handled deliberately:** a legacy doc holding `Chasman1`
  resolves case-insensitively and displays as selected via a *derived* value.
  The file is **not** rewritten on open — normalisation only reaches the
  document when the user actively picks from the dropdown. This avoids silently
  dirtying files (important with autosave pending).
- Adding is Settings-only; the dropdown shows a hint pointing at Settings when
  the registry is empty.
- The three existing empty-publication publish guards are untouched.

## Verification

- Unit tests for the store: normalisation cases; add (ok/empty/duplicate incl.
  case); rename; delete; ensure (creates / returns existing across case / no-ops
  on `''`); write-through.
- `npm run test` and `npm run check`.
- Manual: open an existing `.stacked.json` with a legacy subdomain → dropdown
  shows it pre-selected, Settings shows the auto-added row, and the file is not
  marked dirty on open.
