<script lang="ts">
  import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock3,
    FilePlus2,
    FolderOpen,
    LayoutGrid,
    Search,
    Settings,
  } from 'lucide-svelte';
  import { loadLibrary } from '$lib/services/library';
  import type { LibraryEntry } from '$lib/services/storage';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import type { DocumentState } from '$lib/utils/documentState';

  let {
    onnew,
    onopen,
    onopenpath,
    onrecents,
    onsettings,
  }: {
    onnew: () => void;
    onopen: () => void;
    onopenpath: (filePath: string) => void;
    onrecents: () => void;
    onsettings: () => void;
  } = $props();

  let entries = $state<LibraryEntry[]>([]);
  let search = $state('');
  let stateFilter = $state<'all' | DocumentState>('all');
  let loadError = $state('');

  $effect(() => {
    loadError = '';
    void loadLibrary()
      .then((loaded) => (entries = loaded))
      .catch(() => (loadError = 'Could not load the library index.'));
  });

  let filtered = $derived(
    entries.filter((entry) => {
      if (stateFilter !== 'all' && entry.state !== stateFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return entry.title.toLowerCase().includes(q) || entry.filePath.toLowerCase().includes(q);
    }),
  );

  const STATE_FILTERS: Array<{ id: 'all' | DocumentState; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'draft', label: 'Draft' },
    { id: 'ready', label: 'Ready' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'published', label: 'Published' },
  ];

  // --- Calendar view ---

  let cursor = $state(new Date());

  function shiftMonth(delta: number): void {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1);
  }

  let monthLabel = $derived(cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' }));

  let grid = $derived.by(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
    const cells: Array<{ date: number; entries: LibraryEntry[] } | null> = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        date: day,
        entries: entries.filter((entry) => entry.targetDate === iso && stateMatches(entry.state)),
      });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  });

  function stateMatches(state: DocumentState): boolean {
    return stateFilter === 'all' || state === stateFilter;
  }

  function isoToday(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  // --- Badges ---

  const STATE_BADGE: Record<DocumentState, string> = {
    draft: 'text-dark-300 border-dark-500',
    ready: 'text-green-400 border-green-500/50',
    scheduled: 'text-amber-400 border-amber-500/50',
    published: 'text-primary-300 border-primary-500/50',
  };
</script>

<div class="flex flex-col h-full min-h-0">
  <!-- Library header -->
  <header class="flex items-center gap-3 px-5 py-3 border-b border-dark-700 bg-dark-800 shrink-0">
    <img src="/stacked-icon.png" alt="StackEd" class="h-7 w-7 rounded-lg object-contain" />
    <span class="text-sm font-semibold text-dark-200">StackEd 3</span>
    <div class="flex-1"></div>
    <button
      onclick={onnew}
      class="flex items-center gap-1.5 px-3 py-2 bg-primary-600 text-dark-900 rounded text-sm font-medium hover:bg-primary-700"
    >
      <FilePlus2 class="h-4 w-4" />
      New draft
    </button>
    <button
      onclick={onopen}
      class="px-3 py-2 border border-dark-600 rounded hover:bg-dark-700"
      title="Open file…"
      aria-label="Open file…"><FolderOpen class="h-5 w-5" /></button
    >
    <button
      onclick={onrecents}
      class="px-3 py-2 border border-dark-600 rounded hover:bg-dark-700"
      title="Recent files"
      aria-label="Recent files"><Clock3 class="h-5 w-5" /></button
    >
    <button
      onclick={onsettings}
      class="px-3 py-2 border border-dark-600 rounded hover:bg-dark-700"
      title="Settings"
      aria-label="Settings"><Settings class="h-5 w-5" /></button
    >
  </header>

  <!-- Controls: search, state chips, view toggle -->
  <div class="flex items-center gap-3 px-5 py-2.5 border-b border-dark-700 bg-dark-800 shrink-0">
    <div class="relative flex items-center">
      <Search class="absolute left-2.5 h-4 w-4 text-dark-500 pointer-events-none" />
      <input
        type="text"
        bind:value={search}
        placeholder="Search drafts…"
        class="w-64 bg-dark-900 border border-dark-600 rounded pl-8 pr-3 py-1.5 text-sm text-dark-100 focus:border-primary-500"
      />
    </div>
    <div class="flex items-center gap-1">
      {#each STATE_FILTERS as filter (filter.id)}
        <button
          onclick={() => (stateFilter = filter.id)}
          class="px-2.5 py-1 rounded-full border text-xs {stateFilter === filter.id
            ? 'border-primary-500 text-primary-300'
            : 'border-dark-600 text-dark-400 hover:text-dark-200'}"
        >
          {filter.label}
        </button>
      {/each}
    </div>
    <div class="flex-1"></div>
    <div class="flex items-center gap-1 rounded border border-dark-600 p-0.5">
      <button
        onclick={() => settingsStore.setLibraryViewMode('list')}
        class="p-1.5 rounded {settingsStore.libraryViewMode === 'list'
          ? 'bg-dark-700 text-dark-100'
          : 'text-dark-400 hover:text-dark-200'}"
        title="List view"
        aria-label="List view"><LayoutGrid class="h-4 w-4" /></button
      >
      <button
        onclick={() => settingsStore.setLibraryViewMode('calendar')}
        class="p-1.5 rounded {settingsStore.libraryViewMode === 'calendar'
          ? 'bg-dark-700 text-dark-100'
          : 'text-dark-400 hover:text-dark-200'}"
        title="Calendar view"
        aria-label="Calendar view"><CalendarDays class="h-4 w-4" /></button
      >
    </div>
  </div>

  <!-- Entries -->
  <div class="flex-1 overflow-y-auto min-h-0">
    {#if loadError}
      <p class="p-5 text-sm text-red-400">{loadError}</p>
    {:else if settingsStore.libraryViewMode === 'calendar'}
      <div class="mx-auto w-full max-w-3xl px-5 py-5">
        <div class="flex items-center gap-3 mb-3">
          <button
            onclick={() => shiftMonth(-1)}
            class="p-1.5 border border-dark-600 rounded hover:bg-dark-700"
            aria-label="Previous month"><ChevronLeft class="h-4 w-4" /></button
          >
          <span class="text-sm font-medium text-dark-200">{monthLabel}</span>
          <button
            onclick={() => shiftMonth(1)}
            class="p-1.5 border border-dark-600 rounded hover:bg-dark-700"
            aria-label="Next month"><ChevronRight class="h-4 w-4" /></button
          >
        </div>
        <div class="grid grid-cols-7 gap-1 text-center text-xs text-dark-500 mb-1">
          <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span
          ><span>Su</span>
        </div>
        <div class="grid grid-cols-7 gap-1">
          {#each grid as cell}
            {#if cell === null}
              <div class="h-24 rounded border border-dark-800"></div>
            {:else}
              <div
                class="h-24 rounded border p-1.5 flex flex-col gap-1 overflow-hidden {cell.date ===
                  new Date().getDate() &&
                cursor.getMonth() === new Date().getMonth() &&
                cursor.getFullYear() === new Date().getFullYear()
                  ? 'border-primary-700 bg-dark-900/60'
                  : 'border-dark-700 bg-dark-900'}"
              >
                <span class="text-xs text-dark-400">{cell.date}</span>
                {#each cell.entries as entry (entry.filePath)}
                  <button
                    onclick={() => onopenpath(entry.filePath)}
                    class="truncate text-left text-xs px-1 py-0.5 rounded bg-primary-600/20 text-primary-300 hover:bg-primary-600/40"
                    title="{entry.title} ({entry.state})"
                  >
                    {entry.title || 'Untitled'}
                  </button>
                {/each}
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {:else if filtered.length === 0}
      <div class="mx-auto w-full max-w-2xl px-5 py-12 text-center">
        <p class="text-sm text-dark-300">No drafts here yet.</p>
        <p class="mt-1 text-xs text-dark-500">
          Create a new draft, or open a file. Saved drafts appear in this library.
        </p>
      </div>
    {:else}
      <ul class="mx-auto w-full max-w-2xl px-5 py-3 flex flex-col gap-1">
        {#each filtered as entry (entry.filePath)}
          <li>
            <button
              onclick={() => onopenpath(entry.filePath)}
              class="w-full text-left px-3 py-2.5 rounded hover:bg-dark-800 flex items-center gap-3"
            >
              <div class="min-w-0 flex-1">
                <p class="text-sm text-dark-100 truncate">{entry.title || 'Untitled'}</p>
                <p class="text-xs text-dark-500 truncate">{entry.filePath}</p>
              </div>
              {#if entry.publication}
                <span class="text-xs text-dark-400 whitespace-nowrap hidden md:block"
                  >{entry.publication}.substack.com</span
                >
              {/if}
              <span
                class="text-xs px-2 py-0.5 rounded-full border whitespace-nowrap {STATE_BADGE[
                  entry.state
                ]}">{entry.state}</span
              >
              {#if entry.targetDate}
                <span class="text-xs text-dark-400 whitespace-nowrap">{entry.targetDate}</span>
              {/if}
              <span class="text-xs text-dark-500 whitespace-nowrap"
                >{entry.updated.slice(0, 10)}</span
              >
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
