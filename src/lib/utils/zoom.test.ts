import { beforeEach, describe, expect, it, vi } from 'vitest';

const setZoomMock = vi.hoisted(() => vi.fn());
const localStorageValues = vi.hoisted(() => new Map<string, string>());

const localStorageMock: Storage = {
  get length() {
    return localStorageValues.size;
  },
  clear: vi.fn(() => localStorageValues.clear()),
  getItem: vi.fn((key: string) => localStorageValues.get(key) ?? null),
  key: vi.fn((index: number) => Array.from(localStorageValues.keys())[index] ?? null),
  removeItem: vi.fn((key: string) => {
    localStorageValues.delete(key);
  }),
  setItem: vi.fn((key: string, value: string) => {
    localStorageValues.set(key, value);
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

vi.mock('@tauri-apps/api/webview', () => ({
  getCurrentWebview: () => ({
    setZoom: setZoomMock,
  }),
}));

import { resetZoom, setZoom, setupZoomShortcuts } from './zoom';

describe('setupZoomShortcuts', () => {
  beforeEach(async () => {
    await resetZoom();
    globalThis.localStorage.clear();
    setZoomMock.mockReset();
  });

  it('applies the persisted zoom level when shortcuts are set up', async () => {
    globalThis.localStorage.setItem('stacked:zoom', '1.5');

    setupZoomShortcuts();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setZoomMock).toHaveBeenCalledWith(1.5);
  });

  it('persists zoom changes', async () => {
    await setZoom(1.25);

    expect(globalThis.localStorage.getItem('stacked:zoom')).toBe('1.25');
  });

  it('zooms in for the standard macOS Command+= shortcut', async () => {
    setupZoomShortcuts();

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '=',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(setZoomMock).toHaveBeenCalledWith(1.1);
  });
});
