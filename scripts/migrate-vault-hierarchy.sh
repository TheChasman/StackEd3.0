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
