import yaml from 'js-yaml';
import type { ArticleFrontmatter } from '$lib/types/article';

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
  fieldOrder: string[];
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

// Extract content from markdown section heading (e.g., "# SPARK" or "## TITLE:")
function extractSection(body: string, sectionName: string): string {
  const pattern = new RegExp(`^#+\\s*${sectionName}\\s*:?\\s*$`, 'im');
  const match = body.match(pattern);
  if (!match) return '';

  const startIdx = match.index! + match[0].length;
  const remainingText = body.substring(startIdx);

  // Find next heading (# or ##, etc.) or end of string
  const nextHeading = remainingText.match(/\n#+\s/);
  const endIdx = nextHeading ? nextHeading.index! : remainingText.length;

  return remainingText.substring(0, endIdx).trim();
}

export function parseMarkdownFile(content: string): ParsedMarkdown {
  const match = content.match(FRONTMATTER_RE);
  let frontmatter: Record<string, unknown>;
  let body: string;
  let fieldOrder: string[];

  if (!match) {
    frontmatter = {};
    body = content;
    fieldOrder = [];
  } else {
    const [, yamlStr, bodyText] = match;
    frontmatter = (yaml.load(yamlStr) ?? {}) as Record<string, unknown>;
    body = bodyText;

    // Capture top-level key order from the raw YAML string
    fieldOrder = yamlStr
      .split('\n')
      .filter(line => /^[a-zA-Z_][a-zA-Z_0-9]*\s*:/.test(line))
      .map(line => line.split(':')[0].trim());
  }

  // Auto-populate empty YAML fields from markdown body sections
  const sections = ['SPARK', 'TITLE', 'SUBTITLE', 'HOOK', 'LANDING'] as const;
  for (const section of sections) {
    if (!frontmatter[section] || frontmatter[section] === '') {
      const extracted = extractSection(body, section);
      if (extracted) {
        frontmatter[section] = extracted;
      }
    }
  }

  return { frontmatter, body, fieldOrder };
}

function serializeLine(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return `${key}: []`;
    const items = value.map(item =>
      typeof item === 'string'
        ? `  - ${yaml.dump(item, { lineWidth: -1, quotingType: '"', forceQuotes: true }).trimEnd()}`
        : `  - ${yaml.dump(item, { lineWidth: -1 }).trimEnd()}`
    ).join('\n');
    return `${key}:\n${items}`;
  }
  if (typeof value === 'boolean') return `${key}: ${value}`;
  if (value === null || value === undefined || value === '') return `${key}: ""`;
  // For multiline strings, use literal block scalar
  if (typeof value === 'string' && (value.includes('\n') || value.length > 80)) {
    return `${key}: |\n${value.split('\n').map(line => `  ${line}`).join('\n')}`;
  }
  // Use js-yaml to produce a correct inline scalar
  return `${key}: ${yaml.dump(value, { lineWidth: -1 }).trimEnd()}`;
}

export function serializeMarkdownFile(
  frontmatter: Record<string, unknown>,
  fieldOrder: string[],
  body: string,
): string {
  const lines: string[] = [];
  const emitted = new Set<string>();

  for (const key of fieldOrder) {
    if (key in frontmatter) {
      lines.push(serializeLine(key, frontmatter[key]));
      emitted.add(key);
    }
  }
  // Any fields added after initial creation (shouldn't happen in normal flow)
  for (const key of Object.keys(frontmatter)) {
    if (!emitted.has(key)) {
      lines.push(serializeLine(key, frontmatter[key]));
    }
  }

  return `---\n${lines.join('\n')}\n---\n${body}`;
}

/** Convenience: apply ArticleFrontmatter directly */
export function serializeArticleFile(
  frontmatter: ArticleFrontmatter,
  fieldOrder: string[],
  body: string,
): string {
  return serializeMarkdownFile(frontmatter as unknown as Record<string, unknown>, fieldOrder, body);
}
