# Obsidian Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement three Obsidian Templater scripts — an Android-safe YAML template, an updated Mac scaffold template, and a YAML backfill script — to support the full Spark-to-article workflow.

**Architecture:** All three components are Templater `.md` script files living in `~/Obsidian/O_Substack/_Templates/`. The Mac scaffold template is the only one that performs vault file operations (rename, createFolder, move); the Android template writes YAML only; the sync script uses `processFrontMatter` to backfill YAML from tagged body text.

**Tech Stack:** Obsidian Templater plugin (JavaScript scripting API), Obsidian vault API (`app.vault`, `app.fileManager`, `app.metadataCache`)

---

## File Map

| Action | Path |
|---|---|
| CREATE | `~/Obsidian/O_Substack/_Templates/StackEd Article (Android).md` |
| REPLACE | `~/Obsidian/O_Substack/_Templates/StackEd Article.md` |
| CREATE | `~/Obsidian/O_Substack/_Templates/Sync Tags to YAML.md` |
| CONFIG | Obsidian → Settings → Templater → Trigger on file creation |

---

## Task 1: Android Template

**Files:**
- Create: `~/Obsidian/O_Substack/_Templates/StackEd Article (Android).md`

- [ ] **Step 1: Create the template file**

Write the following to `~/Obsidian/O_Substack/_Templates/StackEd Article (Android).md`:

```
<%*
const raw = await tp.system.prompt("Spark title?", tp.file.title);
if (!raw?.trim()) {
  new Notice("StackEd: cancelled.");
  return;
}
const title = raw.trim();
const today = tp.date.now("YYYY-MM-DD");
await tp.file.rename(title);
tR += `---\nSPARK: ""\nTITLE: "${title}"\nSUBTITLE: ""\nHOOK: ""\nLANDING: ""\ncreated: "${today}"\nupdated: "${today}"\n---\n\n`;
-%>
```

- [ ] **Step 2: Test — basic invocation**

In Obsidian (Mac or simulated):
1. Create a new note (Cmd+N) — filename "Untitled"
2. Command Palette → "Templater: Open insert template modal" → `StackEd Article (Android)`
3. When prompted "Spark title?", enter `Test Android Spark`

Expected result:
- File renamed to `Test Android Spark.md`
- File stays in current folder (no move)
- File content is exactly:
```yaml
---
SPARK: ""
TITLE: "Test Android Spark"
SUBTITLE: ""
HOOK: ""
LANDING: ""
created: "2026-06-08"
updated: "2026-06-08"
---

```

- [ ] **Step 3: Test — cancellation**

1. Create a new note
2. Run the template
3. Clear the prompt field and click Cancel (or submit empty string)

Expected: Notice "StackEd: cancelled." — file unchanged, no YAML written.

- [ ] **Step 4: Save and confirm**

The Obsidian vault is not a git repo. Verify the file exists:
```bash
ls ~/Obsidian/O_Substack/_Templates/
# Expected: Backfill\ YAML.md  Hero\ Prompt.md  StackEd\ Article\ (Android).md  StackEd\ Article.md  StackPipe\ Article.md
```

---

## Task 2: Mac Scaffold Template

**Files:**
- Replace: `~/Obsidian/O_Substack/_Templates/StackEd Article.md`

- [ ] **Step 1: Replace the template file**

Overwrite `~/Obsidian/O_Substack/_Templates/StackEd Article.md` with:

```
<%*
// Guard: never scaffold _* paths (templates, reference, scripts, etc.)
const relPath = tp.file.path(true);
if (relPath.split('/').some(p => p.startsWith('_'))) return;

// Guard: already in {name}/{name} structure — nothing to do
const parts      = relPath.split('/');
const parentName = parts.length >= 2 ? parts[parts.length - 2] : '';
if (parentName === tp.file.title) return;

// Read file to check for existing frontmatter
const file     = app.workspace.getActiveFile();
const existing = await app.vault.read(file);
const hasYaml  = existing.trimStart().startsWith('---');

// Resolve title — no prompt if YAML already has a TITLE value
let resolvedTitle = '';
if (hasYaml) {
  const cache = app.metadataCache.getFileCache(file);
  resolvedTitle = (cache?.frontmatter?.TITLE ?? '').trim();
}
if (!resolvedTitle) {
  const raw = await tp.system.prompt("Article title?", tp.file.title);
  if (!raw?.trim()) {
    new Notice("StackEd: cancelled.");
    return;
  }
  resolvedTitle = raw.trim();
}

const safeTitle = resolvedTitle.replace(/[\\/:*?"<>|]/g, '-');
const now       = new Date().toISOString();

// Rename, create bundle folders, move
await tp.file.rename(safeTitle);
for (const p of [safeTitle, `${safeTitle}/artwork`, `${safeTitle}/research`]) {
  try { await app.vault.createFolder(p); } catch (_) {}
}
await tp.file.move(`${safeTitle}/${safeTitle}`);

// Output: preserve existing content, or write fresh 7-field YAML
if (hasYaml) {
  tR += existing;
} else {
  tR += `---\nSPARK: ""\nTITLE: "${safeTitle}"\nSUBTITLE: ""\nHOOK: ""\nLANDING: ""\ncreated: "${now}"\nupdated: "${now}"\n---\n\n`;
}
-%>
```

