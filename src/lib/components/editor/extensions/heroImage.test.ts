import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CaptionedImage } from './CaptionedImage';
import { Image2 } from './Image2';
import { Caption } from './Caption';
import { clearHeroImageFlags, insertHeroImageAtTop, replaceHeroImage } from './heroImage';

function createEditor(): Editor {
  const element = document.createElement('div');
  return new Editor({
    element,
    extensions: [StarterKit, CaptionedImage, Image2, Caption],
    content: '',
  });
}

describe('replaceHeroImage', () => {
  it('replaces an existing hero image at the top of the article', () => {
    const editor = createEditor();
    editor.commands.setContent('<p>Intro paragraph.</p>');
    editor
      .chain()
      .focus()
      .insertCaptionedImage({
        src: 'https://example.com/old_100x100.png',
        alt: 'Old hero',
        topImage: true,
      })
      .run();

    const replaced = replaceHeroImage(editor, {
      src: 'https://example.com/new_640x480.png',
      alt: 'New hero',
    });

    expect(replaced).toBe(true);
    expect(editor.state.doc.firstChild?.type.name).toBe('captionedImage');

    let heroCount = 0;
    let heroSrc: string | null = null;
    let heroAlt: string | null = null;
    let heroWidth: number | null = null;
    let heroHeight: number | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image2' && node.attrs.topImage) {
        heroCount += 1;
        heroSrc = node.attrs.src as string;
        heroAlt = node.attrs.alt as string;
        heroWidth = node.attrs.width as number | null;
        heroHeight = node.attrs.height as number | null;
      }
      return true;
    });

    expect(heroCount).toBe(1);
    expect(heroSrc).toBe('https://example.com/new_640x480.png');
    expect(heroAlt).toBe('New hero');
    expect(heroWidth).toBe(640);
    expect(heroHeight).toBe(480);

    editor.destroy();
  });

  it('returns false when no existing hero is present', () => {
    const editor = createEditor();
    editor
      .chain()
      .focus()
      .insertCaptionedImage({
        src: 'https://example.com/inline.png',
        alt: 'Inline',
        topImage: false,
      })
      .run();

    const replaced = replaceHeroImage(editor, {
      src: 'https://example.com/new_640x480.png',
      alt: 'New hero',
    });

    expect(replaced).toBe(false);
    editor.destroy();
  });

  it('clears existing hero flags before a new hero is inserted', () => {
    const editor = createEditor();
    editor
      .chain()
      .focus()
      .insertCaptionedImage({
        src: 'https://example.com/old_100x100.png',
        alt: 'Old hero',
        topImage: true,
      })
      .run();

    clearHeroImageFlags(editor);

    let heroCount = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image2' && node.attrs.topImage) {
        heroCount += 1;
      }
      return true;
    });

    expect(heroCount).toBe(0);
    editor.destroy();
  });

  it('inserts hero at top when replacing and no hero exists', () => {
    const editor = createEditor();
    editor.commands.setContent('<p>Paragraph one.</p><p>Paragraph two.</p>');

    insertHeroImageAtTop(editor, {
      src: 'https://example.com/new_320x200.png',
      alt: 'Top hero',
    });

    const firstNode = editor.state.doc.firstChild;
    expect(firstNode?.type.name).toBe('captionedImage');
    const imageNode = firstNode?.firstChild;
    expect(imageNode?.type.name).toBe('image2');
    expect(imageNode?.attrs.topImage).toBe(true);
    expect(imageNode?.attrs.src).toBe('https://example.com/new_320x200.png');
    expect(imageNode?.attrs.width).toBe(320);
    expect(imageNode?.attrs.height).toBe(200);
    editor.destroy();
  });
});
