import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface HeroImagePayload {
  src: string;
  alt: string;
  subtitle?: string;
  credit?: string;
}

function inferDimensionsFromSrc(src: string): { width: number | null; height: number | null } {
  const match = src.match(/_(\d+)x(\d+)\./);
  if (!match) return { width: null, height: null };
  return {
    width: parseInt(match[1], 10),
    height: parseInt(match[2], 10),
  };
}

function createHeroImageNode(editor: Editor, payload: HeroImagePayload) {
  const { width, height } = inferDimensionsFromSrc(payload.src);
  return editor.schema.node('captionedImage', undefined, [
    editor.schema.node('image2', {
      src: payload.src,
      alt: payload.alt,
      title: payload.credit ? `Credit: ${payload.credit}` : null,
      credit: payload.credit ?? null,
      topImage: true,
      width,
      height,
    }),
    ...(payload.subtitle
      ? [
          editor.schema.node('caption', undefined, [
            editor.schema.node('paragraph', undefined, [editor.schema.text(payload.subtitle)]),
          ]),
        ]
      : []),
  ]);
}

function nodeHasHeroImage(node: ProseMirrorNode): boolean {
  let hasHero = false;
  node.descendants((child) => {
    if (child.type.name === 'image2' && child.attrs.topImage) {
      hasHero = true;
      return false;
    }
    return true;
  });
  return hasHero;
}

function findHeroImageBlock(editor: Editor): { pos: number; nodeSize: number } | null {
  let heroBlock: { pos: number; nodeSize: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'captionedImage') {
      if (nodeHasHeroImage(node)) {
        heroBlock = { pos, nodeSize: node.nodeSize };
        return false;
      }
      return false;
    }

    if (node.type.name === 'image2' && node.attrs.topImage) {
      heroBlock = { pos, nodeSize: node.nodeSize };
      return false;
    }
    return true;
  });
  return heroBlock;
}

export function clearHeroImageFlags(editor: Editor): void {
  const heroPositions: number[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'image2' && node.attrs.topImage) {
      heroPositions.push(pos);
    }
    return true;
  });

  if (heroPositions.length === 0) return;
  let tr = editor.state.tr;
  for (const pos of heroPositions) {
    const node = tr.doc.nodeAt(pos);
    if (!node || node.type.name !== 'image2') continue;
    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      topImage: false,
    });
  }
  editor.view.dispatch(tr);
}

export function replaceHeroImage(editor: Editor, payload: HeroImagePayload): boolean {
  const heroBlock = findHeroImageBlock(editor);
  if (heroBlock === null) return false;

  const heroNode = createHeroImageNode(editor, payload);
  const tr = editor.state.tr
    .delete(heroBlock.pos, heroBlock.pos + heroBlock.nodeSize)
    .insert(0, heroNode)
    .scrollIntoView();
  editor.view.dispatch(tr);
  return true;
}

export function insertHeroImageAtTop(editor: Editor, payload: HeroImagePayload): void {
  const heroNode = createHeroImageNode(editor, payload);

  const tr = editor.state.tr.insert(0, heroNode).scrollIntoView();
  editor.view.dispatch(tr);
}
