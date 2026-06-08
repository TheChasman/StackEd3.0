# Obsidian Workflow — Spec

**Date:** 2026-06-08
**Status:** Approved
**Scope:** Obsidian-side Spark capture, folder scaffold, and YAML backfill. Part 1 of 3 (see also: StackEd Enhancements, OVmv vault mover).

---

## Problem

Sparks (raw article ideas) are captured on two platforms — Mac and Android — via Obsidian. The current Mac scaffold template works but is missing the `research/` subfolder and has no idempotency guard. There is no Android template. There is no mechanism to backfill YAML from tagged body text as an article evolves.

---

## Workflow Overview

```
[Android]                        [Mac]
  │                                │
  ├─ Spark captured                ├─ Spark captured
  │  → StackEd Article (Android)   │  → StackEd Article (Mac)
  │  → 7-field YAML written        │  → folder scaffold + YAML
  │  → file stays flat             │
  │                                │
  └── Obsidian Sync ──────────────►│
                                   ├─ trigger_on_file_creation fires
                                   │  → idempotency check passes
                                   │  → folder scaffold only (YAML exists)
                                   │
                    [any time]     │
                                   ├─ Body tags edited
                                   │  → run "Sync Tags to YAML" manually
                                   │  → tagged fields update in YAML
                                   │  → deleted tags leave YAML intact
```

---

## Component 1 — Android Template

**File:** `O_Substack/_Templates/StackEd Article (Android).md`
**Trigger:** Manual (Command Palette or Templater hotkey)

### Behaviour

1. Prompt for title (pre-filled with current filename)
2. Rename file to confirmed title
3. Write 7-field YAML frontmatter
4. Place cursor in body for immediate note-taking

### YAML written

```yaml
SPARK: ""
TITLE: "<confirmed title>"
SUBTITLE: ""
HOOK: ""
LANDING: ""
created: "<YYYY-MM-DD>"
updated: "<YYYY-MM-DD>"
```

### Constraints

- No folder creation
- No file move
- No `trigger_on_file_creation` — manual invocation only
- Must work within Android Templater limitations (no `app.vault.createFolder` dependency)

---

## Component 2 — Mac Scaffold Template

**File:** `O_Substack/_Templates/StackEd Article.md`
**Trigger:** Manual invocation **and** `trigger_on_file_creation: true`

### Behaviour

1. Idempotency checks (run first, before any vault operations):
   - Is the file already inside a `{name}/{name}.md` structure? → **exit silently**
   - Does the file already have YAML frontmatter (`---` at line 1)? → **skip YAML write, proceed to folder scaffold only**
2. Resolve title without blocking:
   - If YAML exists and `TITLE` field is non-empty → use that value, **no prompt**
   - Otherwise → prompt (pre-filled with current filename)
3. Sanitise title for filesystem (strip `\ / : * ? " < > |`, replace with `-`)
4. Rename file to sanitised title
5. Create folder structure (all `mkdir`-equivalent, safe if folders exist):
   ```
   {title}/
     artwork/
     research/
   ```
6. Move file to `{title}/{title}.md`
7. Write 7-field YAML (skipped if step 1 detected existing frontmatter)

### YAML written (new files only)

```yaml
SPARK: ""
TITLE: "<confirmed title>"
SUBTITLE: ""
HOOK: ""
LANDING: ""
created: "<ISO timestamp>"
updated: "<ISO timestamp>"
```

### `trigger_on_file_creation` behaviour

When a file arrives from Android via Obsidian Sync, the template fires automatically. The idempotency check sees existing YAML, reads `TITLE` from it, and skips to folder scaffold without prompting. No blocking dialog — the scaffold happens silently in the background.

---

## Component 3 — YAML Sync Script

**File:** `O_Substack/_Templates/Sync Tags to YAML.md`
**Trigger:** Manual (Command Palette only — Mac/Obsidian only)

### Purpose

Reads tagged lines from the article body and backfills the corresponding YAML fields. Designed to be run repeatedly as an article evolves; safe to re-run at any point.

### Tag format

Plain label at the start of a line, followed by a colon and a space:

```
TITLE: My Article Title
SUBTITLE: What this is really about
HOOK: The opening line that earns the read
LANDING: The closing thought
SPARK: The raw idea that started this
```

### Parsing rules

| Body line | YAML action |
|---|---|
| Starts with `TITLE: ` | Set `TITLE` to value |
| Starts with `SUBTITLE: ` | Set `SUBTITLE` to value |
| Starts with `HOOK: ` | Set `HOOK` to value |
| Starts with `LANDING: ` | Set `LANDING` to value |
| Starts with `SPARK: ` | Set `SPARK` to value |
| No tags found anywhere in body | Set `SPARK` to full body text |
| Tag present but empty (`TITLE: `) | Skip — do not blank the YAML field |
| Multiple lines with the same tag | Last one wins |
| Untagged lines (when other tags exist) | Ignored |

### Preservation rule

Uses `app.fileManager.processFrontMatter`. Only fields whose tag is present in the body are written. Removing a tag from the body on a subsequent run **does not** clear the YAML field. YAML fields are never deleted by this script.

### On every run

- Updates the `updated` field to today's date
- If the file has no frontmatter yet, creates the 7-field schema first, then backfills

### Scope constraint

`processFrontMatter` is an Obsidian desktop API. This script is Mac/Obsidian-only by design. The user never edits Substack `.md` files outside Obsidian.

---

## File Layout (post-scaffold)

```
O_Substack/
  {Section}/
    {Title}/
      {Title}.md       ← manuscript (7-field YAML + body)
      artwork/         ← hero images, illustrations
      research/        ← reference material, notes, clippings
```

---

## Excluded from this spec

- **OVmv** — vault mover for wrong-vault files. Separate project at `../OVmv`.
- **StackEd enhancements** — Scaffold button, Research wiring, Fact Check, SEO, status flags. Separate spec.
- **File watcher / Finder bridge** — explicitly descoped. Obsidian Sync + `trigger_on_file_creation` covers the Mac arrival case without OS-level file watching.

---

## Open questions

None. All design decisions confirmed in session.
