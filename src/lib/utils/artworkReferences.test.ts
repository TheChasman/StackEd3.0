import { describe, expect, it } from 'vitest';
import {
  isArtworkRelativeSrc,
  relativeArtworkSrc,
  relativeArtworkSrcFromPath,
  resolveArtworkImagePath,
} from './artworkReferences';

describe('artworkReferences', () => {
  it('builds compact _artwork links from file names and absolute paths', () => {
    expect(relativeArtworkSrc('hero image.png')).toBe('_artwork/hero%20image.png');
    expect(relativeArtworkSrcFromPath('/vault/Article/_artwork/hero image.png')).toBe('_artwork/hero%20image.png');
  });

  it('recognizes compact artwork links', () => {
    expect(isArtworkRelativeSrc('_artwork/hero.png')).toBe(true);
    expect(isArtworkRelativeSrc('./_artwork/hero.png')).toBe(true);
    expect(isArtworkRelativeSrc('data:image/png;base64,aGVybw==')).toBe(false);
    expect(isArtworkRelativeSrc('https://example.com/hero.png')).toBe(false);
  });

  it('resolves compact artwork links relative to the article file', () => {
    expect(resolveArtworkImagePath('/vault/Article/Article.md', '_artwork/hero%20image.png')).toBe(
      '/vault/Article/_artwork/hero image.png',
    );
    expect(resolveArtworkImagePath('/vault/Article/Article.md', './_artwork/hero.png')).toBe(
      '/vault/Article/_artwork/hero.png',
    );
    expect(resolveArtworkImagePath(null, '_artwork/hero.png')).toBeNull();
    expect(resolveArtworkImagePath('/vault/Article/Article.md', 'https://example.com/hero.png')).toBeNull();
  });
});
