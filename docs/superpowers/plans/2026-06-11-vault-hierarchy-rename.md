# Vault Hierarchy Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the O_Substack vault to use `S_*` section folders, `A_*` article folders, and `_artwork`/`_research` scaffolding, then migrate the live vault in one safe pass.

**Architecture:** Four code changes (Rust backend, TS service, Svelte component, Obsidian Templater) are made first so StackEd immediately understands the new layout. A shell migration script then renames all existing vault folders in one idempotent pass: children before parents, dry-run before live.

**Tech Stack:** Rust (Tauri backend), TypeScript/Svelte (StackEd frontend), bash (migration script), Obsidian Templater (JS).

---

## File Map

| File | Change |
|---|---|
| `src-tauri/src/file_io.rs` | `find_artwork_dir`: `"artwork"` → `"_artwork"`. `article_folder_paths`: `"artwork"` → `"_artwork"`, folder prefix `title` → `A_{title}`, idempotency check updated. Tests updated. |
| `src/lib/services/files.ts` | `getArticlePathForNewFile`: `artwork` → `_artwork`, folder prefix `title` → `A_{title}`, idempotency check updated. |
| `src/lib/components/artwork/ArtworkPanel.svelte` | Display labels `./artwork` → `./_artwork` (two places). |
| `~/Obsidian/O_Substack/_Templates/StackEd Article.md` | Folder creation, move target, and idempotency guard updated. |
| `scripts/migrate-vault-hierarchy.sh` | New file. Renames all vault folders from old to new convention. |

---

## Task 1: Rust — update `find_artwork_dir` to `_artwork`

**Files:**
- Modify: `src-tauri/src/file_io.rs:134` (implementation)
- Modify: `src-tauri/src/file_io.rs:386-407` (test)

- [ ] **Step 1: Update the existing test to expect `_artwork`**

In `src-tauri/src/file_io.rs`, find `test_find_artwork_dir_finds_article_own_folder` (line ~386) and change:

```rust
#[test]
fn test_find_artwork_dir_finds_article_own_folder() {
    let root = std::env::temp_dir().join(format!(
        "stacked-artwork-test-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let article_dir = root.join("I Can Burn a Rainbow");
    let artwork_dir = article_dir.join("_artwork");       // was "artwork"
    let section_artwork_dir = root.join("_artwork");      // was "artwork"
    std::fs::create_dir_all(&artwork_dir).unwrap();
    std::fs::create_dir_all(&section_artwork_dir).unwrap();

    let article_path = article_dir.join("I Can Burn a Rainbow.md");
    let found = find_artwork_dir(Some(article_path.to_str().unwrap())).unwrap();

    assert_eq!(found, Some(artwork_dir));
    std::fs::remove_dir_all(root).unwrap();
}
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd src-tauri && cargo test test_find_artwork_dir_finds_article_own_folder -- --nocapture 2>&1 | tail -10
```

Expected: FAIL — test creates `_artwork` dir but `find_artwork_dir` still looks for `artwork`.

- [ ] **Step 3: Update `find_artwork_dir` implementation**

In `src-tauri/src/file_io.rs` line 134, change:

```rust
        let candidate = article_dir.join("_artwork");
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd src-tauri && cargo test test_find_artwork_dir_finds_article_own_folder -- --nocapture 2>&1 | tail -5
```

