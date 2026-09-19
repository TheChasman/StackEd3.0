// Scaffold utilities: readiness, JSON serialization, MD mirror.
// Migration lives in scaffoldMigration.ts (deletable after all files are converted).
import { generateHTML } from '@tiptap/html';
import TurndownService from 'turndown';
import type { Scaffold, PostPayload, PMDoc, PMNode } from '$lib/types/scaffold';
import { isPostPayload, getBody } from '$lib/types/scaffold';

// TipTap extensions are passed as a loosely-typed array to avoid generic
// incompatibility between Node and Extension types. The schema module
// provides the actual type-safe extension list.

type Extensions = any[];

// --- Readiness ---

export interface ReadinessResult {
  blocking: string[];
  advisory: string[];
}

export function readiness(s: Scaffold): ReadinessResult {
  const blocking: string[] = [];
  const advisory: string[] = [];

  if (s.kind === 'post') {
    const p = s.payload as PostPayload;
    if (!p.draft_title.trim()) blocking.push('draft_title is empty');
    if (!hasBodyContent(p.draft_body)) blocking.push('draft_body is empty');
    if (p.draft_bylines.length === 0)
      advisory.push('draft_bylines is empty (auto-assigned on publish)');

    if (!p.search_engine_title.trim()) blocking.push('search_engine_title is empty');
    if (!p.search_engine_description.trim()) blocking.push('search_engine_description is empty');
    if (!p.slug.trim()) blocking.push('slug is empty');
    if (p.tags.length === 0) blocking.push('tags is empty');

    if (!p.draft_subtitle.trim()) advisory.push('draft_subtitle is empty');
  } else {
    if (!hasBodyContent(getBody(s))) blocking.push('bodyJson is empty');
  }

  return { blocking, advisory };
}

function hasBodyContent(doc: PMDoc): boolean {
  return doc.content.some(nodeHasText);
}

function nodeHasText(node: PMNode): boolean {
  if (node.text && node.text.trim()) return true;
  if (node.content) return node.content.some(nodeHasText);
  // Leaf nodes like horizontal_rule count as content
  if (node.type !== 'paragraph' && node.type !== 'text') return true;
  return false;
}

// --- JSON serialization (canonical file format) ---

export function serializeScaffold(s: Scaffold): string {
  return JSON.stringify(s, null, 2) + '\n';
}

export function deserializeScaffold(json: string): Scaffold {
  const parsed = JSON.parse(json) as Scaffold;
  if (!parsed.id || !parsed.kind || !parsed.payload || !parsed.workshop || !parsed.remote) {
    throw new Error('Invalid scaffold: missing required fields');
  }
  // StackEd 2.0 files predate targetDate/publishedAt — both load as null.
  return {
    ...parsed,
    remote: { ...parsed.remote, publishedAt: parsed.remote.publishedAt ?? null },
    workshop: { ...parsed.workshop, targetDate: parsed.workshop.targetDate ?? null },
  };
}

// --- Markdown mirror (one-way, for Obsidian reading) ---
// Uses turndown to convert HTML (from generateHTML) to markdown.
// turndown is retained for this purpose; marked is not needed here.

// Shared turndown instance for mirror generation.
// Substack custom elements are kept as raw HTML in the markdown.
function createMirrorTurndown(): TurndownService {
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  td.keep((node) => {
    const el = node as HTMLElement;
    return (
      el.dataset?.type === 'paywall' ||
      el.dataset?.type === 'subscribe-button' ||
      el.dataset?.type === 'share-button' ||
      el.dataset?.type === 'poll' ||
      el.dataset?.type === 'latex' ||
      el.dataset?.type === 'footnote' ||
      el.dataset?.type === 'captioned-image' ||
      el.dataset?.type === 'image2' ||
      el.dataset?.type === 'caption' ||
      el.dataset?.type === 'pullquote' ||
      el.dataset?.type === 'callout' ||
      el.dataset?.type === 'embedded-publication' ||
      el.dataset?.type === 'youtube2' ||
      el.dataset?.type === 'recipe' ||
      el.dataset?.type === 'subscribe-widget'
    );
  });
  return td;
}

let _turndown: TurndownService | null = null;
function getTurndown(): TurndownService {
  if (!_turndown) _turndown = createMirrorTurndown();
  return _turndown;
}

export function generateMarkdownMirror(s: Scaffold, extensions: Extensions): string {
  const body = getBody(s);
  const html = generateHTML(body, extensions);
  const md = getTurndown().turndown(html);

  let out = '';

  if (s.kind === 'post' && isPostPayload(s.payload)) {
    const p = s.payload;
    if (p.draft_title) out += `# ${p.draft_title}\n\n`;
    if (p.draft_subtitle) out += `*${p.draft_subtitle}*\n\n`;
    out += md;

    // Workshop zone as an HTML comment (not visible in rendered preview)
    const w = s.workshop;
    if (w.spark || w.hook || w.landing || w.research) {
      out += '\n\n<!-- Workshop (not published)\n';
      if (w.spark) out += `SPARK: ${w.spark}\n`;
      if (w.hook) out += `HOOK: ${w.hook}\n`;
      if (w.landing) out += `LANDING: ${w.landing}\n`;
      if (w.research) out += `RESEARCH: ${w.research}\n`;
      out += '-->\n';
    }
  } else {
    out += md;
  }

  return out;
}

// --- Scaffold file path helpers ---

export function scaffoldJsonPath(articlePath: string): string {
  if (articlePath.endsWith('.md')) {
    return articlePath.replace(/\.md$/, '.stacked.json');
  }
  if (articlePath.endsWith('.stacked.json')) {
    return articlePath;
  }
  return `${articlePath}/article.stacked.json`;
}

export function scaffoldMdMirrorPath(articlePath: string): string {
  if (articlePath.endsWith('.md')) {
    return articlePath;
  }
  if (articlePath.endsWith('.stacked.json')) {
    return articlePath.replace(/\.stacked\.json$/, '.md');
  }
  return `${articlePath}/article.md`;
}
