import { describe, it, expect } from 'vitest';
import { emptyScaffold, isPostPayload, isNotePayload, type Scaffold } from '$lib/types/scaffold';
import { documentState } from './documentState';

function readyPost(): Scaffold {
  const s = emptyScaffold('post');
  if (isPostPayload(s.payload)) {
    const p = s.payload;
    p.draft_title = 'Complete Post';
    p.draft_subtitle = 'Subtitle';
    p.draft_body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body text' }] }],
    };
    p.draft_bylines = [{ id: 1, publicationUserId: 2 }];
    p.search_engine_title = 'SEO Title';
    p.search_engine_description = 'SEO desc';
    p.slug = 'complete-post';
    p.tags = ['tag1'];
  }
  return s;
}

describe('documentState', () => {
  it('derives draft from an empty scaffold', () => {
    expect(documentState(emptyScaffold('post'))).toBe('draft');
  });

  it('derives ready when no blocking readiness checks remain', () => {
    expect(documentState(readyPost())).toBe('ready');
  });

  it('derives scheduled from remote.scheduled, ahead of ready', () => {
    const s = readyPost();
    s.remote.scheduled = true;
    expect(documentState(s)).toBe('scheduled');
  });

  it('derives published from remote.publishedAt, ahead of scheduled', () => {
    const s = readyPost();
    s.remote.scheduled = true;
    s.remote.publishedAt = '2026-09-19T09:00:00.000Z';
    expect(documentState(s)).toBe('published');
  });

  it('derives ready for a note with body content', () => {
    const s = emptyScaffold('note');
    if (isNotePayload(s.payload)) {
      s.payload.bodyJson = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note text' }] }],
      };
    }
    expect(documentState(s)).toBe('ready');
  });
});
