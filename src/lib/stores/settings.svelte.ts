import { loadApiKey, saveApiKey } from '$lib/services/storage';

class SettingsStore {
  provider = $state<'claude' | 'openai'>('claude');
  apiKey = $state('');
  sidebarVisible = $state(true);

  get hasValidKey(): boolean {
    return this.apiKey.trim().length > 0;
  }

  setProvider(provider: 'claude' | 'openai'): void {
    this.provider = provider;
    localStorage.setItem('provider', provider);
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    // Fire-and-forget to IndexedDB
    saveApiKey(key).catch(console.error);
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
    localStorage.setItem('sidebarVisible', String(this.sidebarVisible));
  }

  /** Call once at app startup to hydrate from persisted storage. */
  async loadFromStorage(): Promise<void> {
    const provider = localStorage.getItem('provider');
    if (provider === 'claude' || provider === 'openai') {
      this.provider = provider;
    }
    const sidebar = localStorage.getItem('sidebarVisible');
    if (sidebar !== null) {
      this.sidebarVisible = sidebar === 'true';
    }
    this.apiKey = await loadApiKey();
  }

  reset(): void {
    this.provider = 'claude';
    this.apiKey = '';
    this.sidebarVisible = true;
  }
}

export const settingsStore = new SettingsStore();
