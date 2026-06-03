import { serializeMarkdownFile } from '$lib/utils/frontmatter';
import type { ArticleContext } from './adapter';

const MAX_BODY_CONTEXT_CHARS = 12000;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[Truncated ${value.length - maxLength} characters]`;
}

export function buildResearchPrompt(query: string, context?: ArticleContext): string {
  if (!context?.frontmatter && !context?.body) {
    return `Research the following topic and provide a concise summary with sources:\n\n${query}`;
  }

  const frontmatter = context.frontmatter
    ? serializeMarkdownFile(context.frontmatter as unknown as Record<string, unknown>, context.fieldOrder, '').trim()
    : 'No YAML frontmatter loaded.';

  const body = context.body.trim()
    ? truncate(context.body, MAX_BODY_CONTEXT_CHARS)
    : 'No Markdown body loaded.';

  return `Research the following topic and provide a concise summary with sources. Use the current StackEd article context when relevant.

Current file: ${context.filePath ?? 'unsaved StackEd article'}

YAML frontmatter:
${frontmatter}

Markdown body:
${body}

Research topic:
${query}`;
}
