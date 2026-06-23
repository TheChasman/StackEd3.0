import { beforeEach, describe, expect, it, vi } from 'vitest';

const openDialogMock = vi.hoisted(() => vi.fn());
const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openDialogMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import { deriveArtworkPath, pickImageForArticle } from './imagePicker';

describe('imagePicker service', () => {
  beforeEach(() => {
    openDialogMock.mockReset();
    invokeMock.mockReset();
    openDialogMock.mockResolvedValue('/vault/A_Checkmate/_artwork/hero.png');
    invokeMock.mockResolvedValue('data:image/png;base64,aGVybw==');
  });

  it('derives the _artwork folder below the current editor file folder', () => {
    expect(deriveArtworkPath('/vault/O_Substack/A_Checkmate/Checkmate.md')).toBe(
      '/vault/O_Substack/A_Checkmate/_artwork',
    );
  });

  it('opens the native image dialog in _artwork while allowing normal file selection', async () => {
    const image = await pickImageForArticle('/vault/O_Substack/A_Checkmate/Checkmate.md');

    expect(openDialogMock).toHaveBeenCalledWith({
      title: 'Insert Image',
      multiple: false,
      directory: false,
      defaultPath: '/vault/O_Substack/A_Checkmate/_artwork',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] }],
    });
    expect(invokeMock).not.toHaveBeenCalled();
    expect(image).toEqual({
      path: '/vault/A_Checkmate/_artwork/hero.png',
      src: '_artwork/hero.png',
      alt: 'hero',
    });
  });

  it('falls back to data URLs for images outside _artwork', async () => {
    openDialogMock.mockResolvedValue('/vault/Downloads/hero.png');

    const image = await pickImageForArticle('/vault/O_Substack/A_Checkmate/Checkmate.md');

    expect(invokeMock).toHaveBeenCalledWith('read_image_data_url', {
      path: '/vault/Downloads/hero.png',
    });
    expect(image).toEqual({
      path: '/vault/Downloads/hero.png',
      src: 'data:image/png;base64,aGVybw==',
      alt: 'hero',
    });
  });

  it('does not read an image when the dialog is canceled', async () => {
    openDialogMock.mockResolvedValue(null);

    await expect(pickImageForArticle('/vault/O_Substack/A_Checkmate/Checkmate.md')).resolves.toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
