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

// Field paths used in Scaffold.locked. Matches the shape the UI toggles.
export const SEO_FIELD_PATHS = {
  search_engine_title: 'payload.search_engine_title',
  search_engine_description: 'payload.search_engine_description',
  slug: 'payload.slug',
  tags: 'payload.tags',
} as const;

/**
 * Map generated tags onto the publication's existing vocabulary where an
 * exact (case-insensitive) match exists, so "media theory" collapses onto a
 * pre-existing "Media Theory" tag rather than fragmenting the taxonomy.
 * Deduplicates case-insensitively, preserving first-seen order.
 */
export function canonicalizeTags(tags: string[], vocabulary: string[] = []): string[] {
  const vocabByLower = new Map(vocabulary.map(v => [v.toLowerCase(), v]));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const canonical = vocabByLower.get(tag.toLowerCase()) ?? tag;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(canonical);
  }
  return result;
}

/**
 * Overwrite all four SEO fields with the generated draft, except any field
 * whose path is pinned in scaffold.locked. Tags are canonicalised against the
 * supplied publication vocabulary before being applied.
 */
export function applySeoDraft(scaffold: Scaffold, draft: SeoDraft, tagVocabulary: string[] = []): Scaffold {
  if (!isPostPayload(scaffold.payload)) return scaffold;
  const p = scaffold.payload;
  const locked = new Set(scaffold.locked);
  return {
    ...scaffold,
    payload: {
      ...p,
      search_engine_title: locked.has(SEO_FIELD_PATHS.search_engine_title) ? p.search_engine_title : draft.search_engine_title,
      search_engine_description: locked.has(SEO_FIELD_PATHS.search_engine_description) ? p.search_engine_description : draft.search_engine_description,
      slug: locked.has(SEO_FIELD_PATHS.slug) ? p.slug : draft.slug,
      tags: locked.has(SEO_FIELD_PATHS.tags) ? p.tags : canonicalizeTags(draft.tags, tagVocabulary),
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

  const vocabulary = context.tagVocabulary ?? [];

  return `Create pre-posting SEO metadata for this Substack article.

Return only valid JSON with this exact shape:
{
  "search_engine_title": "keyword-first title, brand last",
  "search_engine_description": "concrete summary of the payoff",
  "slug": "keyword-hyphenated-slug",
  "tags": ["Tag One", "Tag Two", "Tag Three"]
}

Rules (these follow Substack's own SEO guidance — not generic advice):
- Preserve the article's actual angle and voice. Do not rewrite the title, subtitle, or body.
- search_engine_title: 40-60 characters. This is shown to a stranger in a Google result with no context, so it may and often should differ from the inbox/post title. Lead with the keyword phrase; put any brand name last.
- search_engine_description: 140-160 characters. Substack already defaults the meta description to the subtitle, so DO NOT restate the subtitle. State the concrete payoff a reader gets instead.
- slug: 3-6 words, lowercase, hyphenated, URL-safe. Cut filler words (a, the, of, and, to); keep the keyword phrase.
- tags: 3-6 tags. Each tag becomes a public archive page, so consistency matters more than completeness. ${vocabulary.length > 0 ? 'PREFER tags from the existing vocabulary below; only invent a new tag when none fit.' : 'Reuse conventional, reusable topic tags rather than inventing hyper-specific ones.'}
${vocabulary.length > 0 ? `\nExisting tag vocabulary (reuse these exact spellings when they fit):\n${vocabulary.join(', ')}\n` : ''}
Current file: ${context.filePath ?? 'unsaved StackEd article'}

Title: ${title || '(untitled)'}
Subtitle: ${subtitle || '(none)'}
${altHistory ? `\nTitle/Hook evolution (Workshop candidates — strongest SEO signal):\n${altHistory}\n` : ''}
Body:
${body}`;
}
