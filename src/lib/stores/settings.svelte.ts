import { hasExplicitApiKey, loadApiKey, saveApiKey, type ApiProvider } from '$lib/services/storage';

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

class SettingsStore {
  provider = $state<ApiProvider>('claude');
  anthropicApiKey = $state('');
  openaiApiKey = $state('');
  sidebarVisible = $state(true);

  get apiKey(): string {
    return this.provider === 'claude' ? this.anthropicApiKey : this.openaiApiKey;
  }

  get hasValidKey(): boolean {
    return this.apiKey.trim().length > 0;
  }

  setProvider(provider: ApiProvider): void {
    this.provider = provider;
    getLocalStorage()?.setItem('provider', provider);
  }

  setApiKey(key: string, provider: ApiProvider = this.provider): void {
    if (provider === 'claude') {
      this.anthropicApiKey = key;
    } else {
      this.openaiApiKey = key;
    }
    saveApiKey(provider, key).catch(console.error);
  }

  setAnthropicApiKey(key: string): void {
    this.setApiKey(key, 'claude');
  }

  setOpenAIApiKey(key: string): void {
    this.setApiKey(key, 'openai');
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
    getLocalStorage()?.setItem('sidebarVisible', String(this.sidebarVisible));
  }

  /** Call once at app startup to hydrate from persisted storage. */
  async loadFromStorage(): Promise<void> {
    const storage = getLocalStorage();
    const provider = storage?.getItem('provider');
    if (provider === 'claude' || provider === 'openai') {
      this.provider = provider;
    }
    const sidebar = storage?.getItem('sidebarVisible');
    if (sidebar !== null) {
      this.sidebarVisible = sidebar === 'true';
    }
    const [anthropicApiKey, openaiApiKey, hasOpenAIKey] = await Promise.all([
      loadApiKey('claude'),
      loadApiKey('openai'),
      hasExplicitApiKey('openai'),
    ]);
    this.anthropicApiKey = anthropicApiKey;
    this.openaiApiKey = !hasOpenAIKey && openaiApiKey === anthropicApiKey ? '' : openaiApiKey;
    if (!hasOpenAIKey && openaiApiKey && openaiApiKey === anthropicApiKey) {
      saveApiKey('openai', '').catch(console.error);
    }
  }

  reset(): void {
    this.provider = 'claude';
    this.anthropicApiKey = '';
    this.openaiApiKey = '';
    this.sidebarVisible = true;
  }
}

export const settingsStore = new SettingsStore();
