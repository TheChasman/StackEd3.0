// Library index upkeep (design spec §4.4): derive a LibraryEntry from a
// scaffold and hand it to the storage layer. The index is a cache written on
// every successful save; it never holds document content.
import type { Scaffold } from '$lib/types/scaffold';
import { getBody, isPostPayload } from '$lib/types/scaffold';
import { documentState } from '$lib/utils/documentState';
import { countPMDocWords } from '$lib/utils/pmText';
import { pruneLibraryEntries, upsertLibraryEntry, type LibraryEntry } from './storage';

export async function upsertLibraryEntryForScaffold(
  filePath: string,
  scaffold: Scaffold,
): Promise<void> {
  const post = isPostPayload(scaffold.payload);
  await upsertLibraryEntry({
    filePath,
    title: post ? scaffold.payload.draft_title : 'Note',
    subtitle: post ? scaffold.payload.draft_subtitle : '',
    state: documentState(scaffold),
    targetDate: scaffold.workshop.targetDate ?? null,
    publication: scaffold.remote.publication,
    updated: scaffold.updated,
    wordCount: countPMDocWords(getBody(scaffold)),
  });
}

/** Read the library index, pruning entries whose file has vanished. */
export async function loadLibrary(): Promise<LibraryEntry[]> {
  return pruneLibraryEntries();
}
