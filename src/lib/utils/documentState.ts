// Derived document state — never hand-set (design spec §4.3):
// published > scheduled > ready > draft.
import type { Scaffold } from '$lib/types/scaffold';
import { readiness } from './scaffold';

export type DocumentState = 'draft' | 'ready' | 'scheduled' | 'published';

export function documentState(s: Scaffold): DocumentState {
  if (s.remote.publishedAt !== null) return 'published';
  if (s.remote.scheduled) return 'scheduled';
  if (readiness(s).blocking.length === 0) return 'ready';
  return 'draft';
}
