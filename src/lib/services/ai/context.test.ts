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
        TITLE: 'Checkmate',
        HOOK: 'The opening hook',
      },
      fieldOrder: ['TITLE', 'HOOK'],
      body: '# Opening\n\nThis is the article body.',
      filePath: '/vault/Handshake/Checkmate/Checkmate.md',
    };

    const prompt = buildResearchPrompt('What claims need citations?', context);

    expect(prompt).toContain('Current file: /vault/Handshake/Checkmate/Checkmate.md');
    expect(prompt).toContain('YAML frontmatter:');
    expect(prompt).toContain('TITLE: Checkmate');
    expect(prompt).toContain('# Opening');
    expect(prompt).toContain('What claims need citations?');
  });
});
