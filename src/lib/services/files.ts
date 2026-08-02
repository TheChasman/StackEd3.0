import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save } from '@tauri-apps/plugin-dialog';
import { serializeScaffold, deserializeScaffold, generateMarkdownMirror, scaffoldJsonPath, scaffoldMdMirrorPath } from '$lib/utils/scaffold';
import { migrateFromArticle } from '$lib/utils/scaffoldMigration';
import { parseMarkdownFile } from '$lib/utils/frontmatter';
import { FRONTMATTER_DEFAULTS, FRONTMATTER_FIELD_ORDER } from '$lib/types/article';
import { emptyScaffold, type Scaffold } from '$lib/types/scaffold';
import { substackExtensions } from '$lib/editor/schema';
import { addRecentFile } from '$lib/services/storage';
import { syncRecentFilesMenu } from '$lib/services/recentMenu';

const LAST_SAVED_FOLDER_KEY = 'stacked:lastSavedFolder';
const DEFAULT_OPEN_FOLDER = '/Users/chasnewport/Obsidian/O_Substack';

function getLocalStorage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
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

function rememberLastSavedFolder(filePath: string): void {
  const folder = getFolderPath(filePath);
  if (folder) getLocalStorage()?.setItem(LAST_SAVED_FOLDER_KEY, folder);
}

function getDefaultOpenPath(): string {
  return getLocalStorage()?.getItem(LAST_SAVED_FOLDER_KEY) || DEFAULT_OPEN_FOLDER;
}

