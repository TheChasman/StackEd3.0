import OpenAI from 'openai';
import { buildSeoPrompt, parseSeoDraftJson } from '$lib/services/seo';
import { buildResearchPrompt } from './context';
import type { AIAdapter, SearchResult, Citation, ArticleContext } from './adapter';

export class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('API key required');
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async search(query: string, context?: ArticleContext): Promise<SearchResult> {
    // Uses the Responses API with web_search_preview tool
    const response = await (this.client as any).responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: buildResearchPrompt(query, context),
    });

    const summary: string = response.output_text ?? '';

    const citations: Citation[] = ((response.output ?? []) as any[])
      .filter(item => item.type === 'web_search_call')
      .flatMap(item =>
        (item.results ?? []).map((r: any) => ({
          title: r.title ?? r.url,
          url: r.url ?? '',
          snippet: r.body ?? '',
        })),
      );

    return { summary: summary.trim(), citations, query };
  }

  async generateSeoDraft(context: ArticleContext) {
    // Responses API is not yet typed in the openai SDK
    const response = await (this.client as any).responses.create({
      model: 'gpt-4o-mini',
      input: buildSeoPrompt(context),
    });

    return parseSeoDraftJson(response.output_text ?? '');
  }
}
