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
  import { createNewFile, openFile, openFilePath, saveFile, saveFilePath, saveAsFile, writeFilePath } from '$lib/services/files';
  import { createAdapter } from '$lib/services/ai/adapter';
  import { isSeoComplete, mergeSeoDraft } from '$lib/services/seo';
  import { FRONTMATTER_DEFAULTS, FRONTMATTER_FIELD_ORDER } from '$lib/types/article';
  import { backfillArticleFrontmatter, runBodyParser, serializeArticleFile } from '$lib/utils/frontmatter';
  import { checkPromotionGate, renderForPromotion } from '$lib/utils/manuscript';
  import PreviewPanel from '$lib/components/editor/PreviewPanel.svelte';
  import WorkflowTimeline from '$lib/components/WorkflowTimeline.svelte';
  import { buildLabel } from '$lib/utils/buildInfo';
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
  let seoLoading = $state(false);
  let promotionLoading = $state(false);
  let activeEditorTab = $state<'editor' | 'preview'>('editor');

  async function loadFilePath(filePath: string) {
    const parsed = await openFilePath(filePath);
    documentStore.openInNewTab(parsed);
  }

  onMount(() => {
    let unlistenOpenFile: (() => void) | undefined;
    let unlistenMenuNew: (() => void) | undefined;
    let unlistenMenuNewTab: (() => void) | undefined;
    let unlistenMenuOpen: (() => void) | undefined;
    let unlistenMenuSave: (() => void) | undefined;
    let unlistenMenuSaveAs: (() => void) | undefined;
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
    void listen('stacked:menu-save', () => { void handleSave(); }).then((unlisten) => {
      unlistenMenuSave = unlisten;
    });
    void listen('stacked:menu-save-as', () => { void handleSaveAs(); }).then((unlisten) => {
      unlistenMenuSaveAs = unlisten;
    });

    void (async () => {
      await settingsStore.loadFromStorage();
      const initialPath = await invoke<string | null>('initial_file_path').catch(() => null);
      if (initialPath) {
        await loadFilePath(initialPath);
      }
      yamlCollapsed = localStorage.getItem('yamlCollapsed') === 'true';
      researchCollapsed = localStorage.getItem('researchCollapsed') === 'true';
      activeToolTab = localStorage.getItem('activeToolTab') === 'artwork' ? 'artwork' : 'research';
      const savedWidth = localStorage.getItem('sidebarWidth');
      if (savedWidth) sidebarWidth = parseInt(savedWidth, 10);
      setupZoomShortcuts();
    })();

    return () => {
      unlistenOpenFile?.();
      unlistenMenuNew?.();
      unlistenMenuNewTab?.();
      unlistenMenuOpen?.();
      unlistenMenuSave?.();
      unlistenMenuSaveAs?.();
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
      documentStore.openInNewTab(parsed);
    } catch {
      // User cancelled picker
    }
  }

  async function handleNew() {
    try {
      const parsed = await createNewFile();
      if (parsed) documentStore.openInNewTab(parsed);
    } catch (e) {
      alert('New file failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  function handleCloseTab(index: number) {
    const meta = documentStore.tabMetas[index];
    if (meta.dirty && !window.confirm(`Close "${meta.title}" without saving?`)) return;
    documentStore.closeTab(index);
  }

  function getFrontmatterForSave() {
    return backfillArticleFrontmatter(
      documentStore.frontmatter || FRONTMATTER_DEFAULTS,
      documentStore.body,
    );
  }

  async function handlePrepareSeo() {
    if (!documentStore.frontmatter) return;
    if (isSeoComplete(documentStore.frontmatter)) {
      alert('SEO fields are already complete.');
      return;
    }
    if (!settingsStore.hasValidKey) {
      alert('Add an AI API key in Settings before generating SEO.');
      return;
    }

    seoLoading = true;
    try {
      const frontmatter = getFrontmatterForSave();
      const adapter = createAdapter(settingsStore.provider, settingsStore.apiKey);
      const draft = await adapter.generateSeoDraft({
        frontmatter,
        fieldOrder: documentStore.fieldOrder,
        body: documentStore.body,
        filePath: documentStore.filePath,
      });
      const merged = mergeSeoDraft(frontmatter, draft);
      documentStore.replaceFrontmatter(merged);
      alert('SEO draft generated. Review the SEO fields in the YAML panel, then save before export/posting.');
    } catch (e) {
      alert('SEO generation failed: ' + (e instanceof Error ? e.message : e));
    } finally {
      seoLoading = false;
    }
  }

  function getManuscriptFinalPath(): string | null {
    const path = documentStore.filePath;
    if (!path || !path.endsWith('.md')) return null;
    return path.replace(/\.md$/, '_final.md');
  }

  async function handlePromote() {
    if (promotionLoading) return;
    const fm = documentStore.frontmatter;
    const body = documentStore.body;
    if (!fm || !documentStore.filePath) {
      alert('Save the manuscript before promoting to Final Draft.');
      return;
    }

    // Don't promote if already in Final Draft
    if (documentStore.phase === 'final') return;

    const finalPath = getManuscriptFinalPath();
    if (!finalPath) return;

    const gate = checkPromotionGate(fm, body);
    if (!gate.canPromote) {
      alert('Cannot promote to Final Draft:\n\n' + gate.missing.join('\n'));
      return;
    }

    if (!window.confirm('Promote to Final Draft? The manuscript will be frozen. You can restart later if needed.')) return;

    promotionLoading = true;
    try {
      const parsedFm = runBodyParser(fm, body);
      const prose = renderForPromotion(body, parsedFm);

      // Build clean frontmatter for _final.md (no SEO yet — generated at Publish)
      const finalFm = {
        ...parsedFm,
        SEO_TITLE: '',
        SEO_DESCRIPTION: '',
        SEO_SLUG: '',
        SEO_TAGS: [] as string[],
      };

      const fieldOrder = FRONTMATTER_FIELD_ORDER.map(String);
      const content = serializeArticleFile(finalFm, fieldOrder, prose);
      await writeFilePath(finalPath, content);

      // Switch editor to _final.md
      documentStore.load(finalFm, prose, fieldOrder, null, finalPath, false);
      activeEditorTab = 'editor';
    } catch (e) {
      alert('Promotion failed: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      promotionLoading = false;
    }
  }

  async function handleSave() {
    if (!documentStore.body && !documentStore.frontmatter) return;

    // If no file is open yet, prompt for a save location
    if (!documentStore.fileHandle && !documentStore.filePath) {
      try {
        const frontmatter = runBodyParser(getFrontmatterForSave(), documentStore.body);
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
      const frontmatter = runBodyParser(getFrontmatterForSave(), documentStore.body);
      if (documentStore.filePath) {
        const filePath = await saveFilePath(
          documentStore.filePath,
          frontmatter,
          documentStore.fieldOrder,
          documentStore.body,
        );
        documentStore.load(frontmatter, documentStore.body, documentStore.fieldOrder, null, filePath);
      } else if (documentStore.fileHandle) {
        await saveFile(
          documentStore.fileHandle,
          frontmatter,
          documentStore.fieldOrder,
          documentStore.body,
        );
      }
      documentStore.replaceFrontmatter(frontmatter);
      documentStore.markClean();
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  async function handleSaveAs() {
    if (!documentStore.body && !documentStore.frontmatter) return;

    try {
      const frontmatter = runBodyParser(getFrontmatterForSave(), documentStore.body);
      const filePath = await saveAsFile(frontmatter, documentStore.fieldOrder, documentStore.body);
      if (filePath) {
        documentStore.load(frontmatter, documentStore.body, documentStore.fieldOrder, null, filePath);
      }
    } catch (e) {
      alert('Save As failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  function handleSaveEvent() { handleSave(); }

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

  $effect(() => {
    const fileName = documentStore.filePath?.split('/').pop() ?? documentStore.fileHandle?.name;
    document.title = fileName ? `StackEd ${buildLabel} - ${fileName}` : `StackEd ${buildLabel}`;
  });

  // Reset editor tab when switching documents
  $effect(() => {
    // Reading activeIndex creates a reactive dependency; tab switches trigger reset
    documentStore.activeIndex;
    activeEditorTab = 'editor';
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
  <img src="/stacked-icon.png" alt="StackEd" class="h-8 w-8 rounded-lg object-contain" />
  <button
    onclick={() => showSettings = true}
    class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
    title="Settings"
  >⚙</button>
  <div class="flex items-center gap-2">
    <button onclick={handleNew} class="px-4 py-2.5 text-base border border-dark-600 rounded hover:bg-dark-700">
      New...
    </button>
    <button onclick={handleOpen} class="px-4 py-2.5 text-base border border-dark-600 rounded hover:bg-dark-700">
      Open
    </button>
    <button
      onclick={handleSave}
      disabled={!documentStore.dirty}
      class="px-4 py-2.5 text-base bg-primary-600 text-dark-900 rounded hover:bg-primary-700 disabled:bg-green-600 disabled:hover:bg-green-600 disabled:opacity-50 disabled:cursor-default"
    >
      Save
    </button>
    <button onclick={handleSaveAs} class="px-4 py-2.5 text-base border border-dark-600 rounded hover:bg-dark-700">
      Save as...
    </button>
    {#if documentStore.phase === 'draft' && documentStore.filePath && documentStore.frontmatter}
      {@const gate = checkPromotionGate(documentStore.frontmatter, documentStore.body)}
      <button
        onclick={handlePromote}
        disabled={!gate.canPromote || promotionLoading}
        title={gate.canPromote
          ? 'Promote to Final Draft'
          : 'Missing: ' + gate.missing.join(' · ')}
        class="px-3 py-2 text-sm border border-dark-600 rounded hover:bg-dark-700
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {promotionLoading ? 'Promoting…' : '→ Final Draft'}
      </button>
    {/if}
    <button
      onclick={handlePrepareSeo}
      disabled={!documentStore.frontmatter || seoLoading}
      class="px-4 py-2.5 text-base border border-dark-600 rounded hover:bg-dark-700 disabled:opacity-50 disabled:cursor-default"
      title="Generate SEO metadata before export/posting"
    >
      {seoLoading ? 'SEO…' : 'Prepare SEO'}
    </button>
    <button
      onclick={() => showRecents = true}
      class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
      title="Recent files"
    >⏱</button>
  </div>
  <div class="flex-1"></div>

  <ThemeSwitcher onBrowse={() => (showThemeBrowser = true)} />
  <button
    onclick={() => settingsStore.toggleSidebar()}
    class="px-3 py-2.5 text-lg border border-dark-600 rounded hover:bg-dark-700"
    title="Toggle sidebar"
  >⊞</button>
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

<!-- Workflow timeline strip -->
<WorkflowTimeline
  phase={documentStore.phase}
  yamlVisible={settingsStore.sidebarVisible && !yamlCollapsed}
  onToggleYaml={() => {
    if (!settingsStore.sidebarVisible) {
      settingsStore.toggleSidebar();
      yamlCollapsed = false;
    } else if (yamlCollapsed) {
      yamlCollapsed = false;
    } else {
      yamlCollapsed = true;
    }
  }}
  onOpenPreview={() => { activeEditorTab = 'preview'; }}
  onOpenSettings={() => { showSettings = true; }}
/>

<!-- Main area -->
<div class="flex flex-1 min-h-0">
  <!-- Editor area with tab bar -->
  <div class="flex-1 min-w-0 flex flex-col">
    <!-- Tab bar: Draft phase shows Editor/Preview tabs; Final Draft shows label -->
    {#if documentStore.phase === 'draft'}
      <div role="tablist" class="flex items-center border-b border-dark-700 bg-dark-800 px-2 shrink-0">
        <button
          role="tab"
          aria-selected={activeEditorTab === 'editor'}
          onclick={() => { activeEditorTab = 'editor'; }}
          class="px-4 py-2 text-sm border-b-2 transition-colors {activeEditorTab === 'editor'
            ? 'border-primary-400 text-dark-100'
            : 'border-transparent text-dark-400 hover:text-dark-200'}"
        >
          Editor
        </button>
        <button
          role="tab"
          aria-selected={activeEditorTab === 'preview'}
          onclick={() => { activeEditorTab = 'preview'; }}
          class="px-4 py-2 text-sm border-b-2 transition-colors {activeEditorTab === 'preview'
            ? 'border-primary-400 text-dark-100'
            : 'border-transparent text-dark-400 hover:text-dark-200'}"
        >
          Preview
        </button>
      </div>
    {:else}
      <!-- Final Draft mode label -->
      <div class="flex items-center border-b border-dark-700 bg-dark-800 px-4 py-2 shrink-0">
        <span class="text-xs text-amber-400 font-semibold uppercase tracking-wide">Final Draft</span>
      </div>
    {/if}

    <!-- Content -->
    {#if activeEditorTab === 'editor' || documentStore.phase === 'final'}
      <Editor />
    {:else}
      <PreviewPanel />
    {/if}
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
