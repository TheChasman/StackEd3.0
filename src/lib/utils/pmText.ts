// Extract plain text from a ProseMirror JSON document.
// Used for AI context (research prompts, SEO prompts) where formatted
// markdown isn't needed — just the words.
import type { PMDoc, PMNode } from '$lib/types/scaffold';

export function pmDocToText(doc: PMDoc): string {
  return doc.content.map(nodeToText).filter(Boolean).join('\n\n');
}

/** Count words across every text node in a ProseMirror document. */
export function countPMDocWords(doc: PMDoc): number {
  return doc.content.reduce((sum, node) => sum + countNodeWords(node), 0);
}

function countNodeWords(node: PMNode): number {
  if (node.text) {
    return node.text.split(/\s+/).filter(Boolean).length;
  }
  if (node.content) {
    return node.content.reduce((sum, child) => sum + countNodeWords(child), 0);
  }
  return 0;
}

function nodeToText(node: PMNode): string {
  if (node.text) return node.text;

  if (node.content) {
    return node.content.map(nodeToText).filter(Boolean).join(' ');
  }

  // Leaf nodes with no text content
  return '';
}