function getDefaultSavePath(scaffold: Scaffold): string {
  const title = (scaffold.payload as any)?.draft_title?.trim()?.replace(/[/:*?"<>|\\]/g, '-') || 'article';
  const fileName = `${title}.stacked.json`;
  const folder = getLocalStorage()?.getItem(LAST_SAVED_FOLDER_KEY);
  return folder ? `${folder}/${fileName}` : fileName;
}

function getDefaultNewPath(): string {
  const folder = getLocalStorage()?.getItem(LAST_SAVED_FOLDER_KEY);
  return folder ? `${folder}/untitled.stacked.json` : 'untitled.stacked.json';
}

export function titleFromFilePath(filePath: string): string {
  return getFileName(filePath).replace(/\.stacked\.json$/i, '').replace(/\.md$/i, '');
}

async function addAndSyncRecent(filePath: string, title: string): Promise<void> {
  await addRecentFile(filePath, title).catch(() => {});
  await syncRecentFilesMenu().catch(() => {});
}

function getArticlePathForNewFile(selectedPath: string): { articlePath: string; artworkPath: string; researchPath: string; title: string } {
  const fileName = getFileName(selectedPath);
  const title = titleFromFilePath(fileName);
  const parent = getFolderPath(selectedPath);
  const parentName = getFileName(parent);
  const articleFolder = (parentName === title || parentName === `A_${title}`)
    ? parent
    : parent ? `${parent}/A_${title}` : `A_${title}`;

  return {
    articlePath: `${articleFolder}/${title}.stacked.json`,
    artworkPath: `${articleFolder}/_artwork`,
    researchPath: `${articleFolder}/_research`,
    title,
  };
}

// --- Public API ---

export async function openFolder(): Promise<string | null> {
  const selected = await openDialog({
    title: 'Select Pipeline Folder',
    directory: true,
    multiple: false,
  });
  return Array.isArray(selected) ? (selected[0] ?? null) : selected;
}

export async function openScaffold(): Promise<Scaffold | null> {
  const selected = await openDialog({
    title: 'Open File',
    multiple: false,
    defaultPath: getDefaultOpenPath(),
    filters: [
      { name: 'StackEd files', extensions: ['stacked.json', 'md'] },
    ],
  });
  const filePath = Array.isArray(selected) ? selected[0] : selected;
  if (!filePath) return null;
  return openScaffoldPath(filePath);
}

export async function openScaffoldPath(filePath: string): Promise<Scaffold> {
  // If it's a .md file, check for a .stacked.json alongside it
  if (filePath.endsWith('.md')) {
    const jsonPath = scaffoldJsonPath(filePath);
    try {
      const content = await invoke<string>('read_file', { path: jsonPath });
      const scaffold = deserializeScaffold(content);
      await addAndSyncRecent(jsonPath, scaffold.payload && 'draft_title' in scaffold.payload ? scaffold.payload.draft_title : 'Note');
      return scaffold;
    } catch {
      // No .stacked.json found — migrate from the .md file
      return migrateFromMdFile(filePath);
    }
  }

  // Read .stacked.json directly
  const content = await invoke<string>('read_file', { path: filePath });
  const scaffold = deserializeScaffold(content);
  await addAndSyncRecent(filePath, scaffold.payload && 'draft_title' in scaffold.payload ? scaffold.payload.draft_title : 'Note');
  return scaffold;
}

async function migrateFromMdFile(mdPath: string): Promise<Scaffold> {
  const content = await invoke<string>('read_markdown_file', { filePath: mdPath });
  const parsed = parseMarkdownFile(content);

  // Build ArticleFrontmatter from parsed data
  const fm = { ...FRONTMATTER_DEFAULTS };
  for (const key of Object.keys(parsed.frontmatter)) {
    const val = parsed.frontmatter[key];
    if (key in fm && typeof val === typeof (fm as any)[key]) {
      (fm as any)[key] = val;
    }
  }
  // Fallback title from filename
  if (!fm.TITLE) fm.TITLE = titleFromFilePath(mdPath);

  const scaffold = migrateFromArticle(fm, parsed.body, substackExtensions);

  // Save the .stacked.json alongside the .md
  const jsonPath = scaffoldJsonPath(mdPath);
  await writeFilePath(jsonPath, serializeScaffold(scaffold));

  // Generate MD mirror
  const mdMirror = generateMarkdownMirror(scaffold, substackExtensions);
  await writeFilePath(scaffoldMdMirrorPath(mdPath), mdMirror);

  await addAndSyncRecent(jsonPath, scaffold.payload && 'draft_title' in scaffold.payload ? scaffold.payload.draft_title : 'Note');
  return scaffold;
}

export async function saveScaffoldPath(filePath: string, scaffold: Scaffold): Promise<string> {
  const json = serializeScaffold(scaffold);
  await invoke('write_file', { path: filePath, content: json });

  // Generate and write MD mirror
  try {
    const mdMirror = generateMarkdownMirror(scaffold, substackExtensions);
    const mdPath = scaffoldMdMirrorPath(filePath);
    await writeFilePath(mdPath, mdMirror);
  } catch {
    // MD mirror is best-effort; don't fail the save if it errors
  }

  rememberLastSavedFolder(filePath);
  const title = scaffold.payload && 'draft_title' in scaffold.payload ? scaffold.payload.draft_title : 'Note';
  await addAndSyncRecent(filePath, title);
  return filePath;
}

export async function saveScaffoldAs(scaffold: Scaffold): Promise<string | null> {
  const filePath = await save({
    title: 'Save Scaffold File',
    defaultPath: getDefaultSavePath(scaffold),
    filters: [{ name: 'StackEd Scaffold', extensions: ['stacked.json'] }],
  });

  if (!filePath) return null;
  return saveScaffoldPath(filePath, scaffold);
}

export async function createNewScaffold(): Promise<{ scaffold: Scaffold; filePath: string } | null> {
  const selectedPath = await save({
    title: 'New StackEd Article',
    defaultPath: getDefaultNewPath(),
    filters: [{ name: 'StackEd Scaffold', extensions: ['stacked.json'] }],
  });

  if (!selectedPath) return null;

  const { articlePath, artworkPath, researchPath, title } = getArticlePathForNewFile(selectedPath);
  const scaffold = emptyScaffold('post');
  if (scaffold.payload && 'draft_title' in scaffold.payload) {
    scaffold.payload.draft_title = title;
  }

  await invoke('create_dir_recursive', { path: artworkPath });
  await invoke('create_dir_recursive', { path: researchPath });
  await saveScaffoldPath(articlePath, scaffold);

  return { scaffold, filePath: articlePath };
}

export async function writeFilePath(filePath: string, content: string): Promise<void> {
  await invoke('write_file', { path: filePath, content });
}

export async function deleteFile(filePath: string): Promise<void> {
  await invoke('delete_file', { path: filePath });
}
