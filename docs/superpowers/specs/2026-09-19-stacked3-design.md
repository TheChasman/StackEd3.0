# StackEd 3.0 — Design Spec

**Date:** 2026-09-19
**Status:** Approved
**Repo:** `/Users/chasnewport/Projects/StackEd3.0`
**Supersedes:** StackEd 2.0 (`/Users/chasnewport/Projects/StackEd2.0`)

---

## 1. Purpose

StackEd 3.0 is an offline-first **writing studio** for Substack.

**One sentence:** StackEd 3 is where you write Substack posts; publishing is a
deliberate step at the end, not a panel you stare at while writing.

StackEd 2.0 accumulated a publishing console, an SEO form, a research tool, an
artwork manager and a transport-debugging harness onto a single screen. Every
capability was reachable at all times, which made the writing surface the
smallest thing on screen. 3.0 keeps the capabilities that serve authoring and
demotes the rest behind an explicit, intentional flow.

### The problem being solved

The browser Substack editor has no content calendar and feels clunky. StackEd
2.0 replaced that clunkiness with a different clunkiness: workflow chrome
promoted to permanent furniture. 3.0 fixes the arrangement, not the ambition.

---

## 2. Three spaces

Navigation is a small explicit state machine, not a router.

```
Library  ──open──▶  Write  ──▶ Plan (context)
   ▲                  │
   └──── back ────────┴──Finish──▶ Substack
```

| Space | Owns | Default? |
|---|---|---|
| **Library** | Every local draft: list, search, calendar, state, target date | Yes, on launch with no file |
| **Write** | The manuscript. Title, subtitle, body. Nothing else competing | Yes, once a document is open |
| **Plan** | Spark, Hook, Landing, research notes, target date | On request |
| **Finish** | SEO, publication, audience, comments, email, schedule, readiness, publish | On request |

Only one space is on screen at a time. Write is never subdivided by a permanent
sidebar.

### 2.1 Library

Launch screen when no document is open.

- `New draft` and `Open file…`
- Search across title and file path
- **List** view: title, state badge, target date, last-updated, publication
- **Calendar** view: month grid, drafts placed on `targetDate`
- State filter chips
- Click a draft to open it in Write

The library is a local index (see §4.3), not a pipeline. It never mutates
documents; it reads and orders them.

### 2.2 Write

The writing surface, and the default once a document is open.

- Centred column, max width `--stacked-measure` (72ch, ≈700–760px)
- Title and subtitle are edited **in the canvas**, at the top, styled as the
  post's own title — not as sidebar form fields
- Minimal formatting toolbar: undo/redo, style, bold/italic/strike,
  super/subscript, code, quote, link, image, lists, Substack blocks
- Autosave status is a single quiet line; no build labels, no reload buttons
- One `Tools` button reveals a right drawer containing Research, Artwork and
  Generate. Closed by default, remembered per session
- One `Finish` button opens the Finish space

Removed from this surface: theme cycling, publication pickers, SEO fields,
scheduling, transport diagnostics, `Copy Substack`.

### 2.3 Plan

Pre-writing thinking, reached from Write.

- Spark, Hook, Landing, Research notes (all `workshop`, never published)
- Target date (local planning only, distinct from Substack scheduling)
- AI-GEN flag

### 2.4 Finish

The publish review screen. One page, top to bottom, ending in one action.

1. **Readiness** — blocking and advisory checks, plain English
2. **SEO** — search title, search description, slug (lockable), tags, `Generate`
3. **Destination** — publication connection, audience, comment permissions
4. **Delivery** — email send, auto-share to Notes
5. **Timing** — target date (local) and Substack schedule (`trigger_at`)
6. **Action** — `Create draft`, `Schedule`, or `Publish now`, plus
   `Copy for Substack` as the manual-paste escape hatch

Publishing stays irreversible-by-confirmation: the confirm dialog states the
publication, the action, and the SEO values being sent.

---

## 3. What was removed