- [ ] **Step 2: Test A — new blank file (standard Mac capture)**

1. Create a new note (Cmd+N) at vault root, do NOT add any content
2. Command Palette → "Templater: Open insert template modal" → `StackEd Article`
3. Prompt: enter `Climate Battery`

Expected:
- Folder `Climate Battery/` exists in vault
- Subfolders `Climate Battery/artwork/` and `Climate Battery/research/` exist
- File is at `Climate Battery/Climate Battery.md`
- File content starts with `---` and contains all 7 YAML fields with `TITLE: "Climate Battery"`

Verify folder structure:
```bash
ls ~/Obsidian/O_Substack/Climate\ Battery/
# Expected: Climate Battery.md  artwork/  research/
```

- [ ] **Step 3: Test B — file with existing YAML (simulates Android sync arrival)**

1. Create a new note at vault root named `Solar Sail`
2. Manually add this content and save:
```yaml
---
SPARK: ""
TITLE: "Solar Sail"
SUBTITLE: ""
HOOK: ""
LANDING: ""
created: "2026-06-08"
updated: "2026-06-08"
---

My initial thoughts here.
```
3. Run `StackEd Article` template on this file

Expected:
- No title prompt appears (TITLE read from YAML silently)
- Folder `Solar Sail/` with `artwork/` and `research/` subfolders created
- File moved to `Solar Sail/Solar Sail.md`
- File content is **identical to original** — existing YAML and body preserved

- [ ] **Step 4: Test C — already scaffolded file (idempotency)**

1. Open `Climate Battery/Climate Battery.md` (created in Test A)
2. Run `StackEd Article` template again

Expected:
- Nothing happens — no prompt, no folders created, no file moved
- File unchanged

- [ ] **Step 5: Test D — file in _Templates is ignored**

1. Open `_Templates/Hero Prompt.md`
2. Run `StackEd Article` template on it

Expected:
- Nothing happens — `_Templates` path causes silent early return

- [ ] **Step 6: Test E — title with special characters**

1. Create new note at vault root
2. Run template, enter title `What's Next? A Review`

Expected:
- Folder name is `What-s Next- A Review` (`:`, `?` replaced with `-`)
- File at `What-s Next- A Review/What-s Next- A Review.md`

- [ ] **Step 7: Configure trigger_on_file_creation**

In Obsidian:
1. Settings → Community Plugins → Templater → Settings
2. Enable **"Trigger Templater on new file creation"**
3. Set the template to `_Templates/StackEd Article`

This causes the Mac scaffold template to fire automatically whenever a new `.md` file arrives in the vault (including via Sync from Android). The `_*` guard and idempotency checks in the template protect all other vault content.

- [ ] **Step 8: Test F — trigger_on_file_creation with _* path**

1. Create a new note inside `_Reference/`
2. Verify the scaffold template fires but exits silently (no prompt, no scaffold)

Expected: new note stays flat in `_Reference/`, untouched.

- [ ] **Step 9: Clean up test files**

```bash
rm -rf ~/Obsidian/O_Substack/Climate\ Battery
rm -rf ~/Obsidian/O_Substack/Solar\ Sail
rm -rf ~/Obsidian/O_Substack/What-s\ Next-\ A\ Review
```

- [ ] **Step 10: Confirm file saved**

```bash
ls -la ~/Obsidian/O_Substack/_Templates/StackEd\ Article.md
# Expected: today's date in the modification timestamp
```

---

## Task 3: YAML Sync Script

**Files:**
- Create: `~/Obsidian/O_Substack/_Templates/Sync Tags to YAML.md`

- [ ] **Step 1: Create the template file**

Write the following to `~/Obsidian/O_Substack/_Templates/Sync Tags to YAML.md`:

```
<%*
const file = app.workspace.getActiveFile();
if (!file) {
  new Notice("Sync Tags: open a note first.");
  return;
}

const content = await app.vault.read(file);
const today   = tp.date.now("YYYY-MM-DD");

// Strip frontmatter block to isolate body text
const fmMatch = content.match(/^---[\s\S]*?\n---\n?/);
const body    = fmMatch ? content.slice(fmMatch[0].length) : content;

// Collect tagged lines — last occurrence of each tag wins
const tags  = {};
const tagRe = /^(TITLE|SUBTITLE|HOOK|LANDING|SPARK):\s*(.+)$/gm;
let m;
while ((m = tagRe.exec(body)) !== null) {
  if (m[2].trim()) tags[m[1]] = m[2].trim();
}

// No tags at all → entire body text becomes SPARK
if (!Object.keys(tags).length && body.trim()) {
  tags['SPARK'] = body.trim();
}

if (!Object.keys(tags).length) {
  new Notice("Sync Tags: nothing to backfill.");
  return;
}

// If no frontmatter yet, create the 7-field skeleton first
if (!content.trimStart().startsWith('---')) {
  await app.fileManager.processFrontMatter(file, fm => {
    fm.SPARK    = '';
    fm.TITLE    = '';
    fm.SUBTITLE = '';
    fm.HOOK     = '';
    fm.LANDING  = '';
    fm.created  = today;
    fm.updated  = today;
  });
}

// Backfill only the fields that have tags — never delete untouched fields
await app.fileManager.processFrontMatter(file, fm => {
  for (const [k, v] of Object.entries(tags)) fm[k] = v;
  fm.updated = today;
});

new Notice(`✓ Synced: ${Object.keys(tags).join(', ')}`);
-%>
```

