import type { ArticleFrontmatter } from '$lib/types/article';

class DocumentStore {
  frontmatter = $state<ArticleFrontmatter | null>(null);
  body = $state('');
  fieldOrder = $state<string[]>([]);
  fileHandle = $state<FileSystemFileHandle | null>(null);
  filePath = $state<string | null>(null);
  dirty = $state(false);

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

  /** Update a frontmatter field. */
  patchField(field: keyof ArticleFrontmatter, value: unknown): void {
    if (!this.frontmatter) return;
    this.frontmatter = { ...this.frontmatter, [field]: value };
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
