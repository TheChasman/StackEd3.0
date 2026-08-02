import type { ArticleContext } from '$lib/services/ai/adapter';
import type { Scaffold, PostPayload } from '$lib/types/scaffold';
import { isPostPayload } from '$lib/types/scaffold';

const MAX_BODY_CONTEXT_CHARS = 12000;

export interface SeoDraft {
  search_engine_title: string;
  search_engine_description: string;
  slug: string;
  tags: string[];
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[Truncated ${value.length - maxLength} characters]`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function isSeoComplete(scaffold: Scaffold | null): boolean {
  if (!scaffold || !isPostPayload(scaffold.payload)) return false;
  const p = scaffold.payload;
  return Boolean(
    p.search_engine_title.trim() &&
    p.search_engine_description.trim() &&
    p.slug.trim() &&
    p.tags.length > 0,
  );
}

export function parseSeoDraftJson(raw: string): SeoDraft {
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error('SEO draft was not valid JSON.');

  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Partial<SeoDraft>;
  for (const field of ['search_engine_title', 'search_engine_description', 'slug', 'tags'] as const) {
    if (!(field in parsed)) throw new Error(`SEO draft missing ${field}.`);
  }

  if (typeof parsed.search_engine_title !== 'string') throw new Error('search_engine_title must be text.');
  if (typeof parsed.search_engine_description !== 'string') throw new Error('search_engine_description must be text.');
  if (typeof parsed.slug !== 'string') throw new Error('slug must be text.');

  const tags = cleanTags(parsed.tags);
  if (tags.length === 0) throw new Error('tags must contain at least one tag.');

  return {
    search_engine_title: parsed.search_engine_title.trim(),
    search_engine_description: parsed.search_engine_description.trim(),
    slug: slugify(parsed.slug),
    tags,
  };
}

export function mergeSeoDraft(scaffold: Scaffold, draft: SeoDraft): Scaffold {
  if (!isPostPayload(scaffold.payload)) return scaffold;
  const p = scaffold.payload;
  return {
    ...scaffold,
    payload: {
      ...p,
      search_engine_title: p.search_engine_title.trim() ? p.search_engine_title : draft.search_engine_title,
      search_engine_description: p.search_engine_description.trim() ? p.search_engine_description : draft.search_engine_description,
      slug: p.slug.trim() ? p.slug : draft.slug,
      tags: p.tags.length > 0 ? p.tags : draft.tags,
    },
  };
}

export function buildSeoPrompt(context: ArticleContext): string {
  const s = context.scaffold;
  const title = s && isPostPayload(s.payload) ? s.payload.draft_title : '';
  const subtitle = s && isPostPayload(s.payload) ? s.payload.draft_subtitle : '';
  const workshop = s?.workshop;

  const body = context.bodyText.trim()
    ? truncate(context.bodyText, MAX_BODY_CONTEXT_CHARS)
    : 'No body content loaded.';

  const candidates = workshop?.candidates;
  const altHistory = candidates
    ? Object.entries(candidates)
        .filter(([, items]) => items.length > 0)
        .map(([key, items]) => `Alt ${key}:\n${items.join('\n')}`)
        .join('\n\n')
    : '';

  return `Create pre-posting SEO metadata for this StackEd/Substack article.

Return only valid JSON with this exact shape:
{
  "search_engine_title": "compelling but not clickbait title",
  "search_engine_description": "one concise search/social summary",
  "slug": "lowercase-hyphenated-url-slug",
  "tags": ["tag one", "tag two", "tag three"]
}

Rules:
- Preserve the article's actual angle and voice.
- Do not rewrite the title, subtitle, or body.
- search_engine_title should be compelling but not clickbait.
- search_engine_description should be one concise sentence.
- slug must be lowercase, hyphenated, and URL-safe.
- tags must contain 3-8 short topical tags.

Current file: ${context.filePath ?? 'unsaved StackEd article'}

Title: ${title || '(untitled)'}
Subtitle: ${subtitle || '(none)'}
${altHistory ? `\nTitle/Hook evolution (Workshop candidates — strongest SEO signal):\n${altHistory}\n` : ''}
Body:
${body}`;
}
