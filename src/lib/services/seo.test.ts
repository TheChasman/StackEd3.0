import { describe, expect, it } from 'vitest';
import type { ArticleFrontmatter } from '$lib/types/article';
import {
  buildSeoPrompt,
  isSeoComplete,
  mergeSeoDraft,
  parseSeoDraftJson,
} from './seo';

const BASE: ArticleFrontmatter = {
  IMAGE: '',
  SPARK: 'Raw idea',
  TITLE: 'Partial Solution',
  SUBTITLE: 'What does impartiality look like?',
  HOOK: 'The oath changed in 2002.',
  LANDING: '',
  TITLE_SELECTED: '',
  SUBTITLE_SELECTED: '',
  HOOK_SELECTED: '',
  LANDING_SELECTED: '',
  AI_GEN: false,
  SEO_TITLE: '',
  SEO_DESCRIPTION: '',
  SEO_SLUG: '',
  SEO_TAGS: [],
  created: '2026-06-09T00:00:00.000Z',
  updated: '2026-06-09T00:00:00.000Z',
};

describe('isSeoComplete', () => {
  it('returns false when any SEO field is blank', () => {
    expect(isSeoComplete(BASE)).toBe(false);
  });

  it('returns true when all SEO fields are populated', () => {
    expect(isSeoComplete({
      ...BASE,
      SEO_TITLE: 'Partial Solution',
      SEO_DESCRIPTION: 'A short description.',
      SEO_SLUG: 'partial-solution',
      SEO_TAGS: ['justice'],
    })).toBe(true);
  });
});

describe('parseSeoDraftJson', () => {
  it('parses valid JSON SEO output', () => {
    expect(parseSeoDraftJson(`{
      "SEO_TITLE": "Partial Solution",
      "SEO_DESCRIPTION": "What impartial policing really means.",
      "SEO_SLUG": "partial-solution",
      "SEO_TAGS": ["policing", "justice"]
    }`)).toEqual({
      SEO_TITLE: 'Partial Solution',
      SEO_DESCRIPTION: 'What impartial policing really means.',
      SEO_SLUG: 'partial-solution',
      SEO_TAGS: ['policing', 'justice'],
    });
  });

  it('rejects incomplete JSON SEO output', () => {
    expect(() => parseSeoDraftJson('{"SEO_TITLE":"Only title"}')).toThrow('SEO draft missing SEO_DESCRIPTION');
  });

  it('normalises slug and tags', () => {
    const draft = parseSeoDraftJson(`{
      "SEO_TITLE": "Title",
      "SEO_DESCRIPTION": "Description",
      "SEO_SLUG": "Partial Solution!",
      "SEO_TAGS": [" Policing ", "", "Justice Reform"]
    }`);

    expect(draft.SEO_SLUG).toBe('partial-solution');
    expect(draft.SEO_TAGS).toEqual(['Policing', 'Justice Reform']);
  });
});

describe('mergeSeoDraft', () => {
  it('fills blanks without replacing author-edited SEO fields', () => {
    const merged = mergeSeoDraft(
      { ...BASE, SEO_TITLE: 'Manual SEO title' },
      {
        SEO_TITLE: 'AI title',
        SEO_DESCRIPTION: 'AI description',
        SEO_SLUG: 'ai-slug',
        SEO_TAGS: ['ai'],
      },
    );

    expect(merged.SEO_TITLE).toBe('Manual SEO title');
    expect(merged.SEO_DESCRIPTION).toBe('AI description');
    expect(merged.SEO_SLUG).toBe('ai-slug');
    expect(merged.SEO_TAGS).toEqual(['ai']);
  });
});

describe('buildSeoPrompt', () => {
  it('includes frontmatter and body context', () => {
    const prompt = buildSeoPrompt({
      frontmatter: BASE,
      fieldOrder: ['TITLE'],
      body: '# Draft\n\nBody copy.',
      filePath: '/tmp/Partial Solution.md',
    });

    expect(prompt).toContain('Return only valid JSON');
    expect(prompt).toContain('Partial Solution');
    expect(prompt).toContain('Body copy.');
  });
});
