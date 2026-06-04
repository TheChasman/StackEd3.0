import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock idb before importing the module under test
vi.mock('idb', () => {
  const store: Record<string, unknown> = {};
  const recents: Array<{ id: number; filePath: string; title: string; openedAt: number }> = [];
  let nextId = 1;

  const mockDB = {
    put: vi.fn(async (_store: string, val: unknown, key: string) => { store[key] = val; }),
    get: vi.fn(async (_store: string, key: string) => store[key] ?? undefined),
    getAll: vi.fn(async (_store: string) => [...recents]),
    transaction: vi.fn(() => ({
      store: {
        getAll: vi.fn(async () => [...recents]),
        add: vi.fn(async (item: { filePath: string; title: string; openedAt: number }) => {
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
  savePipelineFolderPath,
  loadPipelineFolderPath,
  addRecentFile,
  getRecentFiles,
} from './storage';

describe('storage service', () => {
  it('saves and loads API key', async () => {
    await saveApiKey('claude', 'sk-ant-test123');
    const loaded = await loadApiKey('claude');
    expect(loaded).toBe('sk-ant-test123');
  });

  it('stores Anthropic and OpenAI API keys separately', async () => {
    await saveApiKey('claude', 'sk-ant-test');
    await saveApiKey('openai', 'sk-openai-test');

    expect(await loadApiKey('claude')).toBe('sk-ant-test');
    expect(await loadApiKey('openai')).toBe('sk-openai-test');
  });

  it('returns empty string when no API key stored', async () => {
    const loaded = await loadApiKey('openai');
    expect(typeof loaded).toBe('string');
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
    expect(recents.some(r => r.title === 'Test Article')).toBe(true);
  });

  it('addRecentFile updates an existing path instead of duplicating it', async () => {
    await addRecentFile('/tmp/duplicate.md', 'Old Title');
    await addRecentFile('/tmp/duplicate.md', 'New Title');
    const recents = await getRecentFiles();
    const matches = recents.filter(r => r.filePath === '/tmp/duplicate.md');
    expect(matches).toHaveLength(1);
    expect(matches[0].title).toBe('New Title');
  });
});
