import { describe, expect, it, vi } from 'vitest';
import { createSubstackClipboardHtml } from './substackClipboard';

describe('substackClipboard', () => {
  it('converts StackEd image2 figures with _artwork links into plain data URL images', async () => {
    const readImageDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,aGVybw==');
    const html = `
      <p>Before</p>
      <figure data-type="captioned-image" class="captioned-image-container">
        <img
          src="_artwork/hero%20image.png"
          alt="Hero image"
          data-type="image2"
          data-attrs="{&quot;src&quot;:&quot;_artwork/hero%20image.png&quot;,&quot;alt&quot;:&quot;Hero image&quot;,&quot;topImage&quot;:true}"
          width="1200"
          height="800"
        >
      </figure>
      <p>After</p>
    `;

    const output = await createSubstackClipboardHtml({
      html,
      articlePath: '/vault/Article/Article.md',
      readImageDataUrl,
    });

    expect(readImageDataUrl).toHaveBeenCalledWith('/vault/Article/_artwork/hero image.png');
    expect(output).toContain('<p>Before</p>');
    expect(output).toContain(
      '<img src="data:image/png;base64,aGVybw==" alt="Hero image" width="1200" height="800">',
    );
    expect(output).toContain('<p>After</p>');
    expect(output).not.toContain('data-type="image2"');
    expect(output).not.toContain('data-attrs');
  });

  it('preserves visible subtitles and hover credits in Substack clipboard HTML', async () => {
    const readImageDataUrl = vi.fn().mockResolvedValue('data:image/png;base64,aGVybw==');
    const html = `
      <figure data-type="captioned-image" class="captioned-image-container">
        <img
          src="_artwork/hero.png"
          alt="Hero image"
          title="Credit: Jane Doe"
          data-type="image2"
          data-attrs="{&quot;src&quot;:&quot;_artwork/hero.png&quot;,&quot;alt&quot;:&quot;Hero image&quot;,&quot;title&quot;:&quot;Credit: Jane Doe&quot;,&quot;credit&quot;:&quot;Jane Doe&quot;}"
        >
        <figcaption data-type="caption">Visible subtitle</figcaption>
      </figure>
    `;

    const output = await createSubstackClipboardHtml({
      html,
      articlePath: '/vault/Article/Article.md',
      readImageDataUrl,
    });

    expect(output).toBe(
      '<figure><img src="data:image/png;base64,aGVybw==" alt="Hero image" title="Credit: Jane Doe"><figcaption>Visible subtitle</figcaption></figure>',
    );
  });
});
