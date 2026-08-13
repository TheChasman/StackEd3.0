import { describe, it, expect } from 'vitest';
import {
  emptyScaffold,
  emptyPostPayload,
  emptyNotePayload,
  emptyWorkshop,
  isPostPayload,
  isNotePayload,
  isPostScaffold,
  isNoteScaffold,
  getBody,
  withBody,
  type Scaffold,
  type PMDoc,
} from '$lib/types/scaffold';
import {
  readiness,
  serializeScaffold,
  deserializeScaffold,
  scaffoldJsonPath,
  scaffoldMdMirrorPath,
} from './scaffold';

describe('emptyScaffold', () => {
  it('creates a post scaffold with sensible defaults', () => {
    const s = emptyScaffold('post');
    expect(s.kind).toBe('post');
    expect(s.id).toBeTruthy();
    expect(s.created).toBeTruthy();
    expect(s.updated).toBeTruthy();
    expect(s.remote).toEqual({ publication: '', draftId: null, scheduled: false });
    expect(s.locked).toEqual([]);
    expect(isPostPayload(s.payload)).toBe(true);
    expect(s.workshop).toEqual(emptyWorkshop());
  });

  it('creates a note scaffold with sensible defaults', () => {
    const s = emptyScaffold('note');
    expect(s.kind).toBe('note');
    expect(isNotePayload(s.payload)).toBe(true);
    expect(getBody(s)).toEqual({ type: 'doc', content: [] });
  });
});

describe('readiness', () => {
  it('blocks on empty post scaffold', () => {
    const s = emptyScaffold('post');
    const r = readiness(s);
    expect(r.blocking).toContain('draft_title is empty');
    expect(r.blocking).toContain('draft_body is empty');
    expect(r.advisory).toContain('draft_bylines is empty (auto-assigned on publish)');
  });

  it('blocks on missing SEO fields', () => {
    const s = emptyScaffold('post');
    const p = s.payload as ReturnType<typeof emptyPostPayload>;
    p.draft_title = 'Test Title';
    p.draft_body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }],
    };
    p.draft_bylines = [{ id: 1, publicationUserId: 2 }];
    const r = readiness(s);
    expect(r.blocking).toContain('search_engine_title is empty');
    expect(r.blocking).toContain('search_engine_description is empty');
    expect(r.blocking).toContain('slug is empty');
    expect(r.blocking).toContain('tags is empty');
    expect(r.advisory).toContain('draft_subtitle is empty');
  });

  it('passes when all blocking fields are filled', () => {
    const s = emptyScaffold('post');
    const p = s.payload as ReturnType<typeof emptyPostPayload>;
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
    const r = readiness(s);
    expect(r.blocking).toEqual([]);
    expect(r.advisory).toEqual([]);
  });

  it('blocks on empty note', () => {
    const s = emptyScaffold('note');
    if (isNotePayload(s.payload)) {
      s.payload.bodyJson = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note text' }] }],
      };
    }
    // Reset to empty for the test
    if (isNotePayload(s.payload)) {
      s.payload.bodyJson = { type: 'doc', content: [] };
    }
    const r = readiness(s);
    expect(r.blocking).toContain('bodyJson is empty');
  });

  it('passes when note has body content', () => {
    const s = emptyScaffold('note');
    if (isNotePayload(s.payload)) {
      s.payload.bodyJson = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note text' }] }],
      };
    }
    const r = readiness(s);
    expect(r.blocking).toEqual([]);
  });

  it('treats horizontal_rule as body content', () => {
    const s = emptyScaffold('post');
    const p = s.payload as ReturnType<typeof emptyPostPayload>;
    p.draft_title = 'T';
    p.draft_bylines = [{ id: 1, publicationUserId: 2 }];
    p.draft_body = { type: 'doc', content: [{ type: 'horizontal_rule' }] };
    const r = readiness(s);
    expect(r.blocking).not.toContain('draft_body is empty');
  });
});

describe('serialize/deserialize round-trip', () => {
  it('preserves a post scaffold through JSON round-trip', () => {
    const s = emptyScaffold('post');
    const p = s.payload as ReturnType<typeof emptyPostPayload>;
    p.draft_title = 'Round Trip';
    p.draft_body = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Body' }] }],
    };
    p.draft_bylines = [{ id: 10, publicationUserId: 20 }];
    p.tags = ['a', 'b'];

    const json = serializeScaffold(s);
    const restored = deserializeScaffold(json);

    expect(restored.id).toBe(s.id);
    expect(restored.kind).toBe(s.kind);
    expect(restored.payload).toEqual(s.payload);
    expect(restored.workshop).toEqual(s.workshop);
    expect(restored.remote).toEqual(s.remote);
  });

  it('preserves a note scaffold through JSON round-trip', () => {
    const s = emptyScaffold('note');
    if (isNotePayload(s.payload)) {
      s.payload.bodyJson = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Note' }] }],
      };
    }

    const json = serializeScaffold(s);
    const restored = deserializeScaffold(json);

    expect(restored.kind).toBe('note');
    expect(restored.payload).toEqual(s.payload);
  });

  it('throws on invalid scaffold', () => {
    expect(() => deserializeScaffold('{}')).toThrow();
    expect(() => deserializeScaffold('{"id":"x"}')).toThrow();
  });
});

describe('type guards', () => {
  it('isPostPayload / isNotePayload distinguish payload types', () => {
    expect(isPostPayload(emptyPostPayload())).toBe(true);
    expect(isNotePayload(emptyPostPayload())).toBe(false);
    expect(isNotePayload(emptyNotePayload())).toBe(true);
    expect(isPostPayload(emptyNotePayload())).toBe(false);
  });

  it('isPostScaffold / isNoteScaffold distinguish scaffold kinds', () => {
    expect(isPostScaffold(emptyScaffold('post'))).toBe(true);
    expect(isNoteScaffold(emptyScaffold('note'))).toBe(true);
    expect(isPostScaffold(emptyScaffold('note'))).toBe(false);
  });
});

describe('getBody / withBody', () => {
  it('gets and sets body for posts', () => {
    const s = emptyScaffold('post');
    const doc: PMDoc = { type: 'doc', content: [{ type: 'paragraph' }] };
    const updated = withBody(s, doc);
    expect(getBody(updated)).toEqual(doc);
  });

  it('gets and sets body for notes', () => {
    const s = emptyScaffold('note');
    const doc: PMDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }],
    };
    const updated = withBody(s, doc);
    expect(getBody(updated)).toEqual(doc);
  });
});

describe('path helpers', () => {
  it('scaffoldJsonPath converts .md to .stacked.json', () => {
    expect(scaffoldJsonPath('/foo/bar/article.md')).toBe('/foo/bar/article.stacked.json');
  });

  it('scaffoldJsonPath passes through .stacked.json', () => {
    expect(scaffoldJsonPath('/foo/article.stacked.json')).toBe('/foo/article.stacked.json');
  });

  it('scaffoldMdMirrorPath converts .stacked.json to .md', () => {
    expect(scaffoldMdMirrorPath('/foo/article.stacked.json')).toBe('/foo/article.md');
  });

  it('scaffoldMdMirrorPath passes through .md', () => {
    expect(scaffoldMdMirrorPath('/foo/article.md')).toBe('/foo/article.md');
  });
});
