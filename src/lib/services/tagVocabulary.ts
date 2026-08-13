// Tag vocabulary source for SEO generation.
//
// Substack tags each generate a public archive page, so consistency across a
// publication matters far more than novelty. To keep the LLM from inventing a
// fresh tag per post, we feed it the publication's existing vocabulary, drawn
// from two sources and merged frequency-first:
//   1. Sibling .stacked.json files in the current article's directory (offline,
//      empty until several posts exist locally).
//   2. The authoritative publication tag list from Substack, cached to
//      localStorage on each publish so generation works offline afterwards.

import { invoke } from '@tauri-apps/api/core';
import { deserializeScaffold } from '$lib/utils/scaffold';
import { isPostPayload } from '$lib/types/scaffold';

const CACHE_PREFIX = 'stacked:tagvocab:';

function parentDir(filePath: string): string | null {
  const idx = filePath.lastIndexOf('/');
  if (idx < 0) return null;
  return filePath.slice(0, idx);
}

/** Read tags from every sibling .stacked.json in the file's directory. */
async function siblingTags(filePath: string | null): Promise<string[]> {
  if (!filePath) return [];
  const dir = parentDir(filePath);
  if (!dir) return [];

  let names: string[];
  try {
    names = await invoke<string[]>('list_files', { path: dir });
  } catch {
    return [];
  }

  const tags: string[] = [];
  for (const name of names) {
    if (!name.toLowerCase().endsWith('.stacked.json')) continue;
    try {
      const json = await invoke<string>('read_file', { path: `${dir}/${name}` });
      const scaffold = deserializeScaffold(json);
      if (isPostPayload(scaffold.payload)) tags.push(...scaffold.payload.tags);
    } catch {
      // Skip unreadable or malformed siblings.
    }
  }
  return tags;
}

/** Read the cached publication tag list from localStorage. */
export function cachedPublicationTags(publication: string): string[] {
  if (!publication) return [];
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + publication);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Persist the authoritative publication tag list. Called after a publish. */
export function cachePublicationTags(publication: string, tags: string[]): void {
  if (!publication) return;
  try {
    localStorage.setItem(CACHE_PREFIX + publication, JSON.stringify(tags));
  } catch {
    // Non-fatal: vocabulary caching is a nicety, not a requirement.
  }
}

/**
 * Merged tag vocabulary, frequency-first. Sibling occurrences drive the
 * ordering; cached publication tags are folded in so the authoritative list
 * is always represented. Deduplicated case-insensitively.
 */
export async function getTagVocabulary(
  filePath: string | null,
  publication: string,
): Promise<string[]> {
  const counts = new Map<string, { canonical: string; count: number }>();

  const add = (tag: string) => {
    const key = tag.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { canonical: tag, count: 1 });
  };

  for (const tag of await siblingTags(filePath)) add(tag);
  for (const tag of cachedPublicationTags(publication)) add(tag);

  return [...counts.values()].sort((a, b) => b.count - a.count).map((entry) => entry.canonical);
}
