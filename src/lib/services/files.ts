import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save } from '@tauri-apps/plugin-dialog';
import { parseMarkdownFile, serializeArticleFile } from '$lib/utils/frontmatter';
import { FRONTMATTER_DEFAULTS, FRONTMATTER_FIELD_ORDER } from '$lib/types/article';
import type { ArticleFrontmatter, ParsedFile } from '$lib/types/article';
import { addRecentFile, loadPipelineFolderPath } from '$lib/services/storage';

const LAST_SAVED_FOLDER_KEY = 'stacked:lastSavedFolder';
const STACKED_ARTICLE_SAVE_EXTENSIONS = ['md'];

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

function getFileName(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? filePath.slice(index + 1) : filePath;
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/').replace(/\/+$/, '');
}

function isInsideFolder(filePath: string, folderPath: string): boolean {
  const file = normalizePath(filePath);
  const folder = normalizePath(folderPath);
  return file === folder || file.startsWith(`${folder}/`);
}

function rememberLastSavedFolder(filePath: string): void {
  const folder = getFolderPath(filePath);
  if (folder) getLocalStorage()?.setItem(LAST_SAVED_FOLDER_KEY, folder);
}

function getSuggestedFileName(frontmatter: ArticleFrontmatter): string {
  const baseName = (frontmatter.TITLE || '').trim().replace(/[/:*?"<>|\\]/g, '-');
  return `${baseName || 'article'}.md`;
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.md$/i, '');
}

function getDefaultSavePath(frontmatter: ArticleFrontmatter): string {
  const fileName = getSuggestedFileName(frontmatter);
  const folder = getLocalStorage()?.getItem(LAST_SAVED_FOLDER_KEY);
  return folder ? `${folder}/${fileName}` : fileName;
}

function getDefaultNewPath(): string {
  const folder = getLocalStorage()?.getItem(LAST_SAVED_FOLDER_KEY);
  return folder ? `${folder}/untitled.md` : 'untitled.md';
}

function createTemplateFrontmatter(title: string): ArticleFrontmatter {
  const now = new Date().toISOString();
  return {
    ...FRONTMATTER_DEFAULTS,
    TITLE: title,
    created: now,
    updated: now,
  };
}

function getArticlePathForNewFile(selectedPath: string): { articlePath: string; artworkPath: string; title: string } {
  const fileName = getFileName(selectedPath);
  const title = titleFromFileName(fileName);
  const parent = getFolderPath(selectedPath);
  const parentName = getFileName(parent);
  const articleFolder = parentName === title ? parent : parent ? `${parent}/${title}` : title;

  return {
    articlePath: `${articleFolder}/${title}.md`,
    artworkPath: `${articleFolder}/artwork`,
    title,
  };
}

export async function openFolder(): Promise<string | null> {
  const selected = await openDialog({
    title: 'Select Pipeline Folder',
    directory: true,
    multiple: false,
  });
  return Array.isArray(selected) ? (selected[0] ?? null) : selected;
}

async function organizePipelineFile(filePath: string): Promise<string> {
  const pipelineFolderPath = await loadPipelineFolderPath();
  if (!pipelineFolderPath) return filePath;
  if (!isInsideFolder(filePath, pipelineFolderPath)) return filePath;
  return invoke<string>('organize_pipeline_article', { filePath, pipelineFolderPath });
}

export async function openFile(handle?: FileSystemFileHandle): Promise<ParsedFile> {
  if (!handle) {
    const selected = await openDialog({
      title: 'Open Markdown File',
      multiple: false,
      filters: [{ name: 'Markdown', extensions: STACKED_ARTICLE_SAVE_EXTENSIONS }],
    });
    const filePath = Array.isArray(selected) ? selected[0] : selected;
    if (!filePath) throw new Error('No file selected');
    return openFilePath(filePath);
  }

  const fileHandle =
    handle;

  const file = await fileHandle.getFile();
  const content = await file.text();
  const parsed = parseContent(content, file.name);

  return { ...parsed, fileHandle, filePath: null };
}

export async function saveAsFile(
  frontmatter: ArticleFrontmatter,
  fieldOrder: string[],
  body: string,
): Promise<string | null> {
  const filePath = await save({
    title: 'Save Markdown File',
    defaultPath: getDefaultSavePath(frontmatter),
    filters: [{ name: 'Markdown', extensions: STACKED_ARTICLE_SAVE_EXTENSIONS }],
  });

  if (!filePath) return null;

  return saveFilePath(filePath, frontmatter, fieldOrder, body);
}

export async function createNewFile(): Promise<ParsedFile | null> {
  const selectedPath = await save({
    title: 'New StackEd Article',
    defaultPath: getDefaultNewPath(),
    filters: [{ name: 'Markdown', extensions: STACKED_ARTICLE_SAVE_EXTENSIONS }],
  });

  if (!selectedPath) return null;

  const { articlePath, artworkPath, title } = getArticlePathForNewFile(selectedPath);
  const frontmatter = createTemplateFrontmatter(title);
  const fieldOrder = FRONTMATTER_FIELD_ORDER.map(String);
  const body = '';
  const content = serializeArticleFile(frontmatter, fieldOrder, body);

  await invoke('create_dir_recursive', { path: artworkPath });
  await invoke('write_markdown_file', { filePath: articlePath, content });
  rememberLastSavedFolder(articlePath);
  await addRecentFile(articlePath, frontmatter.TITLE || title).catch(() => {});

  return {
    frontmatter,
    body,
    fieldOrder,
    fileHandle: null,
    filePath: articlePath,
    dirty: false,
  };
}

function parseContent(content: string, fallbackTitle: string): Omit<ParsedFile, 'fileHandle' | 'filePath'> {
  const { frontmatter: raw, body, fieldOrder, hasFrontmatter, removedArtifacts } = parseMarkdownFile(content);
  const now = new Date().toISOString();
  const fallbackTitleFromName = titleFromFileName(fallbackTitle);

  const value = (key: string): string => {
    const field = raw[key];
    return typeof field === 'string' ? field : '';
  };

  const frontmatter: ArticleFrontmatter = {
    IMAGE: value('IMAGE') || FRONTMATTER_DEFAULTS.IMAGE,
    SPARK: value('SPARK') || value('spark_notes') || FRONTMATTER_DEFAULTS.SPARK,
    TITLE: value('TITLE') || value('title') || fallbackTitleFromName || FRONTMATTER_DEFAULTS.TITLE,
    SUBTITLE: value('SUBTITLE') || value('subtitle') || FRONTMATTER_DEFAULTS.SUBTITLE,
    HOOK: value('HOOK') || value('hook') || value('opening') || FRONTMATTER_DEFAULTS.HOOK,
    LANDING: value('LANDING') || FRONTMATTER_DEFAULTS.LANDING,
    created: value('created') || now,
    updated: value('updated') || now,
  };

  const expectedOrder = FRONTMATTER_FIELD_ORDER.map(String);
  const rawKeys = Object.keys(raw);
  const hasLatestSchema =
    hasFrontmatter &&
    rawKeys.length === expectedOrder.length &&
    fieldOrder.length === expectedOrder.length &&
    expectedOrder.every((key, index) => rawKeys.includes(key) && fieldOrder[index] === key);

  return {
    frontmatter,
    body,
    fieldOrder: expectedOrder,
    dirty: !hasLatestSchema || removedArtifacts,
  };
}

export async function openFilePath(filePath: string): Promise<ParsedFile> {
  const articlePath = await organizePipelineFile(filePath);
  const content = await invoke<string>('read_markdown_file', { filePath: articlePath });
  const filename = getFileName(articlePath);
  const parsed = parseContent(content, filename);
  await addRecentFile(articlePath, parsed.frontmatter.TITLE || filename).catch(() => {});
  return {
    ...parsed,
    fileHandle: null,
    filePath: articlePath,
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
): Promise<string> {
  const content = serializeArticleFile(frontmatter, fieldOrder, body);
  await invoke('write_markdown_file', { filePath, content });
  const articlePath = await organizePipelineFile(filePath);
  rememberLastSavedFolder(articlePath);
  await addRecentFile(articlePath, frontmatter.TITLE || getFileName(articlePath)).catch(() => {});
  return articlePath;
}
