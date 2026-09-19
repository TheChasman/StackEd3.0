<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { message } from '@tauri-apps/plugin-dialog';
  import LibraryView from '$lib/components/library/LibraryView.svelte';
  import WriteView from '$lib/components/write/WriteView.svelte';
  import PlanView from '$lib/components/plan/PlanView.svelte';
  import FinishView from '$lib/components/finish/FinishView.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import RecentFiles from '$lib/components/RecentFiles.svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { substackConnectionsStore } from '$lib/stores/substackConnections.svelte';
  import { viewStore } from '$lib/stores/view.svelte';
  import '$lib/stores/theme.svelte'; // applies the saved Catppuccin flavour at startup
  import {
    createNewScaffold,
    openScaffold,
    openScaffoldPath,
    saveScaffoldPath,
    saveScaffoldAs,
  } from '$lib/services/files';
  import { setupZoomShortcuts } from '$lib/utils/zoom';
  import { syncRecentFilesMenu } from '$lib/services/recentMenu';
  import '$lib/themes/catppuccin.css';

  let showSettings = $state(false);
  let showRecents = $state(false);
  let saveStatus = $state<'' | 'unsaved' | 'saving' | 'saved'>('');

  // --- Autosave (design spec §4.5): 4s debounce, path-backed documents only ---
  const AUTOSAVE_DEBOUNCE_MS = 4000;
  let autosaveTimer: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    const dirty = documentStore.dirty;
    const filePath = documentStore.filePath;
    void documentStore.editTick;
    if (dirty) saveStatus = 'unsaved';
    if (autosaveTimer) clearTimeout(autosaveTimer);
    if (dirty && filePath) {
      autosaveTimer = setTimeout(() => {
        void handleAutosave();
      }, AUTOSAVE_DEBOUNCE_MS);
    }
    return () => {
      if (autosaveTimer) clearTimeout(autosaveTimer);
    };
  });

  async function handleAutosave(): Promise<void> {
    if (!documentStore.scaffold || !documentStore.filePath || !documentStore.dirty) return;
    saveStatus = 'saving';
    try {
      await saveScaffoldPath(documentStore.filePath, documentStore.scaffold);
      documentStore.markClean();
      saveStatus = 'saved';
    } catch (e) {
      console.error('Autosave failed:', e);
      saveStatus = 'unsaved';
    }
  }

  async function loadFilePath(filePath: string) {
    try {
      const scaffold = await openScaffoldPath(filePath);
      documentStore.openInNewTab(scaffold, filePath);
      viewStore.openDocument();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('No file selected')) {
        alert(`Could not open file:\n${filePath}\n\n${msg}`);
      }
    }
  }

  onMount(() => {
    let unlistenOpenFile: (() => void) | undefined;
    let unlistenMenuNew: (() => void) | undefined;
    let unlistenMenuNewTab: (() => void) | undefined;
    let unlistenMenuOpen: (() => void) | undefined;
    let unlistenMenuOpenRecent: (() => void) | undefined;
    let unlistenMenuSave: (() => void) | undefined;
    let unlistenMenuSaveAs: (() => void) | undefined;
    let unlistenCloseRequested: (() => void) | undefined;
    let closeAllowed = false;
    const appWindow = getCurrentWindow();
    void listen<string>('stacked:open-file', (event) => {
      void loadFilePath(event.payload);
    }).then((unlisten) => {
      unlistenOpenFile = unlisten;
    });
    void listen('stacked:menu-new', () => {
      void handleNew();
    }).then((unlisten) => {
      unlistenMenuNew = unlisten;
    });
    void listen('stacked:menu-new-tab', () => {
      documentStore.newTab();
      viewStore.openDocument();
    }).then((unlisten) => {
      unlistenMenuNewTab = unlisten;
    });
    void listen('stacked:menu-open', () => {
      void handleOpen();
    }).then((unlisten) => {
      unlistenMenuOpen = unlisten;
    });
    void listen<string>('stacked:menu-open-recent', (event) => {
      void loadFilePath(event.payload);
    }).then((unlisten) => {
      unlistenMenuOpenRecent = unlisten;
    });
    void listen('stacked:menu-save', () => {
      void handleSave();
    }).then((unlisten) => {
      unlistenMenuSave = unlisten;
    });
    void listen('stacked:menu-save-as', () => {
      void handleSaveAs();
    }).then((unlisten) => {
      unlistenMenuSaveAs = unlisten;
    });
    void appWindow
      .onCloseRequested(async (event) => {
        if (closeAllowed) return;
        const dirtyIndex = documentStore.tabMetas.findIndex((tab) => tab.dirty);
        if (dirtyIndex === -1) return;

        event.preventDefault();
        const dirtyTitle = documentStore.tabMetas[dirtyIndex]?.title ?? 'Untitled';
        const choice = await message(`Save changes to "${dirtyTitle}" before quitting?`, {
          title: 'Unsaved Changes',
          kind: 'warning',
          buttons: { yes: 'Save', no: "Don't Save", cancel: 'Cancel' },
        });

        if (choice === 'Cancel') return;
        if (choice === "Don't Save") {
          closeAllowed = true;
          await appWindow.destroy();
          return;
        }

        if (choice === 'Save') {
          documentStore.switchTab(dirtyIndex);
          await handleSave();
          if (!documentStore.tabMetas.some((tab) => tab.dirty)) {
            closeAllowed = true;
            await appWindow.destroy();
          }
        }
      })
      .then((unlisten) => {
        unlistenCloseRequested = unlisten;
      });

    void (async () => {
      await settingsStore.loadFromStorage();
      await substackConnectionsStore.load().catch(console.error);
      const initialPath = await invoke<string | null>('initial_file_path').catch(() => null);
      if (initialPath) {
        await loadFilePath(initialPath);
      }
      setupZoomShortcuts();
      await syncRecentFilesMenu();
    })();

    return () => {
      unlistenOpenFile?.();
      unlistenMenuNew?.();
      unlistenMenuNewTab?.();
      unlistenMenuOpen?.();
      unlistenMenuOpenRecent?.();
      unlistenMenuSave?.();
      unlistenMenuSaveAs?.();
      unlistenCloseRequested?.();
    };
  });

  async function handleOpen() {
    try {
      const scaffold = await openScaffold();
      if (scaffold) {
        documentStore.openInNewTab(scaffold);
        viewStore.openDocument();
      }
    } catch (e) {
      alert('Open failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  async function handleNew() {
    try {
      const result = await createNewScaffold();
      if (result) {
        documentStore.openInNewTab(result.scaffold, result.filePath);
        viewStore.openDocument();
      }
    } catch (e) {
      alert('New file failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  function handleCloseTab(index: number) {
    const meta = documentStore.tabMetas[index];
    if (meta.dirty && !window.confirm(`Close "${meta.title}" without saving?`)) return;
    documentStore.closeTab(index);
  }

  async function handleSave(): Promise<string | null> {
    if (!documentStore.scaffold) return null;
    if (!documentStore.filePath) {
      return handleSaveAs();
    }
    try {
      await saveScaffoldPath(documentStore.filePath, documentStore.scaffold);
      documentStore.markClean();
      saveStatus = 'saved';
      return documentStore.filePath;
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : e));
      return null;
    }
  }

  async function handleSaveAs(): Promise<string | null> {
    if (!documentStore.scaffold) return null;
    try {
      const filePath = await saveScaffoldAs(documentStore.scaffold);
      if (filePath) {
        documentStore.load(documentStore.scaffold, filePath, false);
        saveStatus = 'saved';
        return filePath;
      }
    } catch (e) {
      alert('Save As failed: ' + (e instanceof Error ? e.message : e));
    }
    return null;
  }

  function handleSaveEvent() {
    void handleSave();
  }

  async function ensureArticlePath(): Promise<string | null> {
    if (documentStore.filePath) return documentStore.filePath;
    return handleSave();
  }

  function handleEnsureArticlePathEvent(event: Event) {
    const { resolve } =
      (event as CustomEvent<{ resolve: (path: string | null) => void }>).detail || {};
    void ensureArticlePath()
      .then((path) => resolve?.(path))
      .catch(() => resolve?.(null));
  }

  function openImageGenerator() {
    settingsStore.openTools('generate');
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 't') {
        e.preventDefault();
        documentStore.newTab();
        viewStore.openDocument();
      }
    }
  }

  $effect(() => {
    window.addEventListener('stacked:save', handleSaveEvent);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('stacked:open-image-generator', openImageGenerator);
    window.addEventListener('stacked:ensure-article-path', handleEnsureArticlePathEvent);
    return () => {
      window.removeEventListener('stacked:save', handleSaveEvent);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('stacked:open-image-generator', openImageGenerator);
      window.removeEventListener('stacked:ensure-article-path', handleEnsureArticlePathEvent);
    };
  });

  $effect(() => {
    const fileName = documentStore.filePath?.split('/').pop() ?? null;
    document.title = fileName ? `StackEd 3 — ${documentStore.title || fileName}` : 'StackEd 3';
  });
