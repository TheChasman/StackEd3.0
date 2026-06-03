import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { parseMarkdownFile, serializeArticleFile } from '$lib/utils/frontmatter';
import { FRONTMATTER_DEFAULTS } from '$lib/types/article';
import type { ArticleFrontmatter, ParsedFile } from '$lib/types/article';
import { addRecentFile } from '$lib/services/storage';

const LAST_SAVED_FOLDER_KEY = 'stacked:lastSavedFolder';

function getLocalStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function getFolderPath(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  const index = normalized.lastIndexOf('/');
  return index > 0 ? filePath.slice(0, index) : '';
}

function rememberLastSavedFolder(filePath: string): void {
  const folder = getFolderPath(filePath);
  if (folder) getLocalStorage()?.setItem(LAST_SAVED_FOLDER_KEY, folder);
}

function getSuggestedFileName(frontmatter: ArticleFrontmatter): string {
  const baseName = frontmatter.title.trim().replace(/[/:*?"<>|\\]/g, '-');
  return `${baseName || 'document'}.md`;
}

function getDefaultSavePath(frontmatter: ArticleFrontmatter): string {
  const fileName = getSuggestedFileName(frontmatter);
  const folder = getLocalStorage()?.getItem(LAST_SAVED_FOLDER_KEY);
  return folder ? `${folder}/${fileName}` : fileName;
}

export async function openFolder(): Promise<FileSystemDirectoryHandle> {
  return (window as any).showDirectoryPicker({ mode: 'readwrite' });
}

export async function openFile(handle?: FileSystemFileHandle): Promise<ParsedFile> {
  const fileHandle =
    handle ??
    (await (window as any).showOpenFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      multiple: false,
    }))[0];

  const file = await fileHandle.getFile();
  const content = await file.text();
  const { frontmatter: raw, body, fieldOrder } = parseMarkdownFile(content);

  // Merge with defaults so no field is ever undefined
  const frontmatter: ArticleFrontmatter = {
    ...FRONTMATTER_DEFAULTS,
    ...(raw as Partial<ArticleFrontmatter>),
  };

  await addRecentFile(fileHandle, frontmatter.title || file.name).catch(() => {});

  return { frontmatter, body, fieldOrder, fileHandle, filePath: null };
}

export async function saveAsFile(
  frontmatter: ArticleFrontmatter,
  fieldOrder: string[],
  body: string,
): Promise<string | null> {
  const filePath = await save({
    title: 'Save StackEd Markdown File',
    defaultPath: getDefaultSavePath(frontmatter),
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });

  if (!filePath) return null;

  await saveFilePath(filePath, frontmatter, fieldOrder, body);
  rememberLastSavedFolder(filePath);
  return filePath;
}

function parseContent(content: string, fallbackTitle: string): Omit<ParsedFile, 'fileHandle' | 'filePath'> {
  const { frontmatter: raw, body, fieldOrder } = parseMarkdownFile(content);
  const frontmatter: ArticleFrontmatter = {
    ...FRONTMATTER_DEFAULTS,
    ...(raw as Partial<ArticleFrontmatter>),
  };
  if (!frontmatter.title) frontmatter.title = fallbackTitle;
  return { frontmatter, body, fieldOrder };
}

export async function openFilePath(filePath: string): Promise<ParsedFile> {
  const content = await invoke<string>('read_markdown_file', { filePath });
  const filename = filePath.split('/').pop() ?? filePath;
  return {
    ...parseContent(content, filename),
    fileHandle: null,
    filePath,
  };
}

export async function saveFile(
  fileHandle: FileSystemFileHandle,
  frontmatter: ArticleFrontmatter,
  fieldOrder: string[],
  body: string,
): Promise<void> {
  const content = serializeArticleFile(frontmatter, fieldOrder, body);
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}

export async function saveFilePath(
  filePath: string,
  frontmatter: ArticleFrontmatter,
  fieldOrder: string[],
  body: string,
): Promise<void> {
  const content = serializeArticleFile(frontmatter, fieldOrder, body);
  await invoke('write_markdown_file', { filePath, content });
  rememberLastSavedFolder(filePath);
}
