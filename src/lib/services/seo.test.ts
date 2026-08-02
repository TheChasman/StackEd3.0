import { describe, expect, it } from 'vitest';
import { emptyScaffold, isPostPayload, type Scaffold } from '$lib/types/scaffold';
import type { ArticleContext } from '$lib/services/ai/adapter';
import {
  applySeoDraft,
  buildSeoPrompt,
  canonicalizeTags,
  isSeoComplete,
  parseSeoDraftJson,
  type SeoDraft,
} from '$lib/services/seo';

const makePost = (): Scaffold => emptyScaffold('post');

const fillSeo = (scaffold: Scaffold): Scaffold => {
  if (isPostPayload(scaffold.payload)) {
    scaffold.payload.search_engine_title = 'Test SEO Title';
    scaffold.payload.search_engine_description = 'Test description';
    scaffold.payload.slug = 'test-slug';
    scaffold.payload.tags = ['tag1', 'tag2'];
  }
  return scaffold;
};

describe('isSeoComplete', () => {
  it('returns false for an empty scaffold', () => {
    expect(isSeoComplete(makePost())).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSeoComplete(null)).toBe(false);
  });

  it('returns true when all SEO fields are populated', () => {
    expect(isSeoComplete(fillSeo(makePost()))).toBe(true);
  });
});

describe('parseSeoDraftJson', () => {
  it('parses valid JSON SEO output', () => {
    expect(parseSeoDraftJson(`{
      "search_engine_title": "Partial Solution",
      "search_engine_description": "What effective policing really means.",
      "slug": "partial-solution",
      "tags": ["policing", "justice"]
    }`)).toEqual({
      search_engine_title: 'Partial Solution',
      search_engine_description: 'What effective policing really means.',
      slug: 'partial-solution',
      tags: ['policing', 'justice'],
    });
  });

  it('rejects incomplete JSON SEO output', () => {
    expect(() => parseSeoDraftJson('{"search_engine_title":"Only title"}'))
      .toThrow('SEO draft missing search_engine_description');
  });

  it('slugifies the slug and cleans tags', () => {
    const draft = parseSeoDraftJson(`{
      "search_engine_title": " Title ",
      "search_engine_description": " Description ",
      "slug": "Partial Solution!",
      "tags": [" Policing ", "", "Justice Reform", 42]
    }`);

    expect(draft).toEqual({
      search_engine_title: 'Title',
      search_engine_description: 'Description',
      slug: 'partial-solution',
      tags: ['Policing', 'Justice Reform'],
    });
  });
});

describe('canonicalizeTags', () => {
  it('maps tags onto existing vocabulary spellings case-insensitively', () => {
    expect(canonicalizeTags(['media theory', 'New Tag'], ['Media Theory', 'Justice']))
      .toEqual(['Media Theory', 'New Tag']);
  });

  it('deduplicates case-insensitively, preserving first-seen order', () => {
    expect(canonicalizeTags(['Policing', 'policing', 'Reform'])).toEqual(['Policing', 'Reform']);
  });
});

describe('applySeoDraft', () => {
  const draft: SeoDraft = {
    search_engine_title: 'AI title',
    search_engine_description: 'AI description',
    slug: 'ai-slug',
    tags: ['ai', 'ml'],
  };

  it('overwrites all four SEO fields, replacing author edits', () => {
    const scaffold = makePost();
    if (isPostPayload(scaffold.payload)) {
      scaffold.payload.search_engine_title = 'Manual SEO title';
    }
    const next = applySeoDraft(scaffold, draft);

    if (!isPostPayload(next.payload)) throw new Error('Expected post payload');
    expect(next.payload.search_engine_title).toBe('AI title');
    expect(next.payload.search_engine_description).toBe('AI description');
    expect(next.payload.slug).toBe('ai-slug');
    expect(next.payload.tags).toEqual(['ai', 'ml']);
  });

  it('respects locked field paths', () => {
    const scaffold = makePost();
    if (isPostPayload(scaffold.payload)) {
      scaffold.payload.slug = 'published-slug';
    }
    scaffold.locked = ['payload.slug'];
    const next = applySeoDraft(scaffold, draft);

    if (!isPostPayload(next.payload)) throw new Error('Expected post payload');
    expect(next.payload.slug).toBe('published-slug');
    expect(next.payload.search_engine_title).toBe('AI title');
  });

  it('canonicalises tags against the supplied vocabulary', () => {
    const next = applySeoDraft(makePost(), { ...draft, tags: ['ai'] }, ['AI']);
    if (!isPostPayload(next.payload)) throw new Error('Expected post payload');
    expect(next.payload.tags).toEqual(['AI']);
  });
});

describe('buildSeoPrompt', () => {
  it('includes title and body context', () => {
    const scaffold = makePost();
    if (isPostPayload(scaffold.payload)) {
      scaffold.payload.draft_title = 'Partial Solution';
    }
    const context: ArticleContext = {
      scaffold,
      bodyText: '# Draft\n\nBody copy.',
      filePath: '/tmp/Partial Solution.md',
    };
    const prompt = buildSeoPrompt(context);

    expect(prompt).toContain('Return only valid JSON');
    expect(prompt).toContain('Partial Solution');
    expect(prompt).toContain('Body copy.');
  });

  it('includes workshop candidates in the prompt', () => {
    const scaffold = makePost();
    scaffold.workshop.candidates.title = ['Lady Justice has Lost Her Blindfold'];
    scaffold.workshop.candidates.hook = ['The oath changed in 2002.'];
    const prompt = buildSeoPrompt({
      scaffold,
      bodyText: 'Article body.',
      filePath: '/tmp/test.md',
    });

    expect(prompt).toContain('Lady Justice has Lost Her Blindfold');
    expect(prompt).toContain('The oath changed in 2002.');
    expect(prompt).toContain('Alt title');
  });
});