Expected: `test test_find_artwork_dir_finds_article_own_folder ... ok`

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/file_io.rs
git commit -m "feat: find_artwork_dir looks for _artwork subfolder"
```

---

## Task 2: Rust — update `article_folder_paths` to `A_` prefix + `_artwork`

**Files:**
- Modify: `src-tauri/src/file_io.rs:181-202` (implementation)
- Modify: `src-tauri/src/file_io.rs:479-543` (two pipeline tests)

- [ ] **Step 1: Update the two pipeline tests to expect the new layout**

Find `test_organize_pipeline_article_moves_flat_file_and_creates_artwork` (line ~479) and replace entirely:

```rust
#[test]
fn test_organize_pipeline_article_moves_flat_file_and_creates_artwork() {
    let root = std::env::temp_dir().join(format!(
        "stacked-pipeline-test-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&root).unwrap();
    let article_path = root.join("Checkmate.md");
    std::fs::write(&article_path, "article").unwrap();

    let final_path = organize_pipeline_article(
        article_path.to_string_lossy().to_string(),
        root.to_string_lossy().to_string(),
    )
    .unwrap();
    let expected_path = root.join("A_Checkmate").join("Checkmate.md");

    assert_eq!(
        final_path,
        std::fs::canonicalize(&expected_path)
            .unwrap()
            .to_string_lossy()
            .to_string()
    );
    assert!(!article_path.exists());
    assert_eq!(std::fs::read_to_string(&expected_path).unwrap(), "article");
    assert!(root.join("A_Checkmate").join("_artwork").is_dir());

    std::fs::remove_dir_all(root).unwrap();
}
```

Find `test_organize_pipeline_article_keeps_structured_file_and_creates_artwork` (line ~513) and replace entirely:

```rust
#[test]
fn test_organize_pipeline_article_keeps_structured_file_and_creates_artwork() {
    let root = std::env::temp_dir().join(format!(
        "stacked-pipeline-structured-test-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    // Article already in A_* folder — should stay put, get _artwork created
    let article_dir = root.join("A_Checkmate");
    std::fs::create_dir_all(&article_dir).unwrap();
    let article_path = article_dir.join("Checkmate.md");
    std::fs::write(&article_path, "article").unwrap();

    let final_path = organize_pipeline_article(
        article_path.to_string_lossy().to_string(),
        root.to_string_lossy().to_string(),
    )
    .unwrap();

    assert_eq!(
        final_path,
        std::fs::canonicalize(&article_path)
            .unwrap()
            .to_string_lossy()
            .to_string()
    );
    assert_eq!(std::fs::read_to_string(&article_path).unwrap(), "article");
    assert!(article_dir.join("_artwork").is_dir());

    std::fs::remove_dir_all(root).unwrap();
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd src-tauri && cargo test test_organize_pipeline -- --nocapture 2>&1 | tail -15
```

Expected: both pipeline tests FAIL.

- [ ] **Step 3: Update `article_folder_paths` implementation**

Replace the function body (lines 181–202) with:

```rust
fn article_folder_paths(path: &Path) -> Result<(PathBuf, PathBuf, String), String> {
    let title = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| format!("failed to derive article title for {}", path.display()))?
        .to_string();
    let parent = path.parent().unwrap_or_else(|| Path::new(""));
    let parent_name = parent
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("");
    // Already in correct folder if parent matches bare title (pre-migration) or A_{title} (post-migration)
    let article_folder = if parent_name == title || parent_name == format!("A_{}", title) {
        parent.to_path_buf()
    } else {
        parent.join(format!("A_{}", title))
    };
    Ok((
        article_folder.join(format!("{}.md", title)),
        article_folder.join("_artwork"),
        title,
    ))
}
```

- [ ] **Step 4: Run all Rust tests**

```bash
cd src-tauri && cargo test 2>&1 | tail -20
```

Expected: all tests pass. If `test_organize_pipeline_article_keeps_structured_file_and_creates_artwork` fails, verify the test uses `A_Checkmate` as the folder name.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/file_io.rs
git commit -m "feat: article_folder_paths uses A_ prefix and _artwork"
```

---

## Task 3: TypeScript — update `getArticlePathForNewFile` + ArtworkPanel labels

**Files:**
- Modify: `src/lib/services/files.ts:76-88`
- Modify: `src/lib/components/artwork/ArtworkPanel.svelte:45,62`

- [ ] **Step 1: Update `getArticlePathForNewFile` in `files.ts`**

Replace lines 76–88:

```typescript
function getArticlePathForNewFile(selectedPath: string): { articlePath: string; artworkPath: string; title: string } {
  const fileName = getFileName(selectedPath);
  const title = titleFromFileName(fileName);
  const parent = getFolderPath(selectedPath);
  const parentName = getFileName(parent);
  // Already in correct folder if parent matches bare title (pre-migration) or A_{title} (post-migration)
  const articleFolder = (parentName === title || parentName === `A_${title}`)
    ? parent
    : parent ? `${parent}/A_${title}` : `A_${title}`;

  return {
    articlePath: `${articleFolder}/${title}.md`,
    artworkPath: `${articleFolder}/_artwork`,
    title,
  };
}
```

- [ ] **Step 2: Update display labels in `ArtworkPanel.svelte`**

Line 45 — change:
```svelte
      <p class="text-xs text-dark-500">./_artwork</p>
```

Line 62 — change:
```svelte
      <p class="text-sm text-dark-400">No images found in <code>./_artwork</code>.</p>
```

- [ ] **Step 3: Run the TypeScript test suite**

```bash
npm run test 2>&1 | tail -15
```

Expected: all tests pass (no tests directly cover `getArticlePathForNewFile`, but verify nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/files.ts src/lib/components/artwork/ArtworkPanel.svelte
git commit -m "feat: new articles use A_ folder prefix and _artwork path"
```

---

## Task 4: Build and smoke-test StackEd

- [ ] **Step 1: Build the Tauri app**

```bash
npm run tauri build 2>&1 | tail -20
```

Expected: build succeeds with no errors.

If build fails on the Rust side, run `cd src-tauri && cargo build 2>&1 | grep error` to isolate.

- [ ] **Step 2: Smoke test artwork loading**

Open StackEd. Load an article that lives inside a folder with an `artwork/` subfolder (pre-migration, bare name). Verify:
- Artwork panel loads and shows images
- No error in the panel

This confirms `find_artwork_dir` still resolves `artwork/` for existing pre-migration folders (the function only looks for `_artwork` — so pre-migration folders won't show artwork after migration, which is expected and correct — the migration fixes this).

Actually, to confirm the NEW path works: create a test article via Cmd+N, navigate to any section folder, save as `Test Article.md`. Verify in Finder that `A_Test Article/_artwork/` was created. Then delete it.

---

## Task 5: Update Mac Templater script

**Files:**
- Modify: `~/Obsidian/O_Substack/_Templates/StackEd Article.md`

- [ ] **Step 1: Update the three changed lines**

Replace the entire template file content with:

```
<%*
// Guard: never scaffold _* paths (templates, reference, scripts, etc.)
const relPath = tp.file.path(true);
if (relPath.split('/').some(p => p.startsWith('_'))) return;

// Guard: already in A_{name}/{name} structure — nothing to do
const parts      = relPath.split('/');
const parentName = parts.length >= 2 ? parts[parts.length - 2] : '';
if (parentName === `A_${tp.file.title}`) return;

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
const today     = tp.date.now("YYYY-MM-DD");

// Rename, create bundle folders, move
await tp.file.rename(safeTitle);
for (const p of [`A_${safeTitle}`, `A_${safeTitle}/_artwork`, `A_${safeTitle}/_research`]) {
  try { await app.vault.createFolder(p); } catch (_) {}
}
await tp.file.move(`A_${safeTitle}/${safeTitle}`);

// Output: preserve existing content, or write fresh YAML
if (hasYaml) {
  tR += existing;
} else {
  const yamlTitle = safeTitle.replace(/"/g, '\\"');
  tR += `---\nTITLE: "${yamlTitle}"\nSUBTITLE: ""\nSECTION: ""\ncreated: "${now}"\nupdated: "${now}"\nstage: SP\nstage_log: "SP:${today}"\nSPARK: ""\nHOOK: ""\nLANDING: ""\n---\n\n`;
}
-%>
```

- [ ] **Step 2: Test the template on a throwaway note**

In Obsidian (Mac), create a new note in any section folder. Run `Templater: Open Insert Template Modal`, select `StackEd Article`. Verify:
- Prompted for title
- File moved to `A_{title}/{title}.md`
- `_artwork/` and `_research/` created inside `A_{title}/`

Delete the test note and its folder after verifying.

- [ ] **Step 3: Test idempotency guard**

Open an already-scaffolded article (e.g. `S_Handshake/A_The Leprechaun Conundrum/The Leprechaun Conundrum.md` — after migration). Run the Templater again. Verify it exits silently with no changes.

- [ ] **Step 4: Commit StackEd changes**

```bash
git add src-tauri/src/file_io.rs src/lib/services/files.ts src/lib/components/artwork/ArtworkPanel.svelte
git commit -m "chore: confirm all StackEd changes committed before migration"
```

(This step is a safety check — if Tasks 1–3 were committed incrementally, `git status` should show clean. Skip if already clean.)

---

## Task 6: Write migration script

**Files:**
- Create: `scripts/migrate-vault-hierarchy.sh`

- [ ] **Step 1: Create the script**

Create `scripts/migrate-vault-hierarchy.sh`:

```bash
#!/usr/bin/env bash
# Migrates O_Substack vault to the S_*/A_*/_scaffold naming convention.
# Usage:
#   ./scripts/migrate-vault-hierarchy.sh --dry-run   # preview only
#   ./scripts/migrate-vault-hierarchy.sh             # execute
set -euo pipefail

VAULT="$HOME/Obsidian/O_Substack"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

do_rename() {
  local src="${1%/}" dst="${2%/}"
  if [[ ! -e "$src" ]]; then
    echo "SKIP (source gone): $src"
    return
  fi
  if [[ -e "$dst" ]]; then
    echo "SKIP (dst exists): $dst"
    return
  fi
  if $DRY_RUN; then
    echo "RENAME: $src  =>  $dst"
  else
    mv "$src" "$dst"
    echo "RENAMED: $(basename "$src")  =>  $(basename "$dst")"
  fi
}

do_mkdir() {
  local dir="${1%/}"
  if [[ -d "$dir" ]]; then
    return
  fi
  if $DRY_RUN; then
    echo "CREATE: $dir"
  else
    mkdir -p "$dir"
    echo "CREATED: $dir"
  fi
}

do_rmdir_if_empty() {
  local dir="${1%/}"
  if [[ ! -d "$dir" ]]; then
    return
  fi
  if [[ -z "$(ls -A "$dir")" ]]; then
    if $DRY_RUN; then
      echo "DELETE (empty): $dir"
    else
      rmdir "$dir"
      echo "DELETED: $dir"
    fi
  else
    echo "SKIP delete (not empty): $dir"
  fi
}

echo "=== Vault hierarchy migration ==="
$DRY_RUN && echo "=== DRY RUN — no changes will be made ===" || echo "=== LIVE RUN ==="
echo ""

# Remove stray empty NOTA/artwork folder
do_rmdir_if_empty "$VAULT/NOTA/artwork"

# Process each section folder
for section_dir in "$VAULT"/*/; do
  section_name="$(basename "${section_dir%/}")"

  # Skip hidden, scaffolding (_*), and already-migrated (S_*) folders
  [[ "$section_name" == .* ]] && continue
  [[ "$section_name" == _* ]] && continue
  [[ "$section_name" == S_* ]] && continue

  # Process article folders within the section
  for article_dir in "$section_dir"*/; do
    [[ ! -d "$article_dir" ]] && continue           # guard against empty glob
    article_name="$(basename "${article_dir%/}")"

    # Skip hidden, scaffolding (_*), and already-migrated (A_*) folders
    [[ "$article_name" == .* ]] && continue
    [[ "$article_name" == _* ]] && continue
    [[ "$article_name" == A_* ]] && continue

    # 1. Rename artwork -> _artwork (children before parent)
    if [[ -d "$article_dir/artwork" ]] && [[ ! -d "$article_dir/_artwork" ]]; then
      do_rename "$article_dir/artwork" "$article_dir/_artwork"
    fi

    # 2. Rename research -> _research (children before parent)
    if [[ -d "$article_dir/research" ]] && [[ ! -d "$article_dir/_research" ]]; then
      do_rename "$article_dir/research" "$article_dir/_research"
    fi

    # 3. Create missing _artwork
    if [[ ! -d "$article_dir/_artwork" ]] && [[ ! -d "$article_dir/artwork" ]]; then
      do_mkdir "$article_dir/_artwork"
    fi

    # 4. Create missing _research
    if [[ ! -d "$article_dir/_research" ]] && [[ ! -d "$article_dir/research" ]]; then
      do_mkdir "$article_dir/_research"
    fi

    # 5. Rename article folder: {name} -> A_{name}
    do_rename "$article_dir" "${section_dir}A_${article_name}"
  done

  # 6. Rename section folder: {name} -> S_{name}
  do_rename "$section_dir" "${VAULT}/S_${section_name}"
done

echo ""
echo "=== Done ==="
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/migrate-vault-hierarchy.sh
```

- [ ] **Step 3: Commit the script**

```bash
git add scripts/migrate-vault-hierarchy.sh
git commit -m "feat: add vault hierarchy migration script"
```

---

## Task 7: Execute migration

- [ ] **Step 1: Dry run — review every action**

```bash
./scripts/migrate-vault-hierarchy.sh --dry-run 2>&1 | tee /tmp/migrate-dry-run.txt
wc -l /tmp/migrate-dry-run.txt
```

Review the output. Verify:
- 6 section RENAME lines (`Handshake` → `S_Handshake`, etc.)
- ~118 article RENAME lines
- ~85 scaffolding RENAME lines
- ~90+ CREATE lines (missing scaffolding being added)
- 1 DELETE line (stray `NOTA/artwork`)
- No unexpected entries

- [ ] **Step 2: Close Obsidian on all devices**

On Mac: quit Obsidian. On Pixel: force-stop Obsidian via Settings → Apps. Wait for Obsidian Sync to settle (30 seconds).

- [ ] **Step 3: Execute the migration**

```bash
./scripts/migrate-vault-hierarchy.sh 2>&1 | tee /tmp/migrate-live.txt
echo "Exit code: $?"
```

Expected: exit code 0, no error lines.

- [ ] **Step 4: Spot-check the result**

```bash
ls ~/Obsidian/O_Substack/
echo "---"
ls ~/Obsidian/O_Substack/S_Handshake/ | head -5
echo "---"
ls ~/Obsidian/O_Substack/S_Handshake/A_The\ Leprechaun\ Conundrum/
```

Expected:
```
_Inbox  _Logs  _Reference  _Samples  _Scripts  _Templates  S_EDC Adventures  S_Handshake  S_Inspired  S_NOTA  S_Subtext  S_Wonder
---
A_All the Stories Have Been Told
A_Bad food NEEDS Medicine Good food IS Medicine
...
---
_artwork  _research  The Leprechaun Conundrum.md  (possibly .stacked-backups)
```

- [ ] **Step 5: Reopen Obsidian and verify**

Open Obsidian on Mac. Let it re-index (may take 30–60 seconds). Verify:
- File explorer shows `S_Handshake/A_The Leprechaun Conundrum/The Leprechaun Conundrum.md`
- Open an article with artwork — confirm no errors
- Open StackEd, load the same article — confirm artwork panel shows images (if any exist in `_artwork/`)

- [ ] **Step 6: Test new article creation end-to-end**

In StackEd, create a new article (Cmd+N). Navigate to `S_Handshake/`. Save as `Test Migration.md`. Verify in Finder:
- `S_Handshake/A_Test Migration/Test Migration.md` exists
- `S_Handshake/A_Test Migration/_artwork/` exists

Delete `A_Test Migration/` afterwards.

- [ ] **Step 7: Test Mac Templater idempotency**

In Obsidian, open `S_Handshake/A_The Leprechaun Conundrum/The Leprechaun Conundrum.md`. Run the StackEd Article template. Confirm it exits silently (no re-scaffold, no errors).

- [ ] **Step 8: Final commit**

```bash
git add scripts/migrate-vault-hierarchy.sh
git commit -m "chore: vault hierarchy migration complete (S_*/A_*/_scaffold)"
```
