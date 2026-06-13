# StackEd — Tag/YAML Alignment & Workflow Design

**Date:** 2026-06-13
**Status:** Approved

---

## Problem Statement

Articles in StackEd have structural section tags in the editor body (`## SPARK`, `## HOOK`, etc.) and a YAML frontmatter block that mirrors some of those fields — but there is no consistent strategy for keeping them aligned. Extra YAML fields track progress and metadata but lack wiring for SEO. The workflow is also unstructured: there is no clear transition from a working tagged manuscript to a publish-ready final draft.

---

## Terminology

| Term | Meaning |
|---|---|
| **SPINE** | The four structural poles: TITLE, SUBTITLE, HOOK, LANDING |
| **BODY** | All prose sections between `## HOOK` and `## LANDING` |
| **Alt block** | A `## Alt TITLE` (or `## Alt HOOK` etc.) block containing numbered alternative versions |
| **Scaffold annotation** | Working notes in the body: `[SCAFFOLD:]`, `[CHECK:]`, `[IMAGE:]` |
| **_SELECTED field** | YAML field (e.g. `TITLE_SELECTED`) storing the `[✓]`-chosen Alt text |
| **SPARK** | The raw idea seed — authorial context only, not published |

---

## Document Structure

A working article body uses the following section order:

```markdown
## SPARK
Raw idea seed. Authorial context only — never published.

## TITLE
Current working title.

## Alt TITLE
1. Lady Justice has Lost Her Blindfold [✓]
2. Remove the Blindfold from Lady Justice
3. The Invisible Standard

## SUBTITLE
Hook promise line.

## HOOK
One punchy paragraph. Short and sharp — always immediately
adjacent to the ## HOOK tag. ≤ 150 words; parser warns if exceeded.

## CONTEXT
(free-named body section)

## Bad Seed
(free-named body section)

## LANDING
Closing thought. Short, like HOOK.

[SCAFFOLD: authorial note — stripped at render time]
[CHECK: fact to verify — stripped at render time]
[IMAGE: image suggestion — stripped at render time]
```

Section headings, Alt blocks, and scaffold annotations are all stripped before publication. Only prose reaches the reader.

---

## Two-Phase Workflow

### Phase 1 — Draft

The editor body is the single source of truth. YAML is a read-only mirror.

**Tools available:**
- `[SAVE]` — parse + write to disk
- `[AI-GEN]` — invokes substack-writer skill
- Preview tab — reader's eye view, regenerates on click
- YAML panel — read-only (toggleable)

**File:** `A_slug/A_slug.md`

### Promotion Gate → Final Draft

The `[→ Final Draft]` button is visible in Draft mode but **disabled** until:

1. **SPINE complete** — TITLE, SUBTITLE, HOOK, and LANDING are all non-empty
2. **BODY present** — at least one prose section exists between `## HOOK` and `## LANDING`, with a minimum of 100 words

If the gate is not met, a tooltip lists what is missing. The button is never hidden.

### Phase 2 — Final Draft

The manuscript is frozen. A clean prose file is created and becomes the editing target.

**Tools available:**
- `[AI FACT-CHECK]`
- `[SAVE]`
- `[→ PUBLISH]` — triggers SEO generation then posts to Substack
- `[↩ Restart]` — deletes `_final.md` and re-promotes from frozen manuscript (with warning)

**Files:** `A_slug/A_slug.md` (frozen) + `A_slug/A_slug_final.md` (editing target)

Tab bar disappears. Single untabbed free-text editor. Grammarly-compatible.

---

## Parse Behaviour

The parser runs on every **[SAVE]** and every **Preview activation**. On Preview it updates the in-memory document store only (no disk write). On [SAVE] it updates the store and writes body + YAML to disk atomically.

### What the parser extracts

| YAML field | Source |
|---|---|
| `SPARK` | Content under `## SPARK` |
| `TITLE` | Content under `## TITLE` |
| `SUBTITLE` | Content under `## SUBTITLE` |
| `HOOK` | Content under `## HOOK` (up to next `##`) |
| `LANDING` | Content under `## LANDING` |
| `TITLE_SELECTED` | `[✓]`-marked item text from `## Alt TITLE`, marker stripped |
| `HOOK_SELECTED` | `[✓]`-marked item text from `## Alt HOOK`, marker stripped |
| *(etc. for each Alt block)* | |
| `updated` | Timestamp, refreshed on every save |
| `created` | Timestamp, written once only, never overwritten |

### What the parser never touches

`SEO_TITLE`, `SEO_DESCRIPTION`, `SEO_SLUG`, `SEO_TAGS`, `IMAGE`, `AI_GEN`. These are managed by separate processes and left exactly as-is.

### HOOK constraint

HOOK content is always a single punchy paragraph immediately under `## HOOK`, ending at the next `##` marker. If the parser finds HOOK content exceeding 150 words it adds a `HOOK_WARNING: true` flag to the YAML panel for author attention.

---

## YAML Panel

The YAML panel is **entirely read-only**. No field in the panel is author-editable. Fields are updated by the parser (content fields) or by the AI (SEO fields).

**Content group** (parser-updated): SPARK, TITLE, SUBTITLE, HOOK, LANDING, *_SELECTED fields  
**SEO group** (AI-updated at Publish): SEO_TITLE, SEO_DESCRIPTION, SEO_SLUG, SEO_TAGS — shown as `pending` during Draft  
**Metadata group** (system-managed): created, updated  
**AI-GEN checkbox**: controls AI generation posture (see below)

### Panel toggle

