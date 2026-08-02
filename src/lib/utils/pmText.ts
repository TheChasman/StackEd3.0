// Extract plain text from a ProseMirror JSON document.
// Used for AI context (research prompts, SEO prompts) where formatted
// markdown isn't needed — just the words.
import type { PMDoc, PMNode } from '$lib/types/scaffold';

export function pmDocToText(doc: PMDoc): string {
  return doc.content.map(nodeToText).filter(Boolean).join('\n\n');
}

function nodeToText(node: PMNode): string {
  if (node.text) return node.text;

  if (node.content) {
    return node.content.map(nodeToText).filter(Boolean).join(' ');
  }

  // Leaf nodes with no text content
  return '';
}
