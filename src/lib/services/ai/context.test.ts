import { describe, expect, it } from 'vitest';
import { buildResearchPrompt } from './context';
import type { ArticleContext } from './adapter';
import { FRONTMATTER_DEFAULTS } from '$lib/types/article';

describe('buildResearchPrompt', () => {
  it('uses the plain research prompt without article context', () => {
    const prompt = buildResearchPrompt('Find supporting sources');

    expect(prompt).toContain('Find supporting sources');
    expect(prompt).not.toContain('YAML frontmatter');
  });

  it('includes YAML frontmatter and Markdown body when article context is present', () => {
    const context: ArticleContext = {
      frontmatter: {
        ...FRONTMATTER_DEFAULTS,
        title: 'Checkmate',
        pipeline_stage: 'research',
        substack_tags: ['strategy'],
      },
      fieldOrder: ['title', 'pipeline_stage', 'substack_tags'],
      body: '# Opening\n\nThis is the article body.',
      filePath: '/vault/Handshake/Checkmate/Checkmate.sub',
    };

    const prompt = buildResearchPrompt('What claims need citations?', context);

    expect(prompt).toContain('Current file: /vault/Handshake/Checkmate/Checkmate.sub');
    expect(prompt).toContain('YAML frontmatter:');
    expect(prompt).toContain('title: Checkmate');
    expect(prompt).toContain('pipeline_stage: research');
    expect(prompt).toContain('# Opening');
    expect(prompt).toContain('What claims need citations?');
  });
});
