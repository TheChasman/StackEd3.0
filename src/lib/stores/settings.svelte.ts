import { clearStoredApiKeys } from '$lib/services/storage';

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

class SettingsStore {
  sidebarVisible = $state(true);

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
    getLocalStorage()?.setItem('sidebarVisible', String(this.sidebarVisible));
  }

  /** Call once at app startup to hydrate from persisted storage. */
  async loadFromStorage(): Promise<void> {
    const storage = getLocalStorage();
    const sidebar = storage?.getItem('sidebarVisible');
    if (sidebar !== null && sidebar !== undefined) {
      this.sidebarVisible = sidebar === 'true';
    }
    // AI keys now come from SpockLock at call time; purge any left on disk.
    await clearStoredApiKeys().catch(console.error);
  }

  reset(): void {
    this.sidebarVisible = true;
  }
}

export const settingsStore = new SettingsStore();
