# StackEd 2.0 — Design Spec

**Date:** 2026-05-22  
**Status:** Approved  
**Repo:** `/Users/chasnewport/Projects/StackEd2.0`

---

## 1. Purpose

StackEd 2.0 is a focused, offline-capable Substack post editor. It sits in the middle of the StackPipe publishing pipeline: the place where writing and revision happen.

**One sentence:** StackEd 2.0 is where you write Substack posts.

**Not in scope:** publishing to Substack (StackPipe's job), calendar/scheduling UI, SEO analysis modules, social/email previews, sync servers, or any Railway backend.

---

## 2. Context: The StackPipe Pipeline

Articles are `.md` files with YAML frontmatter, stored in a flat folder that doubles as an Obsidian vault. StackPipe (a Tauri/Rust app) manages the pipeline and advances articles through stages. StackEd reads and writes these same files.

Pipeline stages (in order):

```
spark → hook → opening → research → writing → final_draft → seo → fact_check → staged → posted
```

StackEd is the primary tool for `writing` through `fact_check` stages. It has no role in the `staged` or `posted` stages.

---

## 3. Schema & Permissions

### Source of truth

StackEd reads two files from the StackPipe project at startup:

- `../StackPipe/docs/stackpipe-field-permissions.json` — the canonical field permission manifest
- (The article schema YAML is for reference; the JSON is what StackEd consumes)

### Three field tiers

| Tier | `access` value | Rendered as |
|---|---|---|
| Author-owned | `free` | Normal editable input |
| AI-owned | `padlocked` | Read-only with 🔒 icon; author can unlock to override |
| Pipeline-owned | `readonly` | Displayed, greyed out, never interactive |

### Content lock

When `content_locked: true` (set by the Rust backend when `fact_check` advances to `staged`):

- All fields with `content_field: true` are rendered readonly, overriding their normal access tier
- A 🔒 **Content locked** indicator appears in the YAML panel header
- An **Unlock Content** button is shown — but only while `substack_url` is empty (pre-post)
- Unlock writes `content_locked: false` and `pipeline_stage: fact_check`, returning the article for re-review
- Once `pipeline_stage: posted`, the unlock button is hidden permanently

### Overrides

When the author saves an edit to a padlocked (AI-owned) field:

- StackEd appends the field name to the `overrides[]` array in the frontmatter
- `overrides` is `readonly` in the UI (not hand-editable) but StackEd writes it programmatically
- The AI pipeline (in StackPipe) skips regenerating any field present in `overrides[]`
- When the author clears an override and allows AI to regenerate, StackEd removes the field name from `overrides[]`

### Fields StackEd never writes

`guid`, `pipeline_stage`, `created`, `updated`, `substack_url`, `file_path`

> `updated` is owned by the StackPipe Rust backend, which watches the filesystem and sets it automatically. StackEd does not touch it.

**Exception — Unlock action only:** StackEd writes `content_locked: false` when the author triggers Unlock. This is the only case where StackEd touches a StackPipe-owned field, and it is an explicit author action, not a normal edit path. `overrides[]` is similarly written programmatically (not via the UI field) when the author saves a padlocked edit.

---

## 4. Editor

### Technology

TipTap 3 with Svelte 5 integration. Serialises to/from Markdown on file read/write.

### Standard Markdown

Full CommonMark support via TipTap's StarterKit: headings, bold, italic, blockquote, code, fenced code blocks, lists (ordered + unordered), horizontal rule, links, images.

### Substack extensions (ported from StackEd 1.x)

| Extension | Slash command | Description |
|---|---|---|
| `Paywall` | `/paywall` | Paid subscriber gate marker |
| `SubscribeButton` | `/subscribe` | Inline subscribe CTA block |
| `Poll` | `/poll` | Substack-native poll block |
| `Poetry` | `/poetry` | Whitespace-preserving verse block |
| `LaTeX` | `/latex` | Inline and display math (KaTeX) |
| `Footnote` | `/footnote` | Numbered footnotes |

### Toolbar

Standard formatting controls (bold, italic, headings, lists, links, images) plus Substack-specific insert buttons for each extension above.

### Body ↔ file mapping

The TipTap canvas maps directly to the `body` field — the Markdown content below the frontmatter `---`. On save, StackEd serialises the editor state to Markdown and writes it back to the file, preserving all other frontmatter fields exactly as-is (gray-matter round-trip).

---

## 5. YAML Side Panel

A collapsible right panel showing all frontmatter fields, grouped and rendered according to their permission tier.

### Groups (top to bottom)

1. **Status** (readonly, always visible): `pipeline_stage` as a coloured stage badge, `content_locked` indicator, `created`, `updated`, `substack_url` (as a link if set)
2. **Content** (free): `title`, `subtitle`, `spark_notes`, `hook`, `opening`, `research_notes`, `legal_notes`
3. **AI-generated** (padlocked): `ai_draft`, `fact_check_notes`, `seo_title`, `seo_description`, `seo_slug`, `substack_tags`
4. **Publishing** (free): `publish_at`, `publication`, `section`, `audience`, `allow_comments`, `send_email`

### Padlock interaction

1. Author clicks 🔒 on a padlocked field
2. Field becomes editable with a visible "Overriding AI content" indicator
3. On save: field value written to file + field name appended to `overrides[]`
4. A "Reset to AI" button removes the field from `overrides[]` and clears the edit

---

## 6. Research Panel

A collapsible panel below the YAML panel in the right sidebar.

### Behaviour

- Author highlights text in the editor **or** types a freehand question into the panel input
- Hits Enter or clicks the search button
- Panel fires a web search + summarise request to the configured AI provider
- Result appears with inline source citations
- An **Insert** button appends a quoted excerpt at the current cursor position in the editor

### AI provider adapter

A thin interface with two implementations. Provider and API key are set in Settings.

```
AIAdapter
  ├── ClaudeAdapter   — Anthropic API (web_search tool)
  └── OpenAIAdapter   — OpenAI API (web_search_preview response)
```

Both call the provider API directly from the browser (no backend proxy). API key stored in `localStorage` only; never written to any file.

---

## 7. File I/O

### File System Access API

- **Open folder**: author picks their pipeline folder once; the handle is persisted in IndexedDB so the folder reconnects on next launch without re-prompting
- **Open file**: file picker filtered to `.md` files, or click from the recent files list
- **Save**: `Ctrl/Cmd+S` — serialises editor state + updated frontmatter back to the same file using gray-matter

> StackEd does not create new article files. New articles are created by StackPipe (which sets the StackPipe-owned fields: `guid`, `created`, `pipeline_stage`). StackEd opens existing pipeline files only.

### gray-matter

Used for all frontmatter parse/serialise. Preserves field order and comments on round-trip — the frontmatter StackEd writes back must not reorder or drop fields that StackPipe added.

### IndexedDB (minimal use)

- Recent files list (file handles + titles, last 20)
- Pipeline folder handle (for reconnection)
- AI provider API key (settings)

IndexedDB is **not** used for article content.

---

## 8. Layout

```
┌─────────────────────────────────────────────────────────┐
│  toolbar                                                │
├──────────────────────┬──────────────────────────────────┤
│                      │  YAML panel (collapsible)        │
│   TipTap canvas      │  ── stage badge + lock status    │
│                      │  ── Content fields (free)        │
│                      │  ── AI fields (padlocked 🔒)     │
│                      │  ── Publishing fields (free)     │
│                      │  ── System fields (readonly)     │
│                      ├──────────────────────────────────┤
│                      │  Research panel (collapsible)    │
│                      │  ── search / question input      │
│                      │  ── results + citations          │
│                      │  ── [ Insert ] button            │
└──────────────────────┴──────────────────────────────────┘
│  status bar: filename · word count · pipeline_stage    │
└─────────────────────────────────────────────────────────┘
```

The right sidebar (both panels) can be hidden entirely for full-width writing. Panel collapse state persists in `localStorage`.

---

## 9. Settings Modal

| Setting | Storage | Notes |
|---|---|---|
| AI provider | `localStorage` | `claude` or `openai` |
| API key | `localStorage` | Never written to file or sent to any proxy |
| Pipeline folder | IndexedDB | File System Access API handle |
| Sidebar visible | `localStorage` | Persisted collapse state |

---

## 10. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Svelte 5 (runes) + Vite |
| Editor | TipTap 3 |
| Styling | Tailwind CSS 4 |
| Frontmatter | gray-matter |
| File I/O | File System Access API |
| Local persistence | IndexedDB (handles + recents), localStorage (settings) |
| AI | Anthropic API / OpenAI API (direct browser calls) |
| PWA | VitePWA plugin (editor works offline; research requires internet) |
| Language | TypeScript |
| Testing | Vitest |

---

## 11. What Is Deliberately Excluded

- Railway / Express backend
- Substack API integration (cookie auth, posting)
- SILO / GDrive sync
- SEO analysis modules (entity extraction, keyword density, SERP simulation)
- Calendar and scheduler UI
- Social / email preview modals
- Testing dashboard
- Any server-side storage of content or API keys
