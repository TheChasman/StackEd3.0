import { describe, expect, it } from 'vitest';
import { Image2 } from './Image2';

describe('Image2 extension', () => {
  it('keeps src and alt attributes in renderHTML output', () => {
    const renderHTML = (Image2 as any).config.renderHTML as (args: { HTMLAttributes: Record<string, unknown> }) => [string, Record<string, unknown>];
    const output = renderHTML({
      HTMLAttributes: {
        src: 'data:image/png;base64,aGVybw==',
        alt: 'Generated image',
      },
    });

    expect(output[0]).toBe('img');
    expect(output[1].src).toBe('data:image/png;base64,aGVybw==');
    expect(output[1].alt).toBe('Generated image');
  });

  it('reads topImage from data-attrs when parsing saved HTML', () => {
    const addAttributes = (Image2 as any).config.addAttributes() as Record<string, { parseHTML?: (el: HTMLElement) => unknown }>;
    const parseTopImage = addAttributes.topImage.parseHTML as (el: HTMLElement) => unknown;

    const el = document.createElement('img');
    el.setAttribute('data-type', 'image2');
    el.setAttribute('data-attrs', JSON.stringify({ topImage: true }));

    expect(parseTopImage(el)).toBe(true);
  });
});
