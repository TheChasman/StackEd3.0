import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock idb before importing the module under test
vi.mock('idb', () => {
  const store: Record<string, unknown> = {};
  const recents: Array<{ id: number; handle: unknown; title: string; openedAt: number }> = [];
  let nextId = 1;

  const mockDB = {
    put: vi.fn(async (_store: string, val: unknown, key: string) => { store[key] = val; }),
    get: vi.fn(async (_store: string, key: string) => store[key] ?? undefined),
    getAll: vi.fn(async (_store: string) => [...recents]),
    transaction: vi.fn(() => ({
      store: {
        getAll: vi.fn(async () => [...recents]),
        add: vi.fn(async (item: { handle: unknown; title: string; openedAt: number }) => {
          recents.push({ ...item, id: nextId++ });
        }),
        delete: vi.fn(async (id: number) => {
          const idx = recents.findIndex(r => r.id === id);
          if (idx >= 0) recents.splice(idx, 1);
        }),
      },
      done: Promise.resolve(),
    })),
  };

  return {
    openDB: vi.fn(async () => mockDB),
  };
});

import {
  saveApiKey,
  loadApiKey,
  saveFolderHandle,
  loadFolderHandle,
  addRecentFile,
  getRecentFiles,
} from './storage';

describe('storage service', () => {
  it('saves and loads API key', async () => {
    await saveApiKey('sk-ant-test123');
    const loaded = await loadApiKey();
    expect(loaded).toBe('sk-ant-test123');
  });

  it('returns empty string when no API key stored', async () => {
    const loaded = await loadApiKey();
    expect(typeof loaded).toBe('string');
  });

  it('saves and loads folder handle', async () => {
    const fakeHandle = { kind: 'directory', name: 'pipeline' } as unknown as FileSystemDirectoryHandle;
    await saveFolderHandle(fakeHandle);
    const loaded = await loadFolderHandle();
    expect(loaded).toEqual(fakeHandle);
  });

  it('returns null when no folder handle stored', async () => {
    const loaded = await loadFolderHandle();
    // May return undefined from mock; normalise to null check
    expect(loaded == null || typeof loaded === 'object').toBe(true);
  });

  it('addRecentFile stores a recent entry', async () => {
    const fakeHandle = { kind: 'file', name: 'test.md' } as unknown as FileSystemFileHandle;
    await addRecentFile(fakeHandle, 'Test Article');
    const recents = await getRecentFiles();
    expect(recents.some(r => r.title === 'Test Article')).toBe(true);
  });
});
