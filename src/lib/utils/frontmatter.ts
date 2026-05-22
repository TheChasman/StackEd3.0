import yaml from 'js-yaml';
import type { ArticleFrontmatter } from '$lib/types/article';

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
  fieldOrder: string[];
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseMarkdownFile(content: string): ParsedMarkdown {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: content, fieldOrder: [] };
  }
  const [, yamlStr, body] = match;
  const frontmatter = (yaml.load(yamlStr) ?? {}) as Record<string, unknown>;

  // Capture top-level key order from the raw YAML string
  const fieldOrder = yamlStr
    .split('\n')
    .filter(line => /^[a-z_][a-z_0-9]*\s*:/.test(line))
    .map(line => line.split(':')[0].trim());

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
