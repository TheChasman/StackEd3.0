// One-time migration from old ArticleFrontmatter + markdown body → Scaffold.
// Uses `marked` to parse markdown → HTML → PMDoc.
// This file can be DELETED after all existing articles are migrated.
import { generateJSON } from '@tiptap/html';
import { marked } from 'marked';
import type { ArticleFrontmatter } from '$lib/types/article';
import type { Scaffold, PostPayload, PMDoc } from '$lib/types/scaffold';
import { emptyScaffold } from '$lib/types/scaffold';

type Extensions = any[];

export function migrateFromArticle(
  frontmatter: ArticleFrontmatter,
  body: string,
  extensions: Extensions,
): Scaffold {
  const scaffold = emptyScaffold('post');
  const payload = scaffold.payload as PostPayload;
  const w = scaffold.workshop;

  // Payload: use _SELECTED if set, otherwise primary
  payload.draft_title = frontmatter.TITLE_SELECTED?.trim() || frontmatter.TITLE;
  payload.draft_subtitle = frontmatter.SUBTITLE_SELECTED?.trim() || frontmatter.SUBTITLE;
  payload.search_engine_title = frontmatter.SEO_TITLE;
  payload.search_engine_description = frontmatter.SEO_DESCRIPTION;
  payload.slug = frontmatter.SEO_SLUG;
  payload.tags = frontmatter.SEO_TAGS;

  // Workshop
  w.spark = frontmatter.SPARK;
  w.hook = frontmatter.HOOK_SELECTED?.trim() || frontmatter.HOOK;
  w.landing = frontmatter.LANDING_SELECTED?.trim() || frontmatter.LANDING;
  w.aiGen = frontmatter.AI_GEN;

  // Candidates from Alt blocks in body
  w.candidates = extractAltCandidates(body);

  // Body markdown → PMDoc
  payload.draft_body = markdownToPMDoc(body, extensions);

  // Metadata
  scaffold.created = frontmatter.created || new Date().toISOString();
  scaffold.updated = frontmatter.updated || new Date().toISOString();

  return scaffold;
}

function extractAltCandidates(body: string): {
  title: string[];
  subtitle: string[];
  hook: string[];
  landing: string[];
} {
  const result = {
    title: [] as string[],
    subtitle: [] as string[],
    hook: [] as string[],
    landing: [] as string[],
  };
  const sections = ['TITLE', 'SUBTITLE', 'HOOK', 'LANDING'] as const;

  for (const section of sections) {
    const headingRe = new RegExp(`^##\\s+Alt\\s+${section}\\s*$`, 'im');
    const match = body.match(headingRe);
    if (!match || match.index === undefined) continue;

    const startIdx = match.index + match[0].length;
    const rest = body.substring(startIdx);
    const nextHeading = rest.match(/\n##\s/);
    const chunk = nextHeading ? rest.substring(0, nextHeading.index) : rest;

    const items = chunk
      .split('\n')
      .map((line) => line.match(/^\d+\.\s+(.*?)(\s*\[✓\])?\s*$/))
      .filter((m): m is RegExpMatchArray => m !== null && m[1].trim().length > 0)
      .map((m) => m[1].trim());

    const key = section.toLowerCase() as 'title' | 'subtitle' | 'hook' | 'landing';
    result[key] = items;
  }

  return result;
}

function markdownToPMDoc(md: string, extensions: Extensions): PMDoc {
  const html = marked.parse(md) as string;
  const json = generateJSON(html, extensions);
  return json as PMDoc;
}
