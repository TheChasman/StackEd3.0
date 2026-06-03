import type { ArticleFrontmatter } from '$lib/types/article';

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
  frontmatter: ArticleFrontmatter | null;
  fieldOrder: string[];
  body: string;
  filePath: string | null;
}

export interface AIAdapter {
  search(query: string, context?: ArticleContext): Promise<SearchResult>;
}

// Static imports — both are small; the unused adapter is tree-shaken at build time.
import { ClaudeAdapter } from './claude';
import { OpenAIAdapter } from './openai';

export function createAdapter(provider: 'claude' | 'openai', apiKey: string): AIAdapter {
  if (provider === 'claude') return new ClaudeAdapter(apiKey);
  return new OpenAIAdapter(apiKey);
}
