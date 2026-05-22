import OpenAI from 'openai';
import type { AIAdapter, SearchResult, Citation } from './adapter';

export class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('API key required');
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async search(query: string): Promise<SearchResult> {
    // Uses the Responses API with web_search_preview tool
    const response = await (this.client as any).responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: `Research the following topic and provide a concise summary with sources:\n\n${query}`,
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
}
