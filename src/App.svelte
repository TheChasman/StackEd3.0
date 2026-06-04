<script lang="ts">
  import { onMount } from 'svelte';
  import type { SvelteHTMLElements } from 'svelte/elements';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import Editor from '$lib/components/editor/Editor.svelte';
  import YamlPanel from '$lib/components/yaml/YamlPanel.svelte';
  import ResearchPanel from '$lib/components/research/ResearchPanel.svelte';
  import ArtworkPanel from '$lib/components/artwork/ArtworkPanel.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import RecentFiles from '$lib/components/RecentFiles.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import ThemeBrowser from '$lib/components/ThemeBrowser.svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { openFile, openFilePath, saveFile, saveFilePath, saveAsFile } from '$lib/services/files';
  import { FRONTMATTER_DEFAULTS } from '$lib/types/article';
  import { loadFolderHandle } from '$lib/services/storage';
  import { setupZoomShortcuts } from '$lib/utils/zoom';
  import '$lib/themes/catppuccin.css';

  let showSettings = $state(false);
  let showRecents = $state(false);
  let showThemeBrowser = $state(false);
  let yamlCollapsed = $state(false);
  let researchCollapsed = $state(false);
  let activeToolTab = $state<'research' | 'artwork'>('research');
  let sidebarWidth = $state(288);
  let isResizing = $state(false);

  async function loadFilePath(filePath: string) {
    const parsed = await openFilePath(filePath);
    documentStore.load(parsed.frontmatter, parsed.body, parsed.fieldOrder, parsed.fileHandle, parsed.filePath);
  }

  onMount(() => {
    let unlistenOpenFile: (() => void) | undefined;
    void listen<string>('stacked:open-file', (event) => {
      void loadFilePath(event.payload);
    }).then((unlisten) => {
      unlistenOpenFile = unlisten;
    });

    void (async () => {
      await settingsStore.loadFromStorage();
      const initialPath = await invoke<string | null>('initial_file_path').catch(() => null);
      if (initialPath) {
        await loadFilePath(initialPath);
      }
      // Try to restore folder handle (does not auto-open a file)
      await loadFolderHandle().catch(() => {});
      yamlCollapsed = localStorage.getItem('yamlCollapsed') === 'true';
      researchCollapsed = localStorage.getItem('researchCollapsed') === 'true';
      activeToolTab = localStorage.getItem('activeToolTab') === 'artwork' ? 'artwork' : 'research';
      const savedWidth = localStorage.getItem('sidebarWidth');
      if (savedWidth) sidebarWidth = parseInt(savedWidth, 10);
      setupZoomShortcuts();
    })();

    return () => {
      unlistenOpenFile?.();
    };
  });

  function handleMouseDown() {
    isResizing = true;
  }

  function handleMouseUp() {
    isResizing = false;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isResizing) return;
    const newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 200 && newWidth <= 600) {
      sidebarWidth = newWidth;
    }
  }

  async function handleOpen() {
    try {
      const parsed = await openFile();
      documentStore.load(parsed.frontmatter, parsed.body, parsed.fieldOrder, parsed.fileHandle, parsed.filePath);
    } catch {
      // User cancelled picker
    }
  }

  async function handleSave() {
    if (!documentStore.body && !documentStore.frontmatter) return;

    // If no file is open yet, prompt for a save location
    if (!documentStore.fileHandle && !documentStore.filePath) {
      try {
        const frontmatter = documentStore.frontmatter || FRONTMATTER_DEFAULTS;
        const filePath = await saveAsFile(frontmatter, documentStore.fieldOrder, documentStore.body);
        if (filePath) {
          documentStore.load(frontmatter, documentStore.body, documentStore.fieldOrder, null, filePath);
        }
      } catch (e) {
        alert('Save failed: ' + (e instanceof Error ? e.message : e));
      }
      return;
    }

    try {
      const frontmatter = documentStore.frontmatter || FRONTMATTER_DEFAULTS;
      if (documentStore.filePath) {
        await saveFilePath(
          documentStore.filePath,
          frontmatter,
          documentStore.fieldOrder,
          documentStore.body,
        );
      } else if (documentStore.fileHandle) {
        await saveFile(
          documentStore.fileHandle,
          frontmatter,
          documentStore.fieldOrder,
          documentStore.body,
        );
      }
      documentStore.markClean();
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  function handleSaveEvent() { handleSave(); }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey) {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        themeStore.cycleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        themeStore.cyclePrev();
      }
    }
  }

  // Listen for save shortcut — in $effect so cleanup runs on destroy
  $effect(() => {
    window.addEventListener('stacked:save', handleSaveEvent);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('stacked:save', handleSaveEvent);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  // Sidebar visibility and width persist across sessions
  $effect(() => {
    localStorage.setItem('yamlCollapsed', String(yamlCollapsed));
    localStorage.setItem('researchCollapsed', String(researchCollapsed));
    localStorage.setItem('activeToolTab', activeToolTab);
    localStorage.setItem('sidebarWidth', String(sidebarWidth));
  });

  // Add mouse event listeners when resizing
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
  <h1 class="font-semibold text-dark-50 text-lg">StackEd</h1>
  <div class="flex-1"></div>

  <button onclick={handleOpen} class="px-4 py-2.5 text-base border border-dark-600 rounded hover:bg-dark-700">
    Open
  </button>
  <button
    onclick={handleSave}
    disabled={!documentStore.dirty}
    class="px-4 py-2.5 text-base bg-primary-600 text-dark-900 rounded hover:bg-primary-700 disabled:opacity-40"
  >
    Save
  </button>
  <ThemeSwitcher onBrowse={() => (showThemeBrowser = true)} />
  <button
    onclick={() => showRecents = true}
    class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
    title="Recent files"
  >⏱</button>
  <button
    onclick={() => settingsStore.toggleSidebar()}
    class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
    title="Toggle sidebar"
  >⊞</button>
  <button
    onclick={() => showSettings = true}
    class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
    title="Settings"
  >⚙</button>
</header>

<!-- Main area -->
<div class="flex flex-1 min-h-0">
  <!-- Editor (always visible) -->
  <div class="flex-1 min-w-0 flex flex-col">
    <Editor />
  </div>

  <!-- Right sidebar -->
  {#if settingsStore.sidebarVisible}
    <aside 
      class="border-l border-dark-600 flex flex-col min-h-0 shrink-0 relative"
      style="width: {sidebarWidth}px;"
    >
      <!-- YAML panel -->
      <div class="flex flex-col {yamlCollapsed ? 'h-auto' : 'flex-1'} min-h-0 border-b border-dark-600">
        <button
          onclick={() => yamlCollapsed = !yamlCollapsed}
          class="flex items-center justify-between px-3 py-2 text-xs font-semibold text-dark-300 uppercase tracking-wide hover:bg-dark-700 shrink-0"
        >
          Article
          <span>{yamlCollapsed ? '▾' : '▴'}</span>
        </button>
        {#if !yamlCollapsed}
          <div class="flex-1 overflow-y-auto">
            <YamlPanel />
          </div>
        {/if}
      </div>

      <!-- Tools panel -->
      <div class="flex flex-col {researchCollapsed ? 'h-auto' : 'flex-1'} min-h-0">
        <button
          onclick={() => researchCollapsed = !researchCollapsed}
          class="flex items-center justify-between px-3 py-2 text-xs font-semibold text-dark-300 uppercase tracking-wide hover:bg-dark-700 shrink-0"
        >
          Tools
          <span>{researchCollapsed ? '▾' : '▴'}</span>
        </button>
        {#if !researchCollapsed}
          <div class="flex border-b border-dark-600 bg-dark-800 px-2 pt-2">
            <button
              onclick={() => activeToolTab = 'research'}
              class="px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 {activeToolTab === 'research'
                ? 'border-dark-600 bg-dark-900 text-dark-100'
                : 'border-transparent text-dark-400 hover:text-dark-200'}"
            >
              Research
            </button>
            <button
              onclick={() => activeToolTab = 'artwork'}
              class="px-3 py-1.5 text-xs font-medium rounded-t border border-b-0 {activeToolTab === 'artwork'
                ? 'border-dark-600 bg-dark-900 text-dark-100'
                : 'border-transparent text-dark-400 hover:text-dark-200'}"
            >
              Artwork
            </button>
          </div>
          <div class="flex-1 overflow-y-auto min-h-0">
            {#if activeToolTab === 'research'}
              <ResearchPanel />
            {:else}
              <ArtworkPanel />
            {/if}
          </div>
        {/if}
      </div>

      <!-- Resize handle -->
      <div
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        class="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500 transition-colors {isResizing ? 'bg-primary-500' : 'hover:bg-primary-400'}"
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
