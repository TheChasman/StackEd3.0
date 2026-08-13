import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { isPathInArtworkFolder, relativeArtworkSrcFromPath } from '$lib/utils/artworkReferences';

const IMAGE_FILTERS = [
  { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] },
];

export interface PickedImage {
  path: string;
  src: string;
  alt: string;
}

function getFileName(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? filePath.slice(index + 1) : filePath;
}

export function deriveArtworkPath(currentFilePath: string | null): string | undefined {
  if (!currentFilePath) return undefined;
  const normalized = currentFilePath.replaceAll('\\', '/');
  const index = normalized.lastIndexOf('/');
  if (index < 0) return '_artwork';
  return `${currentFilePath.slice(0, index)}/_artwork`;
}

export async function pickImageForArticle(
  currentFilePath: string | null,
): Promise<PickedImage | null> {
  const defaultPath = deriveArtworkPath(currentFilePath);
  const selected = await openDialog({
    title: 'Insert Image',
    multiple: false,
    directory: false,
    ...(defaultPath ? { defaultPath } : {}),
    filters: IMAGE_FILTERS,
  });
  const path = Array.isArray(selected) ? selected[0] : selected;
  if (!path) return null;

  const fileName = getFileName(path);
  return {
    path,
    src: isPathInArtworkFolder(path)
      ? relativeArtworkSrcFromPath(path)
      : await invoke<string>('read_image_data_url', { path }),
    alt: fileName.replace(/\.[^.]+$/, ''),
  };
}
