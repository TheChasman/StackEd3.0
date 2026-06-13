import { describe, it, expect } from 'vitest';
import { renderForPreview, renderForPromotion, checkPromotionGate } from './manuscript';
import type { ArticleFrontmatter } from '$lib/types/article';

const BASE_FM: ArticleFrontmatter = {
  IMAGE: '', SPARK: 'Raw idea seed.',
  TITLE: 'Partial Solution', SUBTITLE: 'What impartiality looks like.',
  HOOK: 'In 2002 the oath changed.', LANDING: 'Read the small print.',
  TITLE_SELECTED: '', SUBTITLE_SELECTED: '', HOOK_SELECTED: '', LANDING_SELECTED: '',
  AI_GEN: false,
  SEO_TITLE: '', SEO_DESCRIPTION: '', SEO_SLUG: '', SEO_TAGS: [],
  created: '2026-06-13', updated: '2026-06-13',
};

const BODY_WITH_ALTS = `## SPARK
Raw idea seed.

## TITLE
Partial Solution

## Alt TITLE
1. Lady Justice has Lost Her Blindfold [✓]
2. Remove the Blindfold

## SUBTITLE
What impartiality looks like.

## HOOK
In 2002 the oath changed.

## CONTEXT
Partiality is easy to spot.

[SCAFFOLD: verify 2002 date]

## Bad Seed
Men like Weinstein.

[CHECK: court records]

## LANDING
Read the small print.
`;

describe('renderForPreview', () => {
  it('includes SPARK as separate spark text', () => {
    const result = renderForPreview(BODY_WITH_ALTS, { ...BASE_FM, TITLE_SELECTED: 'Lady Justice has Lost Her Blindfold' });
    expect(result.spark).toBe('Raw idea seed.');
  });

  it('strips section headings from prose sections', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.prose).not.toContain('## CONTEXT');
    expect(result.prose).not.toContain('## Bad Seed');
  });

  it('strips scaffold annotations', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.prose).not.toContain('[SCAFFOLD:');
    expect(result.prose).not.toContain('[CHECK:');
  });

  it('strips Alt block headings and items', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.prose).not.toContain('## Alt TITLE');
    expect(result.prose).not.toContain('Lady Justice has Lost Her Blindfold');
    expect(result.prose).not.toContain('Remove the Blindfold');
  });

  it('preserves body prose', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.prose).toContain('Partiality is easy to spot.');
    expect(result.prose).toContain('Men like Weinstein.');
  });

  it('returns Alt blocks for interactive display', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.altBlocks).toHaveLength(1);
    expect(result.altBlocks[0].section).toBe('TITLE');
    expect(result.altBlocks[0].items).toHaveLength(2);
    expect(result.altBlocks[0].items[0].selected).toBe(true);
    expect(result.altBlocks[0].items[0].text).toBe('Lady Justice has Lost Her Blindfold');
  });
});

describe('renderForPromotion', () => {
  it('excludes SPARK from promotion output', () => {
    const result = renderForPromotion(BODY_WITH_ALTS, BASE_FM);
    expect(result).not.toContain('Raw idea seed.');
  });

  it('strips all headings and annotations', () => {
    const result = renderForPromotion(BODY_WITH_ALTS, BASE_FM);
    expect(result).not.toContain('##');
    expect(result).not.toContain('[SCAFFOLD:');
    expect(result).not.toContain('[CHECK:');
  });

  it('preserves body prose in order', () => {
    const result = renderForPromotion(BODY_WITH_ALTS, BASE_FM);
    expect(result).toContain('Partiality is easy to spot.');
    expect(result).toContain('Men like Weinstein.');
    const ctxIdx = result.indexOf('Partiality is easy to spot.');
    const seedIdx = result.indexOf('Men like Weinstein.');
    expect(ctxIdx).toBeLessThan(seedIdx);
  });

  it('uses TITLE_SELECTED when set, otherwise TITLE', () => {
    const withSelected = { ...BASE_FM, TITLE_SELECTED: 'Lady Justice has Lost Her Blindfold' };
    expect(renderForPromotion(BODY_WITH_ALTS, withSelected)).toContain('Lady Justice has Lost Her Blindfold');
    expect(renderForPromotion(BODY_WITH_ALTS, BASE_FM)).not.toContain('Lady Justice has Lost Her Blindfold');
  });
});

describe('checkPromotionGate', () => {
  it('passes when SPINE is complete and body has 100+ words', () => {
    const fm = { ...BASE_FM };
    const body = [
      '## HOOK\nHook text.',
      '',
      '## CONTEXT',
      Array(110).fill('word').join(' '),
      '',
      '## LANDING\nLanding.',
      '',
    ].join('\n');
    const result = checkPromotionGate(fm, body);
    expect(result.canPromote).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('fails when TITLE is empty', () => {
    const body = `## HOOK\nHook.\n\n${Array(110).fill('word').join(' ')}\n\n## LANDING\nLanding.\n`;
    const result = checkPromotionGate({ ...BASE_FM, TITLE: '' }, body);
    expect(result.canPromote).toBe(false);
    expect(result.missing.some((m: string) => m.includes('TITLE'))).toBe(true);
  });

  it('fails when body word count is below 100', () => {
    const body = [
      '## HOOK\nHook.',
      '',
      '## CONTEXT',
      Array(10).fill('word').join(' '),
      '',
      '## LANDING\nLanding.',
      '',
    ].join('\n');
    const result = checkPromotionGate(BASE_FM, body);
    expect(result.canPromote).toBe(false);
    expect(result.missing.some((m: string) => m.includes('100 words'))).toBe(true);
  });
});
