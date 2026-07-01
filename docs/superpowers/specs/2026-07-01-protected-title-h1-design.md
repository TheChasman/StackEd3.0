# Protected Title H1 — Design

## Problem

Today the manuscript's TITLE lives only in frontmatter YAML, harvested from a
tagged `## TITLE` section that can appear anywhere in the body. The YAML
panel's TITLE field is read-only display; there's no requirement that the
body actually start with a title line, and nothing stops line 1 from being
deleted or restructured.

## Goal

Line 1 of the manuscript is always an H1: editable in place, drives the YAML
panel's TITLE display live, and can never be deleted, merged away, or
downgraded to another block type. This replaces the tag-based `## TITLE`
extraction entirely — `SPARK`/`SUBTITLE`/`HOOK`/`LANDING` tag extraction is
unaffected.

## Decisions

- **Replace, not augment**: line 1 becomes the single source of truth for
  TITLE. The `## TITLE` tagged-section parser is removed for TITLE
  specifically.
- **Protection scope**: the user can freely edit or clear the text on line 1,
  but the H1 block itself can't be deleted, merged into another node, or
  downgraded — there is always exactly one H1 node at the very top of the
  document.
- **Migration**: enforced automatically on load. If a document's first node
  isn't an H1 when it's opened (or the doc is empty), it's converted /an
  empty H1 is inserted immediately, no separate migration step required.
- **Level lock**: line 1 is always H1. Toolbar or markdown-shortcut attempts
  to change its level are silently reverted.
- **Sync direction**: one-way, editor → YAML panel. The panel's TITLE field
  stays read-only and mirrors line 1's live text; no editing happens in the
  panel.
- **Enter key**: pressing Enter while the cursor is inside line 1 splits the
  content so everything after the cursor moves into a new plain paragraph
  below — line 1 always stays a single H1 line, not another heading.

## Design

### 1. Protection mechanism — new TipTap extension `ProtectedTitle.ts`

A ProseMirror plugin with an `appendTransaction` hook that runs after every
transaction dispatched to editor state and enforces one invariant: **the
document's first top-level node is always a heading of level 1.**

- Empty doc → insert an empty H1.
- First node exists but isn't H1 (deleted via select-all+delete, merged via
  Backspace, downgraded via toolbar or markdown shortcut like `## `, etc.) →
  convert/restore it to H1, preserving whatever text survived the
  transaction.

This one fixup uniformly covers deletion, merging, and level changes — no
per-key interception needed for those cases, because `appendTransaction`
fires regardless of what produced the transaction (typing, toolbar command,
input rule, paste, drag-drop).

A dedicated **Enter** keymap binding (priority above StarterKit's default
heading keymap) handles the split-into-paragraph behavior: when the
selection is inside the document's first node, split the content and set the
new node's type to `paragraph` instead of `heading`.

`appendTransaction` also fires on `editor.commands.setContent(...)` during
file load (even with `emitUpdate: false`, which only suppresses TipTap's
`onUpdate` callback, not the state transaction itself) — so opening a legacy
file whose first line isn't an H1 gets auto-converted the moment content
loads. No separate migration code path is needed.

Register the extension in `Editor.svelte`'s extensions array, alongside the
existing custom extensions (Paywall, Poetry, etc.).

### 2. Live sync to YAML panel — no explicit sync code

Add a `titleFromBody` getter to `documentStore` (`document.svelte.ts`) that
parses `this.body` (the markdown string for the active tab) for its first
line, strips a leading `# `, and returns the trimmed text.

`YamlPanel.svelte`'s TITLE field switches its bound value from `fm.TITLE` to
`documentStore.titleFromBody`. Because `body` already updates on every
keystroke via the existing `setBody()` call in `Editor.svelte`'s `onUpdate`
handler, the panel mirrors line 1 live with no new wiring or dirty-flag
bookkeeping.

`tabTitle()` (used for tab labels, currently reads
`tab.frontmatter?.TITLE`) is updated to use the same body-derived title
logic, so tab labels also update live instead of only after save.

### 3. Persisted frontmatter — `frontmatter.ts`

- Remove `TITLE` from `ARTICLE_SECTIONS` (the tag-scanning list). SPARK,
  SUBTITLE, HOOK, LANDING keep their existing `## TAG` extraction, untouched.
- Add `extractTitleFromBody(body: string): string` — parses the markdown
  body's first line, stripping a leading `# ` if present.
- Use `extractTitleFromBody` explicitly for the TITLE field in:
  - `backfillArticleFrontmatter`
  - `runBodyParser` (called on every Save and Preview activation)
  - `runBodyParserUpsertOnly` (called by the "YAML Refresh" button)

  Same call sites and behavior contract as today (only overwrites when body
  has content for `runBodyParser`/`backfillArticleFrontmatter`; the "YAML
  Refresh" upsert-only variant does the same for TITLE as it does for the
  other sections), just a different extraction source for this one field.

### 4. Toolbar

No changes required. Existing heading buttons keep working for line 2+ as
today. Any attempt to change line 1's level via the toolbar gets silently
corrected back to H1 by the `appendTransaction` fixup in step 1.

## Testing

- Unit test for `extractTitleFromBody` (leading `# `, no leading `#`, empty
  body).
- Unit test for `documentStore.titleFromBody` getter.
- Manual verification in the editor (per CLAUDE.md UI testing guidance):
  - Type in line 1 → YAML panel and tab label update live.
  - Select-all + Delete on an existing doc → H1 restored, empty.
  - Backspace at start of line 2 (merging into line 1) → line 1 stays H1,
    doesn't disappear or downgrade.
  - Toolbar: try setting line 1 to H2 → reverts to H1.
  - Type `## ` at start of line 1 → stays H1 (markdown shortcut doesn't
    downgrade it).
  - Press Enter mid-way through line 1's text → text after cursor becomes a
    new paragraph below, line 1 remains a single H1 line.
  - Open a legacy file whose body doesn't start with `#` → line 1
    auto-converts to H1 on load.
  - Save a file → frontmatter TITLE matches line 1's text.
