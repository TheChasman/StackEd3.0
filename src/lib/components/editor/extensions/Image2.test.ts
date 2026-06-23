import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('$lib/stores/document.svelte', () => ({
  documentStore: {
    filePath: '/vault/Article/Article.md',
  },
}));

import { Image2 } from './Image2';

describe('Image2 extension', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

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

  it('toggles editor display between full size and thumbnail without changing image dimensions', () => {
    const addNodeView = (Image2 as any).config.addNodeView as () => (args: {
      node: { attrs: Record<string, unknown> };
    }) => { dom: HTMLElement };
    const nodeView = addNodeView()({
      node: {
        attrs: {
          src: 'https://example.com/large_1200x800.png',
          alt: 'Large image',
          width: 1200,
          height: 800,
        },
      },
    });

    const img = nodeView.dom.querySelector('img') as HTMLImageElement;
    const button = nodeView.dom.querySelector('button[aria-label="Show as thumbnail"]') as HTMLButtonElement;

    expect(button).toBeTruthy();
    expect(img.width).toBe(1200);
    expect(img.height).toBe(800);
    expect(img.style.maxHeight).toBe('');

    button.click();

    expect(button.getAttribute('aria-label')).toBe('Show full size');
    expect(img.width).toBe(1200);
    expect(img.height).toBe(800);
    expect(img.style.maxHeight).toBe('180px');

    button.click();

    expect(button.getAttribute('aria-label')).toBe('Show as thumbnail');
    expect(img.width).toBe(1200);
    expect(img.height).toBe(800);
    expect(img.style.maxHeight).toBe('');
  });

  it('loads compact artwork links for editor preview without changing saved src', async () => {
    invokeMock.mockResolvedValue('data:image/png;base64,aGVybw==');
    const addNodeView = (Image2 as any).config.addNodeView as () => (args: {
      node: { attrs: Record<string, unknown> };
    }) => { dom: HTMLElement };
    const nodeView = addNodeView()({
      node: {
        attrs: {
          src: '_artwork/hero%20image.png',
          alt: 'Hero image',
        },
      },
    });

    const img = nodeView.dom.querySelector('img') as HTMLImageElement;
    expect(invokeMock).toHaveBeenCalledWith('read_image_data_url', {
      path: '/vault/Article/_artwork/hero image.png',
    });

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(img.getAttribute('src')).toBe('data:image/png;base64,aGVybw==');

    const renderHTML = (Image2 as any).config.renderHTML as (args: { HTMLAttributes: Record<string, unknown> }) => [string, Record<string, unknown>];
    const output = renderHTML({
      HTMLAttributes: {
        src: '_artwork/hero%20image.png',
        alt: 'Hero image',
      },
    });
    expect(output[1].src).toBe('_artwork/hero%20image.png');
  });
});
