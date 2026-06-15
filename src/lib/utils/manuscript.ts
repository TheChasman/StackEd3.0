import type { ArticleFrontmatter } from '$lib/types/article';

export interface AltItem {
  text: string;
  selected: boolean;
}

export interface AltBlock {
  section: 'TITLE' | 'SUBTITLE' | 'HOOK' | 'LANDING';
  items: AltItem[];
}

export interface PreviewResult {
  spark: string;
  prose: string;
  altBlocks: AltBlock[];
}

export interface PromotionGate {
  canPromote: boolean;
  missing: string[];
}

const SCAFFOLD_RE = /\[(?:SCAFFOLD|CHECK|IMAGE):[^\]]*\]/g;
const SPINE_SECTIONS = ['SPARK', 'TITLE', 'SUBTITLE', 'HOOK', 'LANDING'] as const;
type SpineSection = typeof SPINE_SECTIONS[number];

function stripScaffold(text: string): string {
  return text.replace(SCAFFOLD_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

interface BodyChunk {
  heading: string | null;
  content: string;
}

function splitByHeadings(body: string): BodyChunk[] {
  const lines = body.split('\n');
  const chunks: BodyChunk[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      if (currentHeading !== null || currentLines.some(l => l.trim())) {
        chunks.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
      }
      currentHeading = headingMatch[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentHeading !== null || currentLines.some(l => l.trim())) {
    chunks.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
  }

  return chunks;
}

function isAltBlock(heading: string): boolean {
  return /^Alt\s+(TITLE|SUBTITLE|HOOK|LANDING)$/i.test(heading);
}

function isSpineSection(heading: string): boolean {
  return SPINE_SECTIONS.includes(heading.toUpperCase() as SpineSection);
}

function parseAltItems(content: string): AltItem[] {
  const lines = content.split('\n');
  return lines
    .map(line => line.match(/^\d+\.\s+(.*?)(\s*\[✓\])?\s*$/))
    .filter((m): m is RegExpMatchArray => m !== null && m[1].trim().length > 0)
    .map(m => ({ text: m[1].trim(), selected: Boolean(m[2]) }));
}

function spineText(field: SpineSection, frontmatter: ArticleFrontmatter): string {
  if (field === 'SPARK') return frontmatter.SPARK ?? '';
  const selectedKey = `${field}_SELECTED` as keyof ArticleFrontmatter;
  const selected = frontmatter[selectedKey] as string;
  const primary = frontmatter[field] as string;
  return selected?.trim() ? selected : (primary ?? '');
}

export function renderForPreview(body: string, frontmatter: ArticleFrontmatter): PreviewResult {
  const chunks = splitByHeadings(body);
  const altBlocks: AltBlock[] = [];
  const proseChunks: string[] = [];
  let inBody = false;

  for (const chunk of chunks) {
    const heading = chunk.heading?.trim() ?? '';
    const upper = heading.toUpperCase();

    // SPARK: skip entirely (returned separately)
    if (upper === 'SPARK') continue;

    // Alt blocks: extract as data, not prose
    const altMatch = heading.match(/^Alt\s+(TITLE|SUBTITLE|HOOK|LANDING)$/i);
    if (altMatch) {
      altBlocks.push({
        section: altMatch[1].toUpperCase() as AltBlock['section'],
        items: parseAltItems(chunk.content),
      });
      continue;
    }

    // Headingless content (preamble / unstructured body): render as prose
    if (!heading && chunk.content) {
      proseChunks.push(stripScaffold(chunk.content));
      continue;
    }

    // Track body range: HOOK opens it, LANDING closes it
    if (upper === 'HOOK') inBody = true;
    if (upper === 'LANDING') inBody = false;

    // Spine sections: use _SELECTED / primary text
    if (isSpineSection(heading)) {
      const text = spineText(upper as SpineSection, frontmatter);
      if (text) proseChunks.push(stripScaffold(text));
      continue;
    }

    // Free-named body sections (between HOOK and LANDING): strip heading, keep prose
    if (inBody && chunk.content) {
      proseChunks.push(stripScaffold(chunk.content));
    }
  }

  const sparkChunk = chunks.find(c => c.heading?.trim().toUpperCase() === 'SPARK');
  const spark = stripScaffold(sparkChunk?.content ?? frontmatter.SPARK ?? '');

  return {
    spark,
    prose: proseChunks.filter(Boolean).join('\n\n'),
    altBlocks,
  };
}

export function renderForPromotion(body: string, frontmatter: ArticleFrontmatter): string {
  const { prose } = renderForPreview(body, frontmatter);
  return prose;
}

function countBodyWords(body: string): number {
  const chunks = splitByHeadings(body);
  let inBody = false;
  let words = 0;

  for (const chunk of chunks) {
    const heading = chunk.heading?.trim() ?? '';
    const upper = heading.toUpperCase();

    // HOOK opens body range — its own content is not counted (same as render behaviour)
    if (upper === 'HOOK') { inBody = true; continue; }
    // LANDING closes body range — do not count LANDING content
    else if (upper === 'LANDING') { inBody = false; continue; }
    // Skip anything outside the body range, Alt blocks, and other spine sections
    else if (!inBody || isAltBlock(heading) || isSpineSection(heading)) { continue; }

    if (inBody && chunk.content) {
      words += stripScaffold(chunk.content).split(/\s+/).filter(Boolean).length;
    }
  }
  return words;
}

export function checkPromotionGate(frontmatter: ArticleFrontmatter, body: string): PromotionGate {
  const missing: string[] = [];

  if (!frontmatter.TITLE.trim()) missing.push('TITLE is empty');
  if (!frontmatter.SUBTITLE.trim()) missing.push('SUBTITLE is empty');
  if (!frontmatter.HOOK.trim()) missing.push('HOOK is empty');
  if (!frontmatter.LANDING.trim()) missing.push('LANDING is empty');

  const bodyWords = countBodyWords(body);
  if (bodyWords < 100) missing.push(`Body has fewer than 100 words (${bodyWords} found)`);

  return { canPromote: missing.length === 0, missing };
}
