import { clearStoredApiKeys } from '$lib/services/storage';

export type ToolTab = 'research' | 'artwork' | 'generate';
export type LibraryViewMode = 'list' | 'calendar';

const TOOL_TABS: readonly ToolTab[] = ['research', 'artwork', 'generate'];

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

class SettingsStore {
  /** The Write tools drawer (Research / Artwork / Generate). Closed by
   * default; remembered per session (design spec §2.2). */
  toolsDrawerOpen = $state(false);
  activeTool = $state<ToolTab>('research');
  libraryViewMode = $state<LibraryViewMode>('list');

  toggleToolsDrawer(): void {
    this.toolsDrawerOpen = !this.toolsDrawerOpen;
    this.persist();
  }

  openTools(tab: ToolTab): void {
    this.activeTool = tab;
    this.toolsDrawerOpen = true;
    this.persist();
  }

  setLibraryViewMode(mode: LibraryViewMode): void {
    this.libraryViewMode = mode;
    this.persist();
  }

  private persist(): void {
    const storage = getLocalStorage();
    storage?.setItem('toolsDrawerOpen', String(this.toolsDrawerOpen));
    storage?.setItem('activeTool', this.activeTool);
    storage?.setItem('libraryViewMode', this.libraryViewMode);
  }

  /** Call once at app startup to hydrate from persisted storage. */
  async loadFromStorage(): Promise<void> {
    const storage = getLocalStorage();
    const drawer = storage?.getItem('toolsDrawerOpen');
    if (drawer !== null && drawer !== undefined) {
      this.toolsDrawerOpen = drawer === 'true';
    }
    const tool = storage?.getItem('activeTool');
    if (tool && TOOL_TABS.includes(tool as ToolTab)) {
      this.activeTool = tool as ToolTab;
    }
    const mode = storage?.getItem('libraryViewMode');
    if (mode === 'list' || mode === 'calendar') {
      this.libraryViewMode = mode;
    }
    // AI keys now come from SpockLock at call time; purge any left on disk.
    await clearStoredApiKeys().catch(console.error);
  }

  reset(): void {
    this.toolsDrawerOpen = false;
    this.activeTool = 'research';
    this.libraryViewMode = 'list';
  }
}

export const settingsStore = new SettingsStore();
