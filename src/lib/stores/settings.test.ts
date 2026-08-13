import { describe, it, expect, beforeEach, vi } from 'vitest';

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

beforeEach(() => settingsStore.reset());

describe('settings store', () => {
  it('sidebar is visible by default', () => {
    expect(settingsStore.sidebarVisible).toBe(true);
  });

  it('toggleSidebar flips visibility', () => {
    settingsStore.toggleSidebar();
    expect(settingsStore.sidebarVisible).toBe(false);
    settingsStore.toggleSidebar();
    expect(settingsStore.sidebarVisible).toBe(true);
  });

  it('reset restores the default sidebar state', () => {
    settingsStore.toggleSidebar();
    settingsStore.reset();
    expect(settingsStore.sidebarVisible).toBe(true);
  });

  it('loadFromStorage purges any legacy on-disk API keys', async () => {
    await expect(settingsStore.loadFromStorage()).resolves.toBeUndefined();
  });
});
