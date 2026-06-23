const ARTWORK_PREFIX = '_artwork/';
const DOT_ARTWORK_PREFIX = './_artwork/';

function normalizedPath(path: string): string {
  return path.replaceAll('\\', '/');
}

function fileNameFromPath(path: string): string {
  const normalized = normalizedPath(path);
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function articleDirectory(articlePath: string): string | null {
  const normalized = normalizedPath(articlePath);
  const index = normalized.lastIndexOf('/');
  if (index < 0) return null;
  return articlePath.slice(0, index);
}

export function relativeArtworkSrc(fileName: string): string {
  return `${ARTWORK_PREFIX}${encodeURI(fileNameFromPath(fileName))}`;
}

export function relativeArtworkSrcFromPath(path: string): string {
  return relativeArtworkSrc(path);
}

export function isArtworkRelativeSrc(src: string | null | undefined): boolean {
  const value = String(src ?? '').trim();
  return value.startsWith(ARTWORK_PREFIX) || value.startsWith(DOT_ARTWORK_PREFIX);
}

export function resolveArtworkImagePath(articlePath: string | null, src: string): string | null {
  if (!articlePath || !isArtworkRelativeSrc(src)) return null;
  const directory = articleDirectory(articlePath);
  if (!directory) return null;
  const withoutPrefix = src.startsWith(DOT_ARTWORK_PREFIX)
    ? src.slice(DOT_ARTWORK_PREFIX.length)
    : src.slice(ARTWORK_PREFIX.length);
  return `${directory}/_artwork/${decodeURI(withoutPrefix)}`;
}

export function isPathInArtworkFolder(path: string): boolean {
  return normalizedPath(path).includes('/_artwork/');
}