- [ ] **Step 2: Test A — body with multiple tags**

1. Open (or create) a scaffolded article file with this body (after any existing YAML):
```
TITLE: The Battery That Thinks
SUBTITLE: Why thermal mass is the quiet revolution
Some random untagged notes here.
HOOK: We've been storing energy wrong for decades.
```
2. Command Palette → "Templater: Open insert template modal" → `Sync Tags to YAML`

Expected:
- Notice shows: `✓ Synced: TITLE, SUBTITLE, HOOK`
- YAML fields updated:
  - `TITLE: "The Battery That Thinks"`
  - `SUBTITLE: "Why thermal mass is the quiet revolution"`
  - `HOOK: "We've been storing energy wrong for decades."`
- `LANDING` and `SPARK` YAML fields **unchanged**
- `updated` field set to today

- [ ] **Step 3: Test B — no tags, whole body becomes SPARK**

1. Create a new plain note (no YAML) with only this body:
```
Interesting idea about how cities deal with heat islands. Maybe tie in to urban planning failures.
```
2. Run `Sync Tags to YAML`

Expected:
- YAML skeleton created (all 7 fields)
- `SPARK` = `"Interesting idea about how cities deal with heat islands. Maybe tie in to urban planning failures."`
- Other fields blank
- Notice: `✓ Synced: SPARK`

- [ ] **Step 4: Test C — tag deleted on re-run (preservation rule)**

Continuing from Test A:
1. Remove the `HOOK: ...` line from the body
2. Run `Sync Tags to YAML` again

Expected:
- `HOOK` YAML field **still contains** `"We've been storing energy wrong for decades."`
- Only `TITLE` and `SUBTITLE` are in the sync notice (HOOK not re-synced, but not cleared)

- [ ] **Step 5: Test D — empty tag value not written**

1. Edit the body so it contains:
```
TITLE: 
SUBTITLE: Still here
```
2. Run `Sync Tags to YAML`

Expected:
- `TITLE` YAML field **unchanged** (empty tag value skipped)
- `SUBTITLE` updated to `"Still here"`
- Notice: `✓ Synced: SUBTITLE`

- [ ] **Step 6: Test E — last tag wins for duplicates**

1. Edit body to contain:
```
TITLE: First Title
TITLE: Second Title
```
2. Run `Sync Tags to YAML`

Expected:
- `TITLE` YAML = `"Second Title"`

- [ ] **Step 7: Confirm file saved**

```bash
ls ~/Obsidian/O_Substack/_Templates/
# Expected: Sync Tags to YAML.md now present in the list
```

---

## Task 4: End-to-End Verification

- [ ] **Step 1: Full Android → Mac flow**

Simulate the Android → Sync → Mac flow:

1. In Obsidian Mac, create a note in the vault root (don't run any template)
2. Manually write the content an Android template would produce:
```yaml
---
SPARK: ""
TITLE: "Grid Independence"
SUBTITLE: ""
HOOK: ""
LANDING: ""
created: "2026-06-08"
updated: "2026-06-08"
---

```
3. Run `StackEd Article` manually (simulating trigger_on_file_creation)

Expected:
- No title prompt
- Folder `Grid Independence/` with `artwork/` and `research/`
- File at `Grid Independence/Grid Independence.md`
- YAML and body content preserved exactly

- [ ] **Step 2: Full tag evolution flow**

Continuing with `Grid Independence/Grid Independence.md`:

1. Add tags to the body:
```
SUBTITLE: Why the grid is becoming optional
HOOK: Most people think of solar as backup power. It's not.
```
2. Run `Sync Tags to YAML`

Expected:
- `SUBTITLE` and `HOOK` updated in YAML
- `TITLE: "Grid Independence"` unchanged
- `SPARK` unchanged

3. Delete `HOOK:` line from body
4. Run `Sync Tags to YAML` again

Expected:
- `HOOK` YAML field still contains `"Most people think of solar as backup power. It's not."`

- [ ] **Step 3: Clean up**

```bash
rm -rf ~/Obsidian/O_Substack/Grid\ Independence
```

- [ ] **Step 4: Commit plan and spec to StackEd2.0 repo**

```bash
git add docs/superpowers/specs/2026-06-08-obsidian-workflow-design.md
git add docs/superpowers/plans/2026-06-08-obsidian-workflow.md
git commit -m "docs: add Obsidian workflow spec and implementation plan"
```
