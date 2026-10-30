// Library index upkeep (design spec §4.4): derive a LibraryEntry from a
// scaffold and hand it to the storage layer. The index is a cache written on
// every successful save; it never holds document content.
import { invoke } from '@tauri-apps/api/core';
import type { Scaffold } from '$lib/types/scaffold';
import { getBody, isPostPayload } from '$lib/types/scaffold';
import { deserializeScaffold } from '$lib/utils/scaffold';
import { documentState } from '$lib/utils/documentState';
import { countPMDocWords } from '$lib/utils/pmText';
import {
  listLibraryEntries,
  pruneLibraryEntries,
  upsertLibraryEntry,
  type LibraryEntry,
} from './storage';

export async function upsertLibraryEntryForScaffold(
  filePath: string,
  scaffold: Scaffold,
): Promise<void> {
  const payload = scaffold.payload;
  await upsertLibraryEntry({
    filePath,
    title: isPostPayload(payload) ? payload.draft_title : 'Note',
    subtitle: isPostPayload(payload) ? payload.draft_subtitle : '',
    state: documentState(scaffold),
    targetDate: scaffold.workshop.targetDate ?? null,
    publication: scaffold.remote.publication,
    updated: scaffold.updated,
    wordCount: countPMDocWords(getBody(scaffold)),
  });
}

/** Verify a path through the Tauri backend (rejects in a plain browser). */
async function tauriFileExists(path: string): Promise<boolean> {
  return invoke<boolean>('file_exists', { path });
}

/**
 * Read the library index, pruning entries whose file has vanished. Without a
 * Tauri backend (plain browser dev) nothing can be verified, so the index is
 * listed unpruned rather than wiping entries we cannot check.
 */
export async function loadLibrary(): Promise<LibraryEntry[]> {
  try {
    return await pruneLibraryEntries(tauriFileExists);
  } catch {
    return listLibraryEntries();
  }
}

/**
 * List every `.stacked.json` path directly under `dir` or one level down
 * (matching the `<vault>/A_<Title>/<Title>.stacked.json` layout files.ts
 * creates). Dotfiles and article subfolders (`_artwork`, `_research`) are
 * never recursed into.
 */
async function listStackedJsonFiles(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = await invoke<string[]>('list_files', { path: dir });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const name of names) {
    if (name.startsWith('.') || name.startsWith('_')) continue;
    if (name.toLowerCase().endsWith('.stacked.json')) {
      files.push(`${dir}/${name}`);
      continue;
    }
    const nested = await invoke<string[]>('list_files', { path: `${dir}/${name}` }).catch(() => []);
    for (const nestedName of nested) {
      if (nestedName.toLowerCase().endsWith('.stacked.json')) {
        files.push(`${dir}/${name}/${nestedName}`);
      }
    }
  }
  return files;
}

/**
 * Scan the vault folder for `.stacked.json` drafts not yet in the library
 * index — e.g. drafts saved before the Library index existed, or files
 * added to the vault outside StackEd — and add them.
 */
export async function importVaultIntoLibrary(folderPath: string): Promise<void> {
  const known = new Set((await listLibraryEntries()).map((entry) => entry.filePath));
  const filePaths = await listStackedJsonFiles(folderPath);
  for (const filePath of filePaths) {
    if (known.has(filePath)) continue;
    try {
      const json = await invoke<string>('read_file', { path: filePath });
      const scaffold = deserializeScaffold(json);
      await upsertLibraryEntryForScaffold(filePath, scaffold);
    } catch {
      // Skip unreadable or malformed files.
    }
  }
}
