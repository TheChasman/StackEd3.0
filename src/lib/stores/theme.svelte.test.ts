import { describe, it, expect, beforeEach, vi } from 'vitest';

// vitest's jsdom environment has no localStorage (about:blank origin), so
// the store tests install an in-memory Storage.
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

const storage = installLocalStorage();

describe('theme store', () => {
  beforeEach(() => {
    storage.clear();
    document.documentElement.style.cssText = '';
    vi.resetModules();
  });

  async function freshStore() {
    const mod = await import('./theme.svelte');
    return mod.themeStore;
  }

  it('defaults to mocha and applies the palette', async () => {
    const store = await freshStore();
    expect(store.currentFlavor).toBe('mocha');
    expect(store.isLoaded).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--cat-base')).toBe('#1e1e2e');
  });

  it('restores a saved flavour', async () => {
    localStorage.setItem('catppuccinFlavor', 'frappe');
    const store = await freshStore();
    expect(store.currentFlavor).toBe('frappe');
    expect(document.documentElement.style.getPropertyValue('--cat-base')).toBe('#303446');
  });

  it('ignores an unknown stored flavour', async () => {
    localStorage.setItem('catppuccinFlavor', 'not-a-flavor');
    const store = await freshStore();
    expect(store.currentFlavor).toBe('mocha');
  });

  it('setFlavor applies and persists the choice', async () => {
    const store = await freshStore();
    store.setFlavor('latte');
    expect(store.currentFlavor).toBe('latte');
    expect(document.documentElement.style.getPropertyValue('--cat-base')).toBe('#eff1f5');
    expect(localStorage.getItem('catppuccinFlavor')).toBe('latte');
  });
});
