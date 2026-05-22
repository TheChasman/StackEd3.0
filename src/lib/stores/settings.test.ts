import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock idb since storage.ts uses it
vi.mock('idb', () => {
  const store: Record<string, unknown> = {};
  const mockDB = {
    put: vi.fn(async (_store: string, val: unknown, key: string) => { store[key] = val; }),
    get: vi.fn(async (_store: string, key: string) => store[key] ?? undefined),
    getAll: vi.fn(async () => []),
    transaction: vi.fn(() => ({ store: { getAll: vi.fn(async () => []), add: vi.fn(), delete: vi.fn() }, done: Promise.resolve() })),
  };
  return { openDB: vi.fn(async () => mockDB) };
});

import { settingsStore } from './settings.svelte';

beforeEach(() => settingsStore.reset());

describe('settings store', () => {
  it('defaults to claude provider', () => {
    expect(settingsStore.provider).toBe('claude');
  });

  it('defaults to empty API key', () => {
    expect(settingsStore.apiKey).toBe('');
  });

  it('hasValidKey is false with empty key', () => {
    expect(settingsStore.hasValidKey).toBe(false);
  });

  it('hasValidKey is true with a non-empty key', () => {
    settingsStore.setApiKey('sk-ant-test');
    expect(settingsStore.hasValidKey).toBe(true);
  });

  it('setProvider updates the provider', () => {
    settingsStore.setProvider('openai');
    expect(settingsStore.provider).toBe('openai');
  });

  it('setApiKey updates the key', () => {
    settingsStore.setApiKey('sk-abc');
    expect(settingsStore.apiKey).toBe('sk-abc');
  });

  it('sidebar is visible by default', () => {
    expect(settingsStore.sidebarVisible).toBe(true);
  });

  it('toggleSidebar flips visibility', () => {
    settingsStore.toggleSidebar();
    expect(settingsStore.sidebarVisible).toBe(false);
    settingsStore.toggleSidebar();
    expect(settingsStore.sidebarVisible).toBe(true);
  });
});