</script>

<!-- Tab bar (visible when 2+ tabs are open and a document space is showing) -->
{#if viewStore.current !== 'library' && documentStore.tabCount > 1}
  <div
    class="flex items-end gap-0 border-b border-dark-700 bg-dark-800 px-2 shrink-0 overflow-x-auto"
  >
    {#each documentStore.tabMetas as tab, i}
      <button
        onclick={() => documentStore.switchTab(i)}
        class="flex items-center gap-1.5 px-3 py-1.5 text-sm border-x border-t border-b-0 rounded-t shrink-0 max-w-48
          {documentStore.activeIndex === i
          ? 'border-dark-600 bg-dark-900 text-dark-100 -mb-px'
          : 'border-transparent text-dark-400 hover:text-dark-200'}"
      >
        {#if tab.dirty}<span class="text-primary-400 text-xs">●</span>{/if}
        <span class="truncate">{tab.title}</span>
        <span
          role="button"
          tabindex="0"
          class="ml-0.5 text-dark-500 hover:text-dark-200 leading-none"
          onclick={(e) => {
            e.stopPropagation();
            handleCloseTab(i);
          }}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation();
              handleCloseTab(i);
            }
          }}>×</span
        >
      </button>
    {/each}
  </div>
{/if}

<!-- Main area: exactly one space on screen at a time -->
<div class="flex flex-1 min-h-0 overflow-hidden">
  <div class="flex-1 min-w-0 flex flex-col">
    {#if viewStore.current === 'library'}
      <LibraryView
        onnew={handleNew}
        onopen={handleOpen}
        onopenpath={loadFilePath}
        onrecents={() => (showRecents = true)}
        onsettings={() => (showSettings = true)}
      />
    {:else if viewStore.current === 'write'}
      <WriteView />
    {:else if viewStore.current === 'plan'}
      <PlanView />
    {:else if viewStore.current === 'finish'}
      <FinishView />
    {/if}
  </div>
</div>

{#if viewStore.current !== 'library'}
  <StatusBar {saveStatus} />
{/if}

<!-- Modals -->
{#if showSettings}
  <SettingsModal open={showSettings} onclose={() => (showSettings = false)} />
{/if}
{#if showRecents}
  <RecentFiles onclose={() => (showRecents = false)} />
{/if}
