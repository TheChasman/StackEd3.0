import { describe, expect, it } from 'vitest';
import { emptyScaffold, isPostPayload, type Scaffold } from '$lib/types/scaffold';
import type { ArticleContext } from '$lib/services/ai/adapter';
import {
  buildSeoPrompt,
  isSeoComplete,
  mergeSeoDraft,
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

describe('mergeSeoDraft', () => {
  it('fills blanks without replacing author-edited SEO fields', () => {
    const scaffold = makePost();
    if (isPostPayload(scaffold.payload)) {
      scaffold.payload.search_engine_title = 'Manual SEO title';
    }
    const draft: SeoDraft = {
      search_engine_title: 'AI title',
      search_engine_description: 'AI description',
      slug: 'ai-slug',
      tags: ['ai'],
    };
    const merged = mergeSeoDraft(scaffold, draft);

    if (!isPostPayload(merged.payload)) throw new Error('Expected post payload');
    expect(merged.payload.search_engine_title).toBe('Manual SEO title');
    expect(merged.payload.search_engine_description).toBe('AI description');
    expect(merged.payload.slug).toBe('ai-slug');
    expect(merged.payload.tags).toEqual(['ai']);
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
