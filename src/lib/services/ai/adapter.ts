import type { Scaffold } from '$lib/types/scaffold';

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
