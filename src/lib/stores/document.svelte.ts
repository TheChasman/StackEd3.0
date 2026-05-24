import type { ArticleFrontmatter, PipelineStage } from '$lib/types/article';

class DocumentStore {
  frontmatter = $state<ArticleFrontmatter | null>(null);
  body = $state('');
  fieldOrder = $state<string[]>([]);
  fileHandle = $state<FileSystemFileHandle | null>(null);
  filePath = $state<string | null>(null);
  dirty = $state(false);

  get isLocked(): boolean {
    return this.frontmatter?.content_locked ?? false;
  }

  /** Unlock is only available pre-post (substack_url still empty). */
  get canUnlock(): boolean {
    return this.isLocked && !this.frontmatter?.substack_url;
  }

  get wordCount(): number {
    return this.body
      .replace(/#{1,6}\s/g, '')       // strip heading markers
      .replace(/<[^>]+>/g, ' ')        // strip HTML tags
      .split(/\s+/)
      .filter(Boolean).length;
  }

  load(
    frontmatter: ArticleFrontmatter,
    body: string,
    fieldOrder: string[],
    fileHandle: FileSystemFileHandle | null,
    filePath: string | null = null,
  ): void {
    this.frontmatter = frontmatter;
    this.body = body;
    this.fieldOrder = fieldOrder;
    this.fileHandle = fileHandle;
    this.filePath = filePath;
    this.dirty = false;
  }

  setBody(body: string): void {
    this.body = body;
    this.dirty = true;
  }

  /** Update an author-owned (free) field. Does not touch overrides[]. */
  patchField(field: keyof ArticleFrontmatter, value: unknown): void {
    if (!this.frontmatter) return;
    this.frontmatter = { ...this.frontmatter, [field]: value };
    this.dirty = true;
  }

  /** Update an AI-owned (padlocked) field. Appends field name to overrides[]. */
  patchPadlockedField(field: keyof ArticleFrontmatter, value: unknown): void {
    if (!this.frontmatter) return;
    const overrides = this.frontmatter.overrides ?? [];
    this.frontmatter = {
      ...this.frontmatter,
      [field]: value,
      overrides: overrides.includes(field as string)
        ? overrides
        : [...overrides, field as string],
    };
    this.dirty = true;
  }

  /** Remove a field from overrides[] (let AI regenerate it). */
  clearOverride(field: keyof ArticleFrontmatter): void {
    if (!this.frontmatter) return;
    this.frontmatter = {
      ...this.frontmatter,
      overrides: this.frontmatter.overrides.filter(f => f !== (field as string)),
    };
    this.dirty = true;
  }

  /**
   * Unlock content after F&L review. Writes content_locked=false and
   * resets pipeline_stage to fact_check for re-review.
   * Only valid while canUnlock is true.
   */
  unlock(): void {
    if (!this.frontmatter || !this.canUnlock) return;
    this.frontmatter = {
      ...this.frontmatter,
      content_locked: false,
      pipeline_stage: 'fact_check' as PipelineStage,
    };
    this.dirty = true;
  }

  markClean(): void {
    this.dirty = false;
  }

  reset(): void {
    this.frontmatter = null;
    this.body = '';
    this.fieldOrder = [];
    this.fileHandle = null;
    this.filePath = null;
    this.dirty = false;
  }
}

export const documentStore = new DocumentStore();
