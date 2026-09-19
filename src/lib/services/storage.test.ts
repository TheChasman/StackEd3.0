import { describe, it, expect, beforeEach, vi } from 'vitest';

const store: Record<string, unknown> = {};
const recents: Array<{ id: number; filePath: string; title: string; openedAt: number }> = [];
const library: Array<Record<string, unknown>> = [];
let nextId = 1;

// Mock idb before importing the module under test
vi.mock('idb', () => {
  const mockDB = {
    put: vi.fn(async (storeName: string, val: unknown, key?: string) => {
      if (storeName === 'library') {
        const entry = val as Record<string, unknown>;
        const idx = library.findIndex((e) => e.filePath === entry.filePath);
        if (idx >= 0) library[idx] = entry;
        else library.push(entry);
      } else if (key !== undefined) {
        store[key] = val;
      }
    }),
    get: vi.fn(async (_store: string, key: string) => store[key] ?? undefined),
    delete: vi.fn(async (storeName: string, key: string) => {
      if (storeName === 'library') {
        const idx = library.findIndex((e) => e.filePath === key);
        if (idx >= 0) library.splice(idx, 1);
      } else {
        delete store[key];
      }
    }),
    getAll: vi.fn(async (storeName: string) =>
      storeName === 'library' ? [...library] : [...recents],
    ),
    transaction: vi.fn((storeName: string) => ({
      store: {
        getAll: vi.fn(async () => (storeName === 'library' ? [...library] : [...recents])),
        add: vi.fn(async (item: { filePath: string; title: string; openedAt: number }) => {
          recents.push({ ...item, id: nextId++ });
        }),
        delete: vi.fn(async (key: number | string) => {
          if (storeName === 'library') {
            const idx = library.findIndex((e) => e.filePath === key);
            if (idx >= 0) library.splice(idx, 1);
          } else {
            const idx = recents.findIndex((r) => r.id === key);
            if (idx >= 0) recents.splice(idx, 1);
          }
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
  addRecentFile,
  getRecentFiles,
  pruneRecentFiles,
  removeRecentFile,
  upsertLibraryEntry,
  listLibraryEntries,
  pruneLibraryEntries,
  type LibraryEntry,
} from './storage';

function entry(overrides: Partial<LibraryEntry> = {}): LibraryEntry {
  return {
    filePath: '/tmp/a.stacked.json',
    title: 'A draft',
    subtitle: '',
    state: 'draft',
    targetDate: null,
    publication: '',
    updated: '2026-09-19T10:00:00.000Z',
    wordCount: 100,
    ...overrides,
  };
}

describe('storage service', () => {
  beforeEach(() => {
    Object.keys(store).forEach((key) => delete store[key]);
    recents.splice(0, recents.length);
    library.splice(0, library.length);
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

  it('upsertLibraryEntry inserts then updates by filePath', async () => {
    await upsertLibraryEntry(entry());
    await upsertLibraryEntry(entry({ title: 'A draft v2' }));
    const entries = await listLibraryEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].title).toBe('A draft v2');
  });

  it('listLibraryEntries sorts by updated, newest first', async () => {
    await upsertLibraryEntry(
      entry({ filePath: '/tmp/old.json', updated: '2026-09-01T00:00:00.000Z' }),
    );
    await upsertLibraryEntry(
      entry({ filePath: '/tmp/new.json', updated: '2026-09-19T00:00:00.000Z' }),
    );
    const entries = await listLibraryEntries();
    expect(entries.map((e) => e.filePath)).toEqual(['/tmp/new.json', '/tmp/old.json']);
  });

  it('pruneLibraryEntries removes missing files and returns survivors', async () => {
    await upsertLibraryEntry(entry({ filePath: '/tmp/exists.json' }));
    await upsertLibraryEntry(entry({ filePath: '/tmp/missing.json' }));

    const survivors = await pruneLibraryEntries(
      async (filePath) => filePath !== '/tmp/missing.json',
    );
    expect(survivors.map((e) => e.filePath)).toEqual(['/tmp/exists.json']);

    const after = await listLibraryEntries();
    expect(after.map((e) => e.filePath)).toEqual(['/tmp/exists.json']);
  });

  it('pruneLibraryEntries returns empty without touching the store when empty', async () => {
    const survivors = await pruneLibraryEntries(async () => true);
    expect(survivors).toEqual([]);
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
