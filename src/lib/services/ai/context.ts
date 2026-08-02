import type { ArticleContext } from './adapter';
import { isPostPayload } from '$lib/types/scaffold';

const MAX_BODY_CONTEXT_CHARS = 12000;

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[Truncated ${value.length - maxLength} characters]`;
}

export function buildResearchPrompt(query: string, context?: ArticleContext): string {
  if (!context?.scaffold && !context?.bodyText) {
    return `Research the following topic and provide a concise summary with sources:\n\n${query}`;
  }

  const s = context.scaffold;
  const title = s && isPostPayload(s.payload) ? s.payload.draft_title : '';
  const subtitle = s && isPostPayload(s.payload) ? s.payload.draft_subtitle : '';

  const body = context.bodyText.trim()
    ? truncate(context.bodyText, MAX_BODY_CONTEXT_CHARS)
    : 'No body content loaded.';

  return `Research the following topic and provide a concise summary with sources. Use the current StackEd article context when relevant.

Current file: ${context.filePath ?? 'unsaved StackEd article'}
Title: ${title || '(untitled)'}
Subtitle: ${subtitle || '(none)'}

Body:
${body}

Research topic:
${query}`;
}
