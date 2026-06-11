# Vault Hierarchy Rename — Spec

**Date:** 2026-06-11
**Status:** Approved

---

## Problem

The `O_Substack` vault has a clear 5-level hierarchy, but the naming convention gives no signal about which level you're looking at. Two specific problems:

1. **Article folder and manuscript share the same name.** `The Leprechaun Conundrum/The Leprechaun Conundrum.md` — folder and file are indistinguishable in paths and in AI conversation context.
2. **Article-level scaffolding is inconsistent.** Section-level scaffolding uses `_artwork/` (correct), but article-level uses bare `artwork/` and `research/` (no underscore). Some articles are also missing one or both scaffolding folders entirely.

The Section level was added on-the-fly and was never documented. It is now the canonical structure.

---

## Naming Convention

| Level | Prefix | Example |
|---|---|---|
| Top-level scaffolding | `_*` | `_Templates/`, `_Inbox/` |
| Section folders | `S_*` | `S_Handshake/`, `S_NOTA/` |
| Article folders | `A_*` | `A_The Leprechaun Conundrum/` |
| Article manuscript | (none) | `The Leprechaun Conundrum.md` |
| Article scaffolding | `_*` | `_artwork/`, `_research/` |

A fully-qualified path is now unambiguous at every level:

```
O_Substack/S_Handshake/A_The Leprechaun Conundrum/The Leprechaun Conundrum.md
```

Section-level `_artwork/` folders (e.g. `S_Handshake/_artwork/`) are already correctly named — no change.

---

## Scope of Changes

### Vault renames

- **6 section folders** renamed: `Handshake` → `S_Handshake`, `NOTA` → `S_NOTA`, `Subtext` → `S_Subtext`, `Wonder` → `S_Wonder`, `Inspired` → `S_Inspired`, `EDC Adventures` → `S_EDC Adventures`
- **118 article folders** renamed: `{title}` → `A_{title}`
- **85 article-level scaffolding folders** renamed: `artwork` → `_artwork`, `research` → `_research`
- **Missing scaffolding created**: any article folder missing `_artwork` or `_research` gets them created
- **Stray empty folder deleted**: `NOTA/artwork/` (empty, misfired scaffold run)

### StackEd code changes

Three files, all changing `"artwork"` → `"_artwork"`:

**`src-tauri/src/file_io.rs`**
- `article_dir.join("artwork")` → `article_dir.join("_artwork")`
- `article_folder.join("artwork")` in `article_folder_paths` → `article_folder.join("_artwork")`

**`src/lib/services/files.ts`**
- `` `${articleFolder}/artwork` `` → `` `${articleFolder}/_artwork` ``

**`src/lib/components/artwork/ArtworkPanel.svelte`**
- Display label `./artwork` → `./_artwork`

### Templater script changes (`_Templates/StackEd Article.md`)

**Folder creation:**
```js
for (const p of [`A_${safeTitle}`, `A_${safeTitle}/_artwork`, `A_${safeTitle}/_research`]) {
  try { await app.vault.createFolder(p); } catch (_) {}
}
```

**File move target:**
```js
await tp.file.move(`A_${safeTitle}/${safeTitle}`);
```

**Idempotency guard:**
```js
if (parentName === `A_${tp.file.title}`) return;
```

The `_*` path guard is unchanged — S_/A_ prefixes won't trigger it.

**Android template (`_Templates/StackEd Article (Android).md`)** — no changes needed.

---

## Migration Script

A shell script run once against the live vault. Behaviour:

- `--dry-run` flag: prints every action, touches nothing
- No flag: executes

**Per article folder (children renamed before parent to keep paths valid):**
1. Rename `artwork` → `_artwork` (if `artwork` exists)
2. Rename `research` → `_research` (if `research` exists)
3. Create `_artwork` if neither `artwork` nor `_artwork` exists
4. Create `_research` if neither `research` nor `_research` exists
5. Rename `{title}` → `A_{title}`

**Then rename all 6 section folders.**

**Guards:**
- Skips folders already prefixed correctly (idempotent — safe to re-run)
- Won't create scaffolding that already exists
- Won't delete non-empty folders
- Prints every action taken

---

## Migration Sequence

Order matters:

1. StackEd code changes + build
2. Smoke test: open an article in StackEd, confirm artwork panel still loads
3. `--dry-run` the migration script, review output
4. Close Obsidian on all devices
5. Run migration script
6. Reopen Obsidian — let it re-index
7. Run post-migration test checklist

---

## Test Checklist

- Open StackEd, load an article with artwork — confirm images appear
- Create a new article via Cmd+N — confirm scaffold is `A_{title}/`, `A_{title}/_artwork/`, `A_{title}/_research/`
- Open Obsidian, confirm file explorer shows `S_Handshake/A_The Leprechaun Conundrum/The Leprechaun Conundrum.md`
- Run Mac Templater on an already-scaffolded article — confirm it exits silently (idempotency guard)
