import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface StackEdDB extends DBSchema {
  settings: { key: string; value: unknown };
  recents: {
    key: number;
    value: { id?: number; filePath: string; title: string; openedAt: number };
  };
}

const DB_PROMISE: Promise<IDBPDatabase<StackEdDB>> = openDB<StackEdDB>('stacked', 1, {
  upgrade(db) {
    db.createObjectStore('settings');
    db.createObjectStore('recents', { keyPath: 'id', autoIncrement: true });
  },
});

export type ApiProvider = 'claude' | 'openai';

const API_KEY_STORAGE_KEYS: Record<ApiProvider, string> = {
  claude: 'anthropicApiKey',
  openai: 'openaiApiKey',
};

const API_KEY_SAVED_KEYS: Record<ApiProvider, string> = {
  claude: 'anthropicApiKeySaved',
  openai: 'openaiApiKeySaved',
};

export async function saveApiKey(provider: ApiProvider, key: string): Promise<void> {
  const db = await DB_PROMISE;
  await db.put('settings', key, API_KEY_STORAGE_KEYS[provider]);
  await db.put('settings', key.trim().length > 0, API_KEY_SAVED_KEYS[provider]);
}

export async function loadApiKey(provider: ApiProvider): Promise<string> {
  const db = await DB_PROMISE;
  const key = (await db.get('settings', API_KEY_STORAGE_KEYS[provider])) as string | undefined;
  if (key !== undefined) return key;
  if (provider === 'claude') {
    return ((await db.get('settings', 'apiKey')) as string | undefined) ?? '';
  }
  return '';
}

export async function hasExplicitApiKey(provider: ApiProvider): Promise<boolean> {
  const db = await DB_PROMISE;
  return ((await db.get('settings', API_KEY_SAVED_KEYS[provider])) as boolean | undefined) ?? false;
}

export async function savePipelineFolderPath(path: string): Promise<void> {
  const db = await DB_PROMISE;
  await db.put('settings', path, 'pipelineFolderPath');
}

export async function loadPipelineFolderPath(): Promise<string | null> {
  const db = await DB_PROMISE;
  return ((await db.get('settings', 'pipelineFolderPath')) as string | undefined) ?? null;
}

export interface RecentFile {
  id?: number;
  filePath: string;
  title: string;
  openedAt: number;
}

const MAX_RECENTS = 20;

export async function addRecentFile(filePath: string, title: string): Promise<void> {
  const db = await DB_PROMISE;
  const tx = db.transaction('recents', 'readwrite');
  const all = await tx.store.getAll();
  const existing = all.find((recent) => recent.filePath === filePath);
  if (existing?.id !== undefined) {
    await tx.store.delete(existing.id);
  } else if (all.length >= MAX_RECENTS) {
    const oldest = all.sort((a, b) => a.openedAt - b.openedAt)[0];
    if (oldest.id !== undefined) await tx.store.delete(oldest.id);
  }
  await tx.store.add({ filePath, title, openedAt: Date.now() });
  await tx.done;
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  const db = await DB_PROMISE;
  const all = await db.getAll('recents');
  return all
    .filter((recent): recent is RecentFile => typeof recent.filePath === 'string')
    .sort((a, b) => b.openedAt - a.openedAt)
    .slice(0, MAX_RECENTS);
}
