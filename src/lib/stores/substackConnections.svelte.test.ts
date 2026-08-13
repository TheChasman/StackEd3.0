import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock idb so storage.ts persists into an in-memory map for this suite.
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
  return { openDB: vi.fn(async () => mockDB), __store: store };
});

import { substackConnectionsStore, normaliseSubdomain } from './substackConnections.svelte';
import { loadSubstackConnections } from '$lib/services/storage';

beforeEach(async () => {
  // Wipe both the in-memory store and the live rune state between tests.
  const existing = await loadSubstackConnections();
  for (const c of [...existing]) await substackConnectionsStore.deleteConnection(c.id);
  substackConnectionsStore.reset();
  await substackConnectionsStore.load();
});

describe('normaliseSubdomain', () => {
  it('trims and lowercases', () => {
    expect(normaliseSubdomain('  ChasMan1  ')).toBe('chasman1');
  });

  it('strips scheme and trailing slash', () => {
    expect(normaliseSubdomain('https://myblog/')).toBe('myblog');
  });

  it('strips a pasted .substack.com host', () => {
    expect(normaliseSubdomain('https://myblog.substack.com')).toBe('myblog');
    expect(normaliseSubdomain('myblog.substack.com/')).toBe('myblog');
  });

  it('returns empty string for blank input', () => {
    expect(normaliseSubdomain('   ')).toBe('');
  });
});

describe('addConnection', () => {
  it('adds a normalised connection, nickname defaults to subdomain', async () => {
    const res = await substackConnectionsStore.addConnection({ subdomain: 'MyBlog' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.connection.subdomain).toBe('myblog');
      expect(res.connection.nickname).toBe('myblog');
      expect(res.connection.id).toBeTruthy();
    }
    expect(substackConnectionsStore.connections).toHaveLength(1);
  });

  it('uses a provided nickname', async () => {
    const res = await substackConnectionsStore.addConnection({
      subdomain: 'myblog',
      nickname: 'Main',
    });
    expect(res.ok && res.connection.nickname).toBe('Main');
  });

  it('rejects empty subdomains', async () => {
    const res = await substackConnectionsStore.addConnection({ subdomain: '   ' });
    expect(res).toEqual({ ok: false, error: 'empty' });
    expect(substackConnectionsStore.connections).toHaveLength(0);
  });

  it('rejects duplicate subdomains case-insensitively', async () => {
    await substackConnectionsStore.addConnection({ subdomain: 'myblog' });
    const res = await substackConnectionsStore.addConnection({ subdomain: 'MYBLOG' });
    expect(res).toEqual({ ok: false, error: 'duplicate' });
    expect(substackConnectionsStore.connections).toHaveLength(1);
  });

  it('writes through to storage', async () => {
    await substackConnectionsStore.addConnection({ subdomain: 'myblog' });
    const persisted = await loadSubstackConnections();
    expect(persisted).toHaveLength(1);
    expect(persisted[0].subdomain).toBe('myblog');
  });
});

describe('renameConnection', () => {
  it('updates the nickname and persists', async () => {
    const res = await substackConnectionsStore.addConnection({ subdomain: 'myblog' });
    const id = res.ok ? res.connection.id : '';
    await substackConnectionsStore.renameConnection(id, 'Renamed');
    expect(substackConnectionsStore.connections[0].nickname).toBe('Renamed');
    const persisted = await loadSubstackConnections();
    expect(persisted[0].nickname).toBe('Renamed');
  });
});

describe('deleteConnection', () => {
  it('removes the connection and persists', async () => {
    const res = await substackConnectionsStore.addConnection({ subdomain: 'myblog' });
    const id = res.ok ? res.connection.id : '';
    await substackConnectionsStore.deleteConnection(id);
    expect(substackConnectionsStore.connections).toHaveLength(0);
    expect(await loadSubstackConnections()).toHaveLength(0);
  });
});

describe('findBySubdomain', () => {
  it('matches case-insensitively', async () => {
    await substackConnectionsStore.addConnection({ subdomain: 'myblog' });
    expect(substackConnectionsStore.findBySubdomain('MYBLOG')?.subdomain).toBe('myblog');
    expect(substackConnectionsStore.findBySubdomain('nope')).toBeUndefined();
  });
});

describe('ensureConnectionForSubdomain', () => {
  it('creates a connection when none matches', async () => {
    const c = await substackConnectionsStore.ensureConnectionForSubdomain('newblog');
    expect(c?.subdomain).toBe('newblog');
    expect(c?.nickname).toBe('newblog');
    expect(substackConnectionsStore.connections).toHaveLength(1);
  });

  it('returns the existing match across case differences without duplicating', async () => {
    const added = await substackConnectionsStore.addConnection({
      subdomain: 'myblog',
      nickname: 'Main',
    });
    const ensured = await substackConnectionsStore.ensureConnectionForSubdomain('MyBlog');
    expect(ensured?.id).toBe(added.ok ? added.connection.id : undefined);
    expect(ensured?.nickname).toBe('Main');
    expect(substackConnectionsStore.connections).toHaveLength(1);
  });

  it('no-ops on empty input', async () => {
    const c = await substackConnectionsStore.ensureConnectionForSubdomain('   ');
    expect(c).toBeNull();
    expect(substackConnectionsStore.connections).toHaveLength(0);
  });
});
