import { describe, it, expect, beforeEach, vi } from 'vitest';

const upserted: Array<Record<string, unknown>> = [];
let pruned: Array<Record<string, unknown>> = [];

vi.mock('./storage', () => ({
  upsertLibraryEntry: vi.fn(async (entry: Record<string, unknown>) => {
    upserted.push(entry);
  }),
  pruneLibraryEntries: vi.fn(async () => [...pruned]),
}));

import { upsertLibraryEntryForScaffold, loadLibrary } from './library';
import { emptyScaffold, isPostPayload, isNotePayload, type Scaffold } from '$lib/types/scaffold';

function readyPost(): Scaffold {
  const s = emptyScaffold('post');
  if (isPostPayload(s.payload)) {
    s.payload.draft_title = 'Ready Post';
    s.payload.draft_subtitle = 'The subtitle';
    s.payload.draft_body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one two three' }] }],
    };
    s.payload.search_engine_title = 'SEO';
    s.payload.search_engine_description = 'Desc';
    s.payload.slug = 'ready-post';
    s.payload.tags = ['tag'];
  }
  s.remote.publication = 'myblog';
  s.workshop.targetDate = '2026-10-12';
  s.updated = '2026-09-19T10:00:00.000Z';
  return s;
}

describe('library service', () => {
  beforeEach(() => {
    upserted.splice(0, upserted.length);
    pruned = [{ filePath: '/tmp/a.stacked.json' }];
  });

  it('derives a LibraryEntry from a saved scaffold', async () => {
    await upsertLibraryEntryForScaffold('/tmp/a.stacked.json', readyPost());
    expect(upserted).toHaveLength(1);
    expect(upserted[0]).toEqual({
      filePath: '/tmp/a.stacked.json',
      title: 'Ready Post',
      subtitle: 'The subtitle',
      state: 'ready',
      targetDate: '2026-10-12',
      publication: 'myblog',
      updated: '2026-09-19T10:00:00.000Z',
      wordCount: 3,
    });
  });

  it('labels notes as Note and counts note body words', async () => {
    const s = emptyScaffold('note');
    if (isNotePayload(s.payload)) {
      s.payload.bodyJson = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello world' }] }],
      };
    }
    await upsertLibraryEntryForScaffold('/tmp/note.stacked.json', s);
    expect(upserted[0].title).toBe('Note');
    expect(upserted[0].subtitle).toBe('');
    expect(upserted[0].state).toBe('ready');
    expect(upserted[0].wordCount).toBe(2);
  });

  it('loadLibrary returns the pruned index', async () => {
    const entries = await loadLibrary();
    expect(entries).toEqual([{ filePath: '/tmp/a.stacked.json' }]);
  });
});
