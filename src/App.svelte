<script lang="ts">
  import { onMount } from 'svelte';
  import Editor from '$lib/components/editor/Editor.svelte';
  import YamlPanel from '$lib/components/yaml/YamlPanel.svelte';
  import ResearchPanel from '$lib/components/research/ResearchPanel.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import RecentFiles from '$lib/components/RecentFiles.svelte';
  import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { themeStore } from '$lib/stores/theme.svelte';
  import { openFile, saveFile } from '$lib/services/files';
  import { loadFolderHandle } from '$lib/services/storage';
  import { setupZoomShortcuts } from '$lib/utils/zoom';
  import '$lib/themes/catppuccin.css';

  let showSettings = $state(false);
  let showRecents = $state(false);
  let yamlCollapsed = $state(false);
  let researchCollapsed = $state(false);

  onMount(async () => {
    await settingsStore.loadFromStorage();
    // Try to restore folder handle (does not auto-open a file)
    await loadFolderHandle().catch(() => {});
    yamlCollapsed = localStorage.getItem('yamlCollapsed') === 'true';
    researchCollapsed = localStorage.getItem('researchCollapsed') === 'true';
    window.addEventListener('stacked:save', handleSaveEvent);
    setupZoomShortcuts();
    return () => window.removeEventListener('stacked:save', handleSaveEvent);
  });

  async function handleOpen() {
    try {
      const parsed = await openFile();
      documentStore.load(parsed.frontmatter, parsed.body, parsed.fieldOrder, parsed.fileHandle);
    } catch {
      // User cancelled picker
    }
  }

  async function handleSave() {
    if (!documentStore.fileHandle || !documentStore.frontmatter) return;
    try {
      await saveFile(
        documentStore.fileHandle,
        documentStore.frontmatter,
        documentStore.fieldOrder,
        documentStore.body,
      );
      documentStore.markClean();
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  // Listen for save shortcut dispatched by Editor
  function handleSaveEvent() { handleSave(); }

  // Sidebar visibility persists across sessions
  $effect(() => {
    localStorage.setItem('yamlCollapsed', String(yamlCollapsed));
    localStorage.setItem('researchCollapsed', String(researchCollapsed));
  });
</script>

<!-- App chrome: header -->
<header class="flex items-center gap-2 px-4 py-2 border-b border-dark-700 bg-dark-800 shrink-0">
  <h1 class="font-semibold text-dark-50 text-sm">StackEd</h1>
  <div class="flex-1"></div>

  <button onclick={handleOpen} class="px-3 py-1.5 text-sm border border-dark-600 rounded hover:bg-dark-700">
    Open
  </button>
  <button
    onclick={handleSave}
    disabled={!documentStore.dirty}
    class="px-3 py-1.5 text-sm bg-primary-600 text-dark-900 rounded hover:bg-primary-700 disabled:opacity-40"
  >
    Save
  </button>
  <ThemeSwitcher />
  <button
    onclick={() => showRecents = true}
    class="px-2 py-1.5 text-sm border border-dark-600 rounded hover:bg-dark-700"
    title="Recent files"
  >⏱</button>
  <button
    onclick={() => settingsStore.toggleSidebar()}
    class="px-2 py-1.5 text-sm border border-dark-600 rounded hover:bg-dark-700"
    title="Toggle sidebar"
  >⊞</button>
  <button
    onclick={() => showSettings = true}
    class="px-2 py-1.5 text-sm border border-dark-600 rounded hover:bg-dark-700"
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
    <aside class="w-72 border-l border-dark-600 flex flex-col min-h-0 shrink-0">
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

      <!-- Research panel -->
      <div class="flex flex-col {researchCollapsed ? 'h-auto' : 'flex-1'} min-h-0">
        <button
          onclick={() => researchCollapsed = !researchCollapsed}
          class="flex items-center justify-between px-3 py-2 text-xs font-semibold text-dark-300 uppercase tracking-wide hover:bg-dark-700 shrink-0"
        >
          Research
          <span>{researchCollapsed ? '▾' : '▴'}</span>
        </button>
        {#if !researchCollapsed}
          <div class="flex-1 overflow-y-auto">
            <ResearchPanel />
          </div>
        {/if}
      </div>
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
