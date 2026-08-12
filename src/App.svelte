<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { message } from '@tauri-apps/plugin-dialog';
  import { Clock3, FilePlus2, FolderOpen, PanelRight, Save, SaveAll, Settings } from 'lucide-svelte';
  import Editor from '$lib/components/editor/Editor.svelte';
  import ScaffoldPanel from '$lib/components/scaffold/ScaffoldPanel.svelte';
  import ResearchPanel from '$lib/components/research/ResearchPanel.svelte';
  import ArtworkPanel from '$lib/components/artwork/ArtworkPanel.svelte';
  import ImageGenerationPanel from '$lib/components/image-generation/ImageGenerationPanel.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import RecentFiles from '$lib/components/RecentFiles.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import ThemeBrowser from '$lib/components/ThemeBrowser.svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { substackConnectionsStore } from '$lib/stores/substackConnections.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { createNewScaffold, openScaffold, openScaffoldPath, saveScaffoldPath, saveScaffoldAs, titleFromFilePath, writeFilePath } from '$lib/services/files';
  import { buildLabel } from '$lib/utils/buildInfo';
  import { setupZoomShortcuts } from '$lib/utils/zoom';
  import { syncRecentFilesMenu } from '$lib/services/recentMenu';
  import '$lib/themes/catppuccin.css';

  let showSettings = $state(false);
  let showRecents = $state(false);
  let showThemeBrowser = $state(false);
  let activeToolTab = $state<'scaffold' | 'research' | 'artwork' | 'generate'>('scaffold');
  let sidebarWidth = $state(320);
  let isResizing = $state(false);

  const SIDEBAR_MIN_WIDTH = 320;
  const SIDEBAR_MAX_WIDTH = 600;

  function clampSidebarWidth(width: number): number {
    if (!Number.isFinite(width)) return SIDEBAR_MIN_WIDTH;
    return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
  }

  async function loadFilePath(filePath: string) {
    try {
      const scaffold = await openScaffoldPath(filePath);
      documentStore.openInNewTab(scaffold, filePath);
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
    void listen('stacked:menu-new', () => { void handleNew(); }).then((unlisten) => {
      unlistenMenuNew = unlisten;
    });
    void listen('stacked:menu-new-tab', () => { documentStore.newTab(); }).then((unlisten) => {
      unlistenMenuNewTab = unlisten;
    });
    void listen('stacked:menu-open', () => { void handleOpen(); }).then((unlisten) => {
      unlistenMenuOpen = unlisten;
    });
    void listen<string>('stacked:menu-open-recent', (event) => {
      void loadFilePath(event.payload);
    }).then((unlisten) => {
      unlistenMenuOpenRecent = unlisten;
    });
    void listen('stacked:menu-save', () => { void handleSave(); }).then((unlisten) => {
      unlistenMenuSave = unlisten;
    });
    void listen('stacked:menu-save-as', () => { void handleSaveAs(); }).then((unlisten) => {
      unlistenMenuSaveAs = unlisten;
    });
    void appWindow.onCloseRequested(async (event) => {
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
    }).then((unlisten) => {
      unlistenCloseRequested = unlisten;
    });

    void (async () => {
      await settingsStore.loadFromStorage();
      await substackConnectionsStore.load().catch(console.error);
      const initialPath = await invoke<string | null>('initial_file_path').catch(() => null);
      if (initialPath) {
        await loadFilePath(initialPath);
      }
      const savedToolTab = localStorage.getItem('activeToolTab');
      activeToolTab = (['scaffold', 'research', 'artwork', 'generate'] as const).includes(savedToolTab as any)
        ? savedToolTab as typeof activeToolTab
        : 'scaffold';
      const savedWidth = localStorage.getItem('sidebarWidth');
      if (savedWidth) sidebarWidth = clampSidebarWidth(parseInt(savedWidth, 10));
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

  function handleMouseDown() { isResizing = true; }
  function handleMouseUp() { isResizing = false; }
  function handleMouseMove(e: MouseEvent) {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    sidebarWidth = clampSidebarWidth(newWidth);
  }

  async function handleOpen() {
    try {
      const scaffold = await openScaffold();
      if (scaffold) documentStore.openInNewTab(scaffold);
    } catch (e) {
      alert('Open failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  async function handleNew() {
    try {
      const result = await createNewScaffold();
      if (result) {
        documentStore.openInNewTab(result.scaffold, result.filePath);
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
        return filePath;
      }
    } catch (e) {
      alert('Save As failed: ' + (e instanceof Error ? e.message : e));
    }
    return null;
  }

  function handleSaveEvent() { void handleSave(); }

  async function ensureArticlePath(): Promise<string | null> {
    if (documentStore.filePath) return documentStore.filePath;
    return handleSave();
  }

  function handleEnsureArticlePathEvent(event: Event) {
    const { resolve } = (event as CustomEvent<{ resolve: (path: string | null) => void }>).detail || {};
    void ensureArticlePath()
      .then((path) => resolve?.(path))
      .catch(() => resolve?.(null));
  }

  function openImageGenerator() {
    if (!settingsStore.sidebarVisible) settingsStore.toggleSidebar();
    activeToolTab = 'generate';
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 't') {
        e.preventDefault();
        documentStore.newTab();
        return;
      }
      if (e.shiftKey) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          themeStore.cycleNext();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          themeStore.cyclePrev();
        }
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
    localStorage.setItem('activeToolTab', activeToolTab);
    localStorage.setItem('sidebarWidth', String(sidebarWidth));
  });

  $effect(() => {
    const fileName = documentStore.filePath?.split('/').pop() ?? 'Untitled';
    document.title = fileName !== 'Untitled' ? `StackEd ${buildLabel} - ${fileName}` : `StackEd ${buildLabel}`;
  });

  $effect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  });
</script>

<svelte:window onmousemove={handleMouseMove} onmouseup={handleMouseUp} />

{#if isResizing}
  <style>
    :global(body) {
      cursor: col-resize;
      user-select: none;
    }
  </style>
{/if}

<!-- App chrome: header -->
<header class="flex items-center gap-3 px-5 py-3 border-b border-dark-700 bg-dark-800 shrink-0">
  <img src="/stacked-icon.png" alt="StackEd" class="h-8 w-8 rounded-lg object-contain" />
  <button
    onclick={() => showSettings = true}
    class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
    title="Settings"
    aria-label="Settings"
  ><Settings class="h-5 w-5" /></button>
  <div class="flex items-center gap-2">
    <button
      onclick={handleNew}
      class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
      title="New file"
      aria-label="New file"
    ><FilePlus2 class="h-5 w-5" /></button>
    <button
      onclick={handleOpen}
      class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
      title="Open file"
      aria-label="Open file"
    ><FolderOpen class="h-5 w-5" /></button>
    <button
      onclick={handleSave}
      disabled={!documentStore.dirty}
      class="px-3 py-2.5 text-lg bg-primary-600 text-dark-900 rounded hover:bg-primary-700 disabled:bg-green-600 disabled:hover:bg-green-600 disabled:opacity-50 disabled:cursor-default"
      title="Save"
      aria-label="Save"
    ><Save class="h-5 w-5" /></button>
    <button
      onclick={handleSaveAs}
      class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
      title="Save as"
      aria-label="Save as"
    ><SaveAll class="h-5 w-5" /></button>
    <button
      onclick={() => showRecents = true}
      class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
      title="Recent files"
      aria-label="Recent files"
    ><Clock3 class="h-5 w-5" /></button>
  </div>
  <div class="flex-1"></div>

  <ThemeSwitcher onBrowse={() => (showThemeBrowser = true)} />
  <button
    onclick={() => settingsStore.toggleSidebar()}
    class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
    title="Toggle sidebar"
    aria-label="Toggle sidebar"
  ><PanelRight class="h-5 w-5" /></button>
</header>

<!-- Tab bar (visible when 2+ tabs are open) -->
{#if documentStore.tabCount > 1}
  <div class="flex items-end gap-0 border-b border-dark-700 bg-dark-800 px-2 shrink-0 overflow-x-auto">
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
          onclick={(e) => { e.stopPropagation(); handleCloseTab(i); }}
          onkeydown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleCloseTab(i); } }}
        >×</span>
      </button>
    {/each}
  </div>
{/if}

