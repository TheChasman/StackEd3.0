import type { ArticleFrontmatter } from '$lib/types/article';
import type { ParsedFile } from '$lib/types/article';
import { extractTitleFromBody } from '$lib/utils/frontmatter';

interface TabState {
  frontmatter: ArticleFrontmatter | null;
  body: string;
  fieldOrder: string[];
  fileHandle: FileSystemFileHandle | null;
  filePath: string | null;
  dirty: boolean;
}

export interface TabMeta {
  title: string;
  filePath: string | null;
  dirty: boolean;
}

function emptyTab(): TabState {
  return {
    frontmatter: null,
    body: '',
    fieldOrder: [],
    fileHandle: null,
    filePath: null,
    dirty: false,
  };
}

function tabTitle(tab: TabState): string {
  const bodyTitle = extractTitleFromBody(tab.body);
  if (bodyTitle) return bodyTitle;
  if (tab.filePath) return tab.filePath.split('/').pop()?.replace(/\.md$/i, '') ?? 'Untitled';
  return 'Untitled';
}

class DocumentStore {
  private _tabs = $state<TabState[]>([emptyTab()]);
  private _activeIndex = $state(0);
  private _loadVersion = $state(0);

  get activeIndex(): number {
    return this._activeIndex;
  }

  get tabCount(): number {
    return this._tabs.length;
  }

  get tabMetas(): TabMeta[] {
    return this._tabs.map(tab => ({
      title: tabTitle(tab),
      filePath: tab.filePath,
      dirty: tab.dirty,
    }));
  }

  // Active-tab proxy getters
  get frontmatter(): ArticleFrontmatter | null {
    return this._tabs[this._activeIndex].frontmatter;
  }

  get body(): string {
    return this._tabs[this._activeIndex].body;
  }

  get titleFromBody(): string {
    return extractTitleFromBody(this._tabs[this._activeIndex].body);
  }

  get fieldOrder(): string[] {
    return this._tabs[this._activeIndex].fieldOrder;
  }

  get fileHandle(): FileSystemFileHandle | null {
    return this._tabs[this._activeIndex].fileHandle;
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

  get wordCount(): number {
    return this._tabs[this._activeIndex].body
      .replace(/#{1,6}\s/g, '')
      .replace(/<[^>]+>/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
  }

  get hookWarning(): boolean {
    const hook = String(this._tabs[this._activeIndex]?.frontmatter?.HOOK ?? '');
    if (!hook.trim()) return false;
    return hook.trim().split(/\s+/).filter(Boolean).length > 150;
  }

  get phase(): 'draft' | 'final' {
    const path = this._tabs[this._activeIndex]?.filePath ?? '';
    return path.endsWith('_final.md') ? 'final' : 'draft';
  }

  /** Load a file into the active tab (used for saves / initial load). */
  load(
    frontmatter: ArticleFrontmatter,
    body: string,
    fieldOrder: string[],
    fileHandle: FileSystemFileHandle | null,
    filePath: string | null = null,
    dirty = false,
  ): void {
    const tab = this._tabs[this._activeIndex];
    tab.frontmatter = frontmatter;
    tab.body = body;
    tab.fieldOrder = fieldOrder;
    tab.fileHandle = fileHandle;
    tab.filePath = filePath;
    tab.dirty = dirty;
    this._loadVersion += 1;
  }

  /** Open a blank tab (Cmd+T). Always creates a new one. */
  newTab(): void {
    this._tabs.push(emptyTab());
    this._activeIndex = this._tabs.length - 1;
  }

  /** Open a parsed file in a new tab.  Reuses the active tab if it is blank and untouched. */
  openInNewTab(parsed: ParsedFile): void {
    const current = this._tabs[this._activeIndex];
    const reuseEmpty =
      this._tabs.length === 1 &&
      current.frontmatter === null &&
      current.body === '' &&
      !current.dirty;

    if (reuseEmpty) {
      this.load(
        parsed.frontmatter,
        parsed.body,
        parsed.fieldOrder,
        parsed.fileHandle ?? null,
        parsed.filePath ?? null,
        parsed.dirty ?? false,
      );
      return;
    }

    this._tabs.push({
      frontmatter: parsed.frontmatter,
      body: parsed.body,
      fieldOrder: parsed.fieldOrder,
      fileHandle: parsed.fileHandle ?? null,
      filePath: parsed.filePath ?? null,
      dirty: parsed.dirty ?? false,
    });
    this._activeIndex = this._tabs.length - 1;
    this._loadVersion += 1;
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

  setBody(body: string): void {
    this._tabs[this._activeIndex].body = body;
    this._tabs[this._activeIndex].dirty = true;
  }

  patchField(field: keyof ArticleFrontmatter, value: unknown): void {
    const tab = this._tabs[this._activeIndex];
    if (!tab.frontmatter) return;
    tab.frontmatter = { ...tab.frontmatter, [field]: value };
    tab.dirty = true;
  }

  setAltSelection(section: 'TITLE' | 'SUBTITLE' | 'HOOK' | 'LANDING', text: string): void {
    const key = `${section}_SELECTED` as keyof ArticleFrontmatter;
    this.patchField(key, text);
  }

  replaceFrontmatter(frontmatter: ArticleFrontmatter): void {
    this._tabs[this._activeIndex].frontmatter = frontmatter;
    this._tabs[this._activeIndex].dirty = true;
  }

  markClean(): void {
    this._tabs[this._activeIndex].dirty = false;
  }

  reset(): void {
    this._tabs = [emptyTab()];
    this._activeIndex = 0;
  }
}

export const documentStore = new DocumentStore();
