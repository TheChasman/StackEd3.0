import type { ArticleContext } from '$lib/services/ai/adapter';
import type { ArticleFrontmatter } from '$lib/types/article';
import { serializeMarkdownFile } from '$lib/utils/frontmatter';

const MAX_BODY_CONTEXT_CHARS = 12000;

export interface SeoDraft {
  SEO_TITLE: string;
  SEO_DESCRIPTION: string;
  SEO_SLUG: string;
  SEO_TAGS: string[];
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[Truncated ${value.length - maxLength} characters]`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
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

export function isSeoComplete(frontmatter: ArticleFrontmatter | null): boolean {
  if (!frontmatter) return false;
  return Boolean(
    frontmatter.SEO_TITLE.trim() &&
    frontmatter.SEO_DESCRIPTION.trim() &&
    frontmatter.SEO_SLUG.trim() &&
    frontmatter.SEO_TAGS.length > 0,
  );
}

export function parseSeoDraftJson(raw: string): SeoDraft {
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error('SEO draft was not valid JSON.');

  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Partial<SeoDraft>;
  for (const field of ['SEO_TITLE', 'SEO_DESCRIPTION', 'SEO_SLUG', 'SEO_TAGS'] as const) {
    if (!(field in parsed)) throw new Error(`SEO draft missing ${field}.`);
  }

  if (typeof parsed.SEO_TITLE !== 'string') throw new Error('SEO_TITLE must be text.');
  if (typeof parsed.SEO_DESCRIPTION !== 'string') throw new Error('SEO_DESCRIPTION must be text.');
  if (typeof parsed.SEO_SLUG !== 'string') throw new Error('SEO_SLUG must be text.');

  const tags = cleanTags(parsed.SEO_TAGS);
  if (tags.length === 0) throw new Error('SEO_TAGS must contain at least one tag.');

  return {
    SEO_TITLE: parsed.SEO_TITLE.trim(),
    SEO_DESCRIPTION: parsed.SEO_DESCRIPTION.trim(),
    SEO_SLUG: slugify(parsed.SEO_SLUG),
    SEO_TAGS: tags,
  };
}

export function mergeSeoDraft(frontmatter: ArticleFrontmatter, draft: SeoDraft): ArticleFrontmatter {
  return {
    ...frontmatter,
    SEO_TITLE: frontmatter.SEO_TITLE.trim() ? frontmatter.SEO_TITLE : draft.SEO_TITLE,
    SEO_DESCRIPTION: frontmatter.SEO_DESCRIPTION.trim() ? frontmatter.SEO_DESCRIPTION : draft.SEO_DESCRIPTION,
    SEO_SLUG: frontmatter.SEO_SLUG.trim() ? frontmatter.SEO_SLUG : draft.SEO_SLUG,
    SEO_TAGS: frontmatter.SEO_TAGS.length > 0 ? frontmatter.SEO_TAGS : draft.SEO_TAGS,
  };
}

export function buildSeoPrompt(context: ArticleContext): string {
  const frontmatter = context.frontmatter
    ? serializeMarkdownFile(context.frontmatter as unknown as Record<string, unknown>, context.fieldOrder, '').trim()
    : 'No YAML frontmatter loaded.';

  const body = context.body.trim()
    ? truncate(context.body, MAX_BODY_CONTEXT_CHARS)
    : 'No Markdown body loaded.';

  return `Create pre-posting SEO metadata for this StackEd/Substack article.

Return only valid JSON with this exact shape:
{
  "SEO_TITLE": "compelling but not clickbait title",
  "SEO_DESCRIPTION": "one concise search/social summary",
  "SEO_SLUG": "lowercase-hyphenated-url-slug",
  "SEO_TAGS": ["tag one", "tag two", "tag three"]
}

Rules:
- Preserve the article's actual angle and voice.
- Do not rewrite TITLE, SUBTITLE, HOOK, LANDING, or the manuscript body.
- SEO_TITLE should be compelling but not clickbait.
- SEO_DESCRIPTION should be one concise sentence.
- SEO_SLUG must be lowercase, hyphenated, and URL-safe.
- SEO_TAGS must contain 3-8 short topical tags.

Current file: ${context.filePath ?? 'unsaved StackEd article'}

YAML frontmatter:
${frontmatter}

Markdown body:
${body}`;
}
