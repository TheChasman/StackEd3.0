import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, unknown> = {};
const recents: Array<{ id: number; filePath: string; title: string; openedAt: number }> = [];
let nextId = 1;

// Mock idb before importing the module under test
vi.mock('idb', () => {
  const mockDB = {
    put: vi.fn(async (_store: string, val: unknown, key: string) => {
      store[key] = val;
    }),
    get: vi.fn(async (_store: string, key: string) => store[key] ?? undefined),
    delete: vi.fn(async (_store: string, key: string) => {
      delete store[key];
    }),
    getAll: vi.fn(async (_store: string) => [...recents]),
    transaction: vi.fn(() => ({
      store: {
        getAll: vi.fn(async () => [...recents]),
        add: vi.fn(async (item: { filePath: string; title: string; openedAt: number }) => {
          recents.push({ ...item, id: nextId++ });
        }),
        delete: vi.fn(async (id: number) => {
          const idx = recents.findIndex((r) => r.id === id);
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
  clearStoredApiKeys,
  savePipelineFolderPath,
  loadPipelineFolderPath,
  addRecentFile,
  getRecentFiles,
  pruneRecentFiles,
  removeRecentFile,
} from './storage';

describe('storage service', () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    recents.splice(0, recents.length);
    nextId = 1;
  });

  it('clearStoredApiKeys deletes any legacy on-disk credentials', async () => {
    store['anthropicApiKey'] = 'sk-ant-legacy';
    store['openaiApiKey'] = 'sk-openai-legacy';
    store['anthropicApiKeySaved'] = true;
    store['openaiApiKeySaved'] = true;
    store['apiKey'] = 'sk-legacy';

    await clearStoredApiKeys();

    for (const key of [
      'anthropicApiKey',
      'openaiApiKey',
      'anthropicApiKeySaved',
      'openaiApiKeySaved',
      'apiKey',
    ]) {
      expect(store[key]).toBeUndefined();
    }
  });

  it('clearStoredApiKeys is idempotent when nothing is stored', async () => {
    await expect(clearStoredApiKeys()).resolves.toBeUndefined();
  });

  it('saves and loads pipeline folder path', async () => {
    await savePipelineFolderPath('/tmp/pipeline');
    const loaded = await loadPipelineFolderPath();
    expect(loaded).toBe('/tmp/pipeline');
  });

  it('returns null or a string for pipeline folder path', async () => {
    const loaded = await loadPipelineFolderPath();
    expect(loaded == null || typeof loaded === 'string').toBe(true);
  });

  it('addRecentFile stores a recent entry', async () => {
    await addRecentFile('/tmp/test.md', 'Test Article');
    const recents = await getRecentFiles();
    expect(recents.some((r) => r.title === 'Test Article')).toBe(true);
  });

  it('addRecentFile updates an existing path instead of duplicating it', async () => {
    await addRecentFile('/tmp/duplicate.md', 'Old Title');
    await addRecentFile('/tmp/duplicate.md', 'New Title');
    const recents = await getRecentFiles();
    const matches = recents.filter((r) => r.filePath === '/tmp/duplicate.md');
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe('New Title');
  });

  it('pruneRecentFiles removes missing entries and persists deletions', async () => {
    await addRecentFile('/tmp/exists.md', 'Exists');
    await addRecentFile('/tmp/missing.md', 'Missing');

    const pruned = await pruneRecentFiles(async (filePath) => filePath !== '/tmp/missing.md');
    expect(pruned.map((recent) => recent.filePath)).toEqual(['/tmp/exists.md']);

    const recentsAfterPrune = await getRecentFiles();
    expect(recentsAfterPrune.map((recent) => recent.filePath)).toEqual(['/tmp/exists.md']);
  });

  it('pruneRecentFiles keeps entries when all paths exist', async () => {
    await addRecentFile('/tmp/one.md', 'One');
    await addRecentFile('/tmp/two.md', 'Two');

    const pruned = await pruneRecentFiles(async () => true);
    expect(pruned).toHaveLength(2);
    expect(pruned.map((recent) => recent.filePath).sort()).toEqual(['/tmp/one.md', '/tmp/two.md']);
  });

  it('removeRecentFile deletes one entry by id', async () => {
    await addRecentFile('/tmp/first.md', 'First');
    await addRecentFile('/tmp/second.md', 'Second');
    const all = await getRecentFiles();

    const first = all.find((recent) => recent.filePath === '/tmp/first.md');
    expect(first?.id).toBeTypeOf('number');

    await removeRecentFile(first!.id!);
    const remaining = await getRecentFiles();

    expect(remaining.map((recent) => recent.filePath)).toEqual(['/tmp/second.md']);
  });
});
