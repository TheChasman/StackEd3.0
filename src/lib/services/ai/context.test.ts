import { describe, expect, it } from 'vitest';
import { buildResearchPrompt } from './context';
import type { ArticleContext } from '$lib/services/ai/adapter';
import { emptyScaffold, isPostPayload, type Scaffold } from '$lib/types/scaffold';

describe('buildResearchPrompt', () => {
  it('returns a basic prompt without article context', () => {
    const prompt = buildResearchPrompt('Find supporting sources');

    expect(prompt).toContain('Find supporting sources');
    expect(prompt).toContain('Research the following topic');
    expect(prompt).not.toContain('Current file:');
  });

  it('includes the title from the scaffold when context is provided', () => {
    const scaffold: Scaffold = emptyScaffold();
    if (isPostPayload(scaffold.payload)) {
      scaffold.payload.draft_title = 'Checkmate';
    }

    const context: ArticleContext = {
      scaffold,
      bodyText: '',
      filePath: '/vault/Checkmate.md',
    };

    expect(buildResearchPrompt('What claims need citations?', context)).toContain(
      'Title: Checkmate',
    );
  });

  it('includes body text when provided', () => {
    const context: ArticleContext = {
      scaffold: null,
      bodyText: '# Opening\n\nThis is the article body.',
      filePath: null,
    };

    expect(buildResearchPrompt('Find sources', context)).toContain(
      '# Opening\n\nThis is the article body.',
    );
  });

  it('truncates long body text', () => {
    const bodyText = 'x'.repeat(12_001);
    const prompt = buildResearchPrompt('Find sources', {
      scaffold: null,
      bodyText,
      filePath: null,
    });

    expect(prompt).toContain('x'.repeat(12_000));
    expect(prompt).toContain('[Truncated 1 characters]');
    expect(prompt).not.toContain('x'.repeat(12_001));
  });
});