<!-- Main area -->
<div class="flex flex-1 min-h-0 overflow-hidden">
  <!-- Editor area -->
  <div class="flex-1 min-w-0 flex flex-col">
    <Editor />
  </div>

  <!-- Right sidebar -->
  {#if settingsStore.sidebarVisible}
    <aside
      class="z-20 border-l-2 border-primary-500 bg-dark-900 flex flex-col h-full min-h-0 shrink-0 relative"
      style="width: {sidebarWidth}px;"
    >
      <div class="flex flex-col flex-1 min-h-0">
        <div class="flex overflow-x-auto min-h-10 border-b border-dark-600 bg-dark-800 px-2 pt-2 shrink-0">
          <button
            onclick={() => activeToolTab = 'scaffold'}
            class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 {activeToolTab === 'scaffold'
              ? 'border-dark-600 bg-dark-900 text-dark-100'
              : 'border-transparent text-dark-400 hover:text-dark-200'}"
          >
            Scaffold
          </button>
          <button
            onclick={() => activeToolTab = 'research'}
            class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 {activeToolTab === 'research'
              ? 'border-dark-600 bg-dark-900 text-dark-100'
              : 'border-transparent text-dark-400 hover:text-dark-200'}"
          >
            Research
          </button>
          <button
            onclick={() => activeToolTab = 'artwork'}
            class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 {activeToolTab === 'artwork'
              ? 'border-dark-600 bg-dark-900 text-dark-100'
              : 'border-transparent text-dark-400 hover:text-dark-200'}"
          >
            Artwork
          </button>
          <button
            onclick={() => activeToolTab = 'generate'}
            class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 {activeToolTab === 'generate'
              ? 'border-dark-600 bg-dark-900 text-dark-100'
              : 'border-transparent text-dark-400 hover:text-dark-200'}"
          >
            Generate
          </button>
        </div>
        <div class="flex-1 overflow-y-auto min-h-0">
          {#if activeToolTab === 'scaffold'}
            <ScaffoldPanel />
          {:else if activeToolTab === 'research'}
            <ResearchPanel />
          {:else if activeToolTab === 'artwork'}
            <ArtworkPanel />
          {:else}
            <ImageGenerationPanel />
          {/if}
        </div>
      </div>

      <!-- Resize handle -->
      <div
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        class="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-primary-700/80 hover:bg-primary-500 transition-colors {isResizing ? 'bg-primary-400' : 'bg-primary-700/80'}"
        onmousedown={handleMouseDown}
      ></div>
    </aside>
  {/if}
</div>

<!-- Status bar -->
<StatusBar />

<!-- Modals -->
{#if showSettings}
  <SettingsModal open={showSettings} onclose={() => showSettings = false} />
{/if}
{#if showRecents}
  <RecentFiles onclose={() => showRecents = false} />
{/if}
{#if showThemeBrowser}
  <ThemeBrowser onclose={() => (showThemeBrowser = false)} />
{/if}
