import { invoke } from '@tauri-apps/api/core';
import { isArtworkRelativeSrc, resolveArtworkImagePath } from '$lib/utils/artworkReferences';

interface CreateSubstackClipboardHtmlParams {
  html: string;
  articlePath: string | null;
  readImageDataUrl: (path: string) => Promise<string>;
}

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() ?? '';
}

function copyAttributes(source: HTMLImageElement, target: HTMLImageElement): void {
  const alt = source.getAttribute('alt');
  const width = source.getAttribute('width');
  const height = source.getAttribute('height');
  const title = source.getAttribute('title') || creditTitleFromDataAttrs(source);
  if (alt) target.setAttribute('alt', alt);
  if (width) target.setAttribute('width', width);
  if (height) target.setAttribute('height', height);
  if (title) target.setAttribute('title', title);
}

function creditTitleFromDataAttrs(source: HTMLImageElement): string {
  const raw = source.getAttribute('data-attrs');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as { credit?: unknown; title?: unknown };
    if (typeof parsed.title === 'string' && parsed.title.trim()) return parsed.title.trim();
    if (typeof parsed.credit === 'string' && parsed.credit.trim())
      return `Credit: ${parsed.credit.trim()}`;
  } catch {
    return '';
  }
  return '';
}

async function resolveClipboardImageSrc(
  src: string,
  articlePath: string | null,
  readImageDataUrl: (path: string) => Promise<string>,
): Promise<string> {
  if (!isArtworkRelativeSrc(src)) return src;
  const path = resolveArtworkImagePath(articlePath, src);
  if (!path) throw new Error(`Cannot resolve artwork image without an article path: ${src}`);
  return readImageDataUrl(path);
}

export async function createSubstackClipboardHtml({
  html,
  articlePath,
  readImageDataUrl,
}: CreateSubstackClipboardHtmlParams): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const figures = Array.from(
    doc.querySelectorAll('figure[data-type="captioned-image"], figure.captioned-image-container'),
  );

  for (const figure of figures) {
    const source = figure.querySelector('img') as HTMLImageElement | null;
    if (!source) continue;
    const src = source.getAttribute('src') ?? '';
    const target = doc.createElement('img');
    target.setAttribute('src', await resolveClipboardImageSrc(src, articlePath, readImageDataUrl));
    copyAttributes(source, target);
    const caption = figure.querySelector('figcaption');
    if (!caption?.textContent?.trim()) {
      figure.replaceWith(target);
      continue;
    }

    const cleanFigure = doc.createElement('figure');
    const cleanCaption = doc.createElement('figcaption');
    cleanCaption.textContent = caption.textContent.trim();
    cleanFigure.append(target, cleanCaption);
    figure.replaceWith(cleanFigure);
  }

  for (const image of Array.from(doc.querySelectorAll('img'))) {
    const src = image.getAttribute('src') ?? '';
    image.setAttribute('src', await resolveClipboardImageSrc(src, articlePath, readImageDataUrl));
    image.removeAttribute('data-type');
    image.removeAttribute('data-attrs');
    image.removeAttribute('class');
    image.removeAttribute('srcset');
    image.removeAttribute('sizes');
  }

  return doc.body.innerHTML.trim();
}

export async function copyEditorHtmlForSubstack(
  html: string,
  articlePath: string | null,
): Promise<void> {
  const clipboardHtml = await createSubstackClipboardHtml({
    html,
    articlePath,
    readImageDataUrl: (path) => invoke<string>('read_image_data_url', { path }),
  });
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([clipboardHtml], { type: 'text/html' }),
      'text/plain': new Blob([htmlToText(clipboardHtml)], { type: 'text/plain' }),
    }),
  ]);
}