Cursor-style layout icon in the timeline strip, left of the cog. Two icons:

- **Bottom-panel toggle** (left icon)
- **YAML panel toggle** (middle icon) — hollow = hidden, filled right = visible
- **Cog** (right)

Panel state persists between sessions per document.

---

## Alt Blocks

### Format

```markdown
## Alt TITLE
1. Lady Justice has Lost Her Blindfold [✓]
2. Remove the Blindfold from Lady Justice
3. The Invisible Standard
```

- Produced by the substack-writer skill
- `[✓]` on a numbered item marks the preferred variant
- Only one item per Alt block should be marked
- The Alt block heading (`## Alt TITLE`) and unchosen items are stripped at Preview and Promotion

### Selection mechanism

Clicking a radio button in Preview updates the `[✓]` marker in the editor body in real time. This is the one write-back Preview performs. The author can also edit the marker directly in the editor.

### Accumulation

Each AI-GEN run **appends** new numbered items to the existing Alt block rather than creating a duplicate heading. Items from successive runs accumulate in one block. The prompt is given the existing items and instructed to generate distinct alternatives, not near-duplicates.

---

## AI-GEN

### Alts-Only rule

AI never overwrites existing content directly.

| Section state | AI behaviour |
|---|---|
| Empty | Writes content directly into the section |
| Has content | Writes a new Alt block (or appends to existing Alt block) |

This rule holds in both AI-GEN modes.

### Modes (controlled by `AI_GEN` checkbox in YAML panel)

| Mode | Checkbox | Prompt posture |
|---|---|---|
| **Generative** | Checked | Fills gaps, generates structure, creates Alt blocks for written sections. For early-stage drafts. |
| **Rescan** | Unchecked | Reads full manuscript, suggests Alt blocks for sections that could be stronger. Does not fill empty sections. For late-stage drafts. |

AI-GEN always triggers an automatic [SAVE] after generating content — output is never left unsaved.

### substack-writer skill dependency

The substack-writer skill **must be updated** before AI-GEN is implemented in StackEd. The Alts-Only rule is not currently in the skill. See memory: `project_substack_writer_todo.md`.

---

## Preview

Preview is activated by clicking the Preview tab or the `PREVIEW ↗` link in the workflow timeline strip. Both trigger the same in-memory parse + render.

### Rendering rules

| Element | Preview behaviour |
|---|---|
| `## SPARK` | Rendered as a greyed callout at the top, labelled "SPARK". Not in Promotion output. |
| Section headings (`## HOOK`, `## CONTEXT`, etc.) | Stripped |
| Scaffold annotations | Stripped |
| Unchosen Alt items | Stripped |
| Alt block headings | Stripped |
| `[✓]`-chosen Alt text | Substituted in place of primary section content where present |
| Body prose | Shown in document order, clean |

### Interactivity

Preview is read-only except for Alt selection. Each Alt block is rendered as a set of radio buttons. Selecting one updates the `[✓]` marker in the editor body immediately. No other write-back occurs.

---

## Promotion to Final Draft

Triggered by `[→ Final Draft]` (gated — see Promotion Gate above).

**Steps:**
1. Parser runs one final time
2. Manuscript is rendered in document order:
   - `## SPARK` skipped
   - For each SPINE field and BODY section: `_SELECTED` text used where present, otherwise primary section text
   - All headings, scaffold annotations, and Alt blocks stripped
   - Output is clean prose
3. Written to `A_slug_final.md`
4. Editor switches to `A_slug_final.md` — tab bar disappears, Final Draft mode begins
5. `A_slug.md` is untouched

**Restart Final Draft:**  
`[↩ Restart]` in Final Draft toolbar. Confirmation dialog: *"This will discard all changes to the Final Draft. The manuscript is unchanged."* Deletes `_final.md`, switches back to `_slug.md`, tab bar returns. No re-tagging required — the manuscript was never altered.

---

## SEO Generation at Publish

Triggered by `[→ PUBLISH]` in Final Draft mode.

1. AI is fed `_final.md` content + YAML (including SPINE fields and Alt history)
2. Alt evolution is explicitly passed as signal — the journey between Alt versions reveals the article's sharpest angle
3. Returns: `SEO_TITLE`, `SEO_DESCRIPTION`, `SEO_SLUG`, `SEO_TAGS`
4. Written to `_final.md` frontmatter; shown in YAML panel for author review
5. Confirmation: *"SEO generated. Ready to publish?"*
6. Author may abort, refine, and re-trigger if unhappy with SEO output

SEO generation is not skippable but is fast.

---

## Workflow Timeline Strip

A dedicated thin strip sits between the editor area and the StatusBar, spanning the full width. It shows progression and serves as an aide memoire.

```
SPARK ——— [ DRAFT | PREVIEW ↗ ] ——— FINAL DRAFT ——— PUBLISHED
```

- Completed phases rendered in green with solid connecting lines
- Current phase highlighted
- Future phases dimmed
- `DRAFT` and `PREVIEW` are bracketed as two views of the same step — `PREVIEW ↗` is a clickable link that activates the Preview tab
- Phase badge also appears in the StatusBar (`DRAFT` / `FINAL DRAFT` / `PUBLISHED`)

---

## Open Items

- [ ] Update substack-writer skill to enforce Alts-Only rule (see `memory/project_substack_writer_todo.md`)
- [ ] Define minimum body word count threshold (currently proposed: 100 words)
- [ ] Decide whether SEO fields are editable by the author after AI generation (current design: read-only, re-run to change)
