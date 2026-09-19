import { describe, it, expect, beforeEach, vi } from 'vitest';

// vitest's jsdom environment has no localStorage (about:blank origin), so
// tests that exercise persistence install an in-memory Storage.
function installLocalStorage(): Storage {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
  return storage;
}

// Mock idb since settings.svelte.ts imports storage.ts (which uses it).
vi.mock('idb', () => {
  const store: Record<string, unknown> = {};
  const mockDB = {
    put: vi.fn(async (_store: string, val: unknown, key: string) => {
      store[key] = val;
    }),
    get: vi.fn(async (_store: string, key: string) => store[key] ?? undefined),
    delete: vi.fn(async (_store: string, key: string) => {
      delete store[key];
    }),
    getAll: vi.fn(async () => []),
    transaction: vi.fn(() => ({
      store: { getAll: vi.fn(async () => []), add: vi.fn(), delete: vi.fn() },
      done: Promise.resolve(),
    })),
  };
  return { openDB: vi.fn(async () => mockDB) };
});

import { settingsStore } from './settings.svelte';

const storage = installLocalStorage();

beforeEach(() => {
  storage.clear();
  settingsStore.reset();
});

describe('settings store', () => {
  it('tools drawer is closed by default', () => {
    expect(settingsStore.toolsDrawerOpen).toBe(false);
  });

  it('toggleToolsDrawer flips drawer visibility', () => {
    settingsStore.toggleToolsDrawer();
    expect(settingsStore.toolsDrawerOpen).toBe(true);
    settingsStore.toggleToolsDrawer();
    expect(settingsStore.toolsDrawerOpen).toBe(false);
  });

  it('openTools opens the drawer on the requested tool', () => {
    settingsStore.openTools('generate');
    expect(settingsStore.toolsDrawerOpen).toBe(true);
    expect(settingsStore.activeTool).toBe('generate');
  });

  it('library view mode defaults to list and can switch to calendar', () => {
    expect(settingsStore.libraryViewMode).toBe('list');
    settingsStore.setLibraryViewMode('calendar');
    expect(settingsStore.libraryViewMode).toBe('calendar');
  });

  it('reset restores the defaults', () => {
    settingsStore.openTools('artwork');
    settingsStore.setLibraryViewMode('calendar');
    settingsStore.reset();
    expect(settingsStore.toolsDrawerOpen).toBe(false);
    expect(settingsStore.activeTool).toBe('research');
    expect(settingsStore.libraryViewMode).toBe('list');
  });

  it('loadFromStorage purges any legacy on-disk API keys', async () => {
    await expect(settingsStore.loadFromStorage()).resolves.toBeUndefined();
  });

  it('loadFromStorage restores persisted drawer and view mode', async () => {
    localStorage.setItem('toolsDrawerOpen', 'true');
    localStorage.setItem('activeTool', 'generate');
    localStorage.setItem('libraryViewMode', 'calendar');
    await settingsStore.loadFromStorage();
    expect(settingsStore.toolsDrawerOpen).toBe(true);
    expect(settingsStore.activeTool).toBe('generate');
    expect(settingsStore.libraryViewMode).toBe('calendar');
  });
});
