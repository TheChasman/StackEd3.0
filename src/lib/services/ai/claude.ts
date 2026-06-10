import Anthropic from '@anthropic-ai/sdk';
import { buildSeoPrompt, parseSeoDraftJson } from '$lib/services/seo';
import { buildResearchPrompt } from './context';
import type { AIAdapter, SearchResult, Citation, ArticleContext } from './adapter';

export class ClaudeAdapter implements AIAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('API key required');
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async search(query: string, context?: ArticleContext): Promise<SearchResult> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20260209', name: 'web_search' } as any],
      tool_choice: { type: 'auto' as const },
      messages: [
        {
          role: 'user',
          content: buildResearchPrompt(query, context),
        },
      ],
    });

    const textBlocks = response.content.filter(b => b.type === 'text');
    const summary = textBlocks.map(b => (b as { type: 'text'; text: string }).text).join('\n');

    // Extract URLs from the response text as citations
    const urlPattern = /https?:\/\/[^\s\])">,]+/g;
    const urls = [...new Set(summary.match(urlPattern) ?? [])];
    const citations: Citation[] = urls.map(url => ({ title: url, url, snippet: '' }));

    return { summary: summary.trim(), citations, query };
  }

  async generateSeoDraft(context: ArticleContext) {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: buildSeoPrompt(context),
        },
      ],
    });

    const textBlocks = response.content.filter(b => b.type === 'text');
    const raw = textBlocks.map(b => (b as { type: 'text'; text: string }).text).join('\n');
    return parseSeoDraftJson(raw);
  }
}