Removals are catalogued, with restore commands, in
[`docs/CHERRIES.md`](../../CHERRIES.md). Nothing is hidden behind a flag: the
code is deleted from `main`, and the StackEd 2.0 history is present in this
repository so any removal can be cherry-picked back verbatim.

Headline removals: Substack transport round-trip harness, transport recorder,
body presets, base16 theme catalogue with its browser/editor/preview/switcher,
the four-tab permanent sidebar, the status-bar build/reload controls, and
`StackPipe` pipeline-folder vocabulary.

---

## 4. Data model

### 4.1 Scaffold (unchanged core)

`.stacked.json` remains canonical, and `PostPayload` still mirrors the Substack
API field names. Treating the payload as an export concern rather than the
editor's own model is desirable but out of scope here; it would be a
file-format migration, and this pass is a UX redesign.

### 4.2 Additions

```ts
interface Workshop {
  // ...existing
  targetDate: string | null; // 'YYYY-MM-DD', local planning only
}

interface RemoteState {
  // ...existing
  publishedAt: string | null; // ISO, set when a publish succeeds
}
```

Both are optional on read (older files load with `null`) and written on save.

### 4.3 Document state

Derived, never hand-set:

| State | Rule |
|---|---|
| `published` | `remote.publishedAt !== null` |
| `scheduled` | `remote.scheduled === true` |
| `ready` | `readiness(scaffold).blocking.length === 0` |
| `draft` | otherwise |

### 4.4 Library index

A `library` object store in the existing `stacked` IndexedDB database, keyed by
`filePath`:

```ts
interface LibraryEntry {
  filePath: string;
  title: string;
  subtitle: string;
  state: DocumentState;
  targetDate: string | null;
  publication: string;
  updated: string;   // ISO
  wordCount: number;
}
```

Written on every successful save (manual and autosave). The store is a cache:
if an entry's file has vanished, the entry is pruned on next read. No document
content lives in IndexedDB.

Because the index is populated by saves, drafts written by StackEd 2.0 appear
in the library the first time 3.0 saves them; `Open file…` and recents remain
the way in until then.

### 4.5 Autosave

Implements the design already written for 2.0
(`docs/superpowers/specs/2026-08-12-scaffold-autosave-design.md`):
`documentStore.editTick` increments on every mutation, and `App.svelte`
debounces a 4-second quiet period before writing back to the document's
existing path. Documents with no path are never autosaved. Failure leaves the
document dirty and retries; it never raises a modal.

3.0 adds one visible affordance the 2.0 design deliberately omitted: a quiet
`Saved` / `Saving…` / `Unsaved` line in Write, because with a decluttered
surface the user otherwise has no save signal at all.

---

## 5. Layout

```
Library                          Write
┌──────────────────────────┐    ┌────────────────────────────────────┐
│ StackEd 3      [new][⚙]  │    │ ‹ Library   title      [Tools][Fin]│
│ search…      [list|cal]  │    ├────────────────────────────────────┤
│ ─────────────────────────│    │ toolbar                            │
│ ▸ Draft A   ready  12 Oct│    │      ┌──────────────────┐   ┌─────┐│
│ ▸ Draft B   draft   —    │    │      │  Title           │   │Tools││
│ ▸ Draft C   sched  14 Oct│    │      │  Subtitle        │   │ drawer│
│                          │    │      │  body…           │   │(opt)││
└──────────────────────────┘    │      └──────────────────┘   └─────┘│
                                 │ Saved · 880 words                  │
                                 └────────────────────────────────────┘
```

---

## 6. Non-goals

- No ten-stage pipeline, no Kanban, no stage machinery
- No server, no sync, no hosted backend
- No SEO analyser, SERP simulator or keyword scoring
- No multi-user, no collaboration
- No Substack API surface beyond what 2.0 already proved
- No `.stacked.json` format migration in this pass

---

## 7. Verification

`npm run format:check && npm run lint && npm run check && npm run test`, plus a
browser smoke pass over Library → Write → Plan → Finish.
