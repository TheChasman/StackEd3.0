// Scaffold-based document store.
// Replaces the old frontmatter+body (markdown) model with a single Scaffold
// object whose body is ProseMirror JSON — the wire format Substack accepts.
import type { Scaffold, PostPayload, NotePayload, PMDoc } from '$lib/types/scaffold';
import { emptyScaffold, isPostPayload, isNotePayload, getBody } from '$lib/types/scaffold';
import { deserializeScaffold } from '$lib/utils/scaffold';
import { countPMDocWords } from '$lib/utils/pmText';

interface TabState {
  scaffold: Scaffold | null;
  filePath: string | null;
  dirty: boolean;
}

export interface TabMeta {
  title: string;
  filePath: string | null;
  dirty: boolean;
}

function emptyTab(): TabState {
  return { scaffold: null, filePath: null, dirty: false };
}

function tabTitle(tab: TabState): string {
  if (tab.scaffold) {
    if (isPostPayload(tab.scaffold.payload)) {
      return tab.scaffold.payload.draft_title || 'Untitled';
    }
    return 'Note';
  }
  if (tab.filePath)
    return (
      tab.filePath
        .split('/')
        .pop()
        ?.replace(/\.stacked\.json$/i, '') ?? 'Untitled'
    );
  return 'Untitled';
}

class DocumentStore {
  private _tabs = $state<TabState[]>([emptyTab()]);
  private _activeIndex = $state(0);
  private _loadVersion = $state(0);
  private _editTick = $state(0);

  get activeIndex(): number {
    return this._activeIndex;
  }
  get tabCount(): number {
    return this._tabs.length;
  }

  get tabMetas(): TabMeta[] {
    return this._tabs.map((tab) => ({
      title: tabTitle(tab),
      filePath: tab.filePath,
      dirty: tab.dirty,
    }));
  }

  // --- Active-tab accessors ---

  get scaffold(): Scaffold | null {
    return this._tabs[this._activeIndex].scaffold;
  }

  get payload(): PostPayload | NotePayload | null {
    return this._tabs[this._activeIndex].scaffold?.payload ?? null;
  }

  /** The body as ProseMirror JSON (the wire format). */
  get body(): PMDoc {
    const s = this._tabs[this._activeIndex].scaffold;
    if (!s) return { type: 'doc', content: [] };
    return getBody(s);
  }

  get title(): string {
    const s = this._tabs[this._activeIndex].scaffold;
    if (!s) return '';
    if (isPostPayload(s.payload)) return s.payload.draft_title;
    return '';
  }

  get filePath(): string | null {
    return this._tabs[this._activeIndex].filePath;
  }

  get dirty(): boolean {
    return this._tabs[this._activeIndex].dirty;
  }

  get loadVersion(): number {
    return this._loadVersion;
  }

  /** Increments on every mutation — drives the 4-second autosave debounce. */
  get editTick(): number {
    return this._editTick;
  }

  get wordCount(): number {
    return countPMDocWords(this.body);
  }

  private touch(tab: TabState): void {
    tab.scaffold!.updated = new Date().toISOString();
    tab.dirty = true;
    this._editTick += 1;
  }

  // --- Loading ---

  /** Load a scaffold into the active tab. */
  load(scaffold: Scaffold, filePath: string | null = null, dirty = false): void {
    const tab = this._tabs[this._activeIndex];
    tab.scaffold = scaffold;
    tab.filePath = filePath;
    tab.dirty = dirty;
    this._loadVersion += 1;
  }

  /** Load from a JSON string (from disk). */
  loadJson(json: string, filePath: string | null = null): void {
    const scaffold = deserializeScaffold(json);
    this.load(scaffold, filePath, false);
  }

  /** Open a scaffold in a new tab. Reuses active tab if blank. */
  openInNewTab(scaffold: Scaffold, filePath: string | null = null): void {
    const current = this._tabs[this._activeIndex];
    const reuseEmpty = this._tabs.length === 1 && current.scaffold === null && !current.dirty;

    if (reuseEmpty) {
      this.load(scaffold, filePath, false);
      return;
    }

    this._tabs.push({ scaffold, filePath, dirty: false });
    this._activeIndex = this._tabs.length - 1;
    this._loadVersion += 1;
  }

  newTab(): void {
    this._tabs.push(emptyTab());
    this._activeIndex = this._tabs.length - 1;
  }

  switchTab(index: number): void {
    if (index >= 0 && index < this._tabs.length) {
      this._activeIndex = index;
      this._loadVersion += 1;
    }
  }

  closeTab(index: number): void {
    if (this._tabs.length === 1) {
      this._tabs[0] = emptyTab();
      return;
    }
    this._tabs.splice(index, 1);
    if (this._activeIndex >= this._tabs.length) {
      this._activeIndex = this._tabs.length - 1;
    }
  }

  // --- Mutations ---

  /** Replace the body PMDoc. */
  setBody(body: PMDoc): void {
    const tab = this._tabs[this._activeIndex];
    if (!tab.scaffold) return;
    if (isPostPayload(tab.scaffold.payload)) {
      tab.scaffold.payload.draft_body = body;
    } else if (isNotePayload(tab.scaffold.payload)) {
      tab.scaffold.payload.bodyJson = body;
    }
    this.touch(tab);
  }

  /** Patch a payload field by key. */
  patchPayload<K extends keyof PostPayload>(field: K, value: PostPayload[K]): void {
    const tab = this._tabs[this._activeIndex];
    if (!tab.scaffold || !isPostPayload(tab.scaffold.payload)) return;
    tab.scaffold.payload[field] = value;
    this.touch(tab);
  }

  /** Patch a workshop field by key. */
  patchWorkshop<K extends keyof Scaffold['workshop']>(
    field: K,
    value: Scaffold['workshop'][K],
  ): void {
    const tab = this._tabs[this._activeIndex];
    if (!tab.scaffold) return;
    tab.scaffold.workshop[field] = value;
    this.touch(tab);
  }

  /** Toggle a field path in the locked array. */
  toggleLocked(path: string): void {
    const tab = this._tabs[this._activeIndex];
    if (!tab.scaffold) return;
    const locked = tab.scaffold.locked;
    if (locked.includes(path)) {
      tab.scaffold.locked = locked.filter((p) => p !== path);
    } else {
      tab.scaffold.locked = [...locked, path];
    }
    this.touch(tab);
  }

  /** Replace the entire scaffold (e.g. after AI merge). */
  replaceScaffold(scaffold: Scaffold): void {
    const tab = this._tabs[this._activeIndex];
    tab.scaffold = scaffold;
    this.touch(tab);
  }

  markClean(): void {
    this._tabs[this._activeIndex].dirty = false;
  }

  reset(): void {
    this._tabs = [emptyTab()];
    this._activeIndex = 0;
    this._editTick = 0;
  }

  /** Create a fresh scaffold in the active tab (for "New" button). */
  newScaffold(kind: 'post' | 'note' = 'post'): Scaffold {
    const scaffold = emptyScaffold(kind);
    this.load(scaffold, null, true);
    return scaffold;
  }
}

export const documentStore = new DocumentStore();
