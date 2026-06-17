import { beforeEach, describe, expect, it, vi } from 'vitest';

const openDialogMock = vi.hoisted(() => vi.fn());
const saveDialogMock = vi.hoisted(() => vi.fn());
const invokeMock = vi.hoisted(() => vi.fn());
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

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openDialogMock,
  save: saveDialogMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('$lib/services/storage', () => ({
  addRecentFile: vi.fn(async () => {}),
  loadPipelineFolderPath: vi.fn(async () => null),
}));

vi.mock('$lib/services/recentMenu', () => ({
  syncRecentFilesMenu: vi.fn(async () => {}),
}));

import { openFile } from './files';

describe('files service', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    openDialogMock.mockReset();
    saveDialogMock.mockReset();
    invokeMock.mockReset();
    openDialogMock.mockResolvedValue('/tmp/article.md');
    invokeMock.mockResolvedValue('---\nTITLE: Test Article\n---\n\nBody');
  });

  it('uses the Substack folder as the Open File fallback location', async () => {
    await openFile();

    expect(openDialogMock).toHaveBeenCalledWith({
      title: 'Open Markdown File',
      multiple: false,
      defaultPath: '/Users/chasnewport/Obsidian/O_Substack',
    });
  });

  it('uses the remembered folder before the Open File fallback location', async () => {
    globalThis.localStorage.setItem('stacked:lastSavedFolder', '/tmp/remembered');

    await openFile();

    expect(openDialogMock).toHaveBeenCalledWith({
      title: 'Open Markdown File',
      multiple: false,
      defaultPath: '/tmp/remembered',
    });
  });
});
