// Shared ProseMirror/TipTap schema — the single source of truth for the legal
// Substack node set. Imported by both the editor (Editor.svelte) and the
// scaffold utilities (generateHTML/generateJSON for migration and MD mirror).
//
// Constrained to Substack's verified node inventory:
// - heading levels 2-4 ONLY (H1 reserved for post title; no H5/H6)
// - no tables, no underline (not in Substack's schema)
// - PredictionMarket, FinancialChart, Poetry removed (Substack cannot render them)
// - ProtectedTitle removed (title is a payload field, not part of the body)
// - TextStyle/FontFamily/FontSize removed (not Substack-renderable)

import StarterKit from '@tiptap/starter-kit';
import { CaptionedImage } from '$lib/components/editor/extensions/CaptionedImage';
import { Image2 } from '$lib/components/editor/extensions/Image2';
import { Caption } from '$lib/components/editor/extensions/Caption';
import { Paywall } from '$lib/components/editor/extensions/Paywall';
import { SubscribeButton } from '$lib/components/editor/extensions/SubscribeButton';
import { ShareButton } from '$lib/components/editor/extensions/ShareButton';
import { Poll } from '$lib/components/editor/extensions/Poll';
import { Latex } from '$lib/components/editor/extensions/LaTeX';
import { Footnote } from '$lib/components/editor/extensions/Footnote';
import { Recipe } from '$lib/components/editor/extensions/Recipe';
import { Pullquote } from '$lib/components/editor/extensions/Pullquote';
import { Callout } from '$lib/components/editor/extensions/Callout';
import { EmbeddedPublication } from '$lib/components/editor/extensions/EmbeddedPublication';
import { YouTube } from '$lib/components/editor/extensions/YouTube';
import { Superscript } from '$lib/components/editor/extensions/Superscript';
import { Subscript } from '$lib/components/editor/extensions/Subscript';

/**
 * The constrained extension set matching Substack's legal ProseMirror nodes.
 * Used by the editor, generateHTML (MD mirror), and generateJSON (migration).
 */
export const substackExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3, 4] },
  }),
  CaptionedImage,
  Image2,
  Caption,
  Paywall,
  SubscribeButton,
  ShareButton,
  Poll,
  Latex,
  Footnote,
  Recipe,
  Pullquote,
  Callout,
  EmbeddedPublication,
  YouTube,
  Superscript,
  Subscript,
];
