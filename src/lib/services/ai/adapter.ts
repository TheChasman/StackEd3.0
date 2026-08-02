import type { Scaffold } from '$lib/types/scaffold';
import type { SeoDraft } from '$lib/services/seo';

export interface Citation {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResult {
  summary: string;
  citations: Citation[];
  query: string;
}

export interface ArticleContext {
  scaffold: Scaffold | null;
  bodyText: string;
  filePath: string | null;
  tagVocabulary?: string[];
}

export interface AIAdapter {
  search(query: string, context?: ArticleContext): Promise<SearchResult>;
  generateSeoDraft(context: ArticleContext): Promise<SeoDraft>;
}

// Static imports — both are small; the unused adapter is tree-shaken at build time.
import { ClaudeAdapter } from './claude';
import { OpenAIAdapter } from './openai';

export function createAdapter(provider: 'claude' | 'openai', apiKey: string): AIAdapter {
  if (provider === 'claude') return new ClaudeAdapter(apiKey);
  return new OpenAIAdapter(apiKey);
}
