import type { PMDoc, PMNode } from '$lib/types/scaffold';

export type BodyPreset =
  | 'minimal-paragraph'
  | 'paragraph-heading'
  | 'multi-section'
  | 'full-mirror';

export const BUILT_IN_BODY_PRESETS: ReadonlyArray<BodyPreset> = [
  'minimal-paragraph',
  'paragraph-heading',
  'multi-section',
  'full-mirror',
];

function paragraph(text: string): PMNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function heading(text: string, level: 2): PMNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function blockquote(text: string): PMNode {
  return { type: 'blockquote', content: [paragraph(text)] };
}

function multiSectionBody(): PMDoc {
  return {
    type: 'doc',
    content: [
      paragraph('Body round-trip test — paragraph 1.'),
      paragraph('Body round-trip test — paragraph 2.'),
      heading('Section heading', 2),
      blockquote('A quoted passage for testing blockquotes.'),
    ],
  };
}

export function buildBodyFromPreset(preset: BodyPreset): PMDoc {
  switch (preset) {
    case 'minimal-paragraph':
      return { type: 'doc', content: [paragraph('Body round-trip test.')] };
    case 'paragraph-heading':
      return { type: 'doc', content: [paragraph('Body round-trip test — paragraph 1.'), heading('Section heading', 2)] };
    case 'multi-section':
      return multiSectionBody();
    case 'full-mirror':
      // TODO: Phase 3 — replace with comprehensive legal-node mirror.
      return multiSectionBody();
    default:
      throw new Error(`Unknown body preset: ${String(preset)}`);
  }
}
