import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface StackEdDB extends DBSchema {
  settings: { key: string; value: unknown };
  recents: {
    key: number;
    value: { id?: number; handle: FileSystemFileHandle; title: string; openedAt: number };
  };
}

const DB_PROMISE: Promise<IDBPDatabase<StackEdDB>> = openDB<StackEdDB>('stacked', 1, {
  upgrade(db) {
    db.createObjectStore('settings');
    db.createObjectStore('recents', { keyPath: 'id', autoIncrement: true });
  },
});

export async function saveApiKey(key: string): Promise<void> {
  const db = await DB_PROMISE;
  await db.put('settings', key, 'apiKey');
}

export async function loadApiKey(): Promise<string> {
  const db = await DB_PROMISE;
  return ((await db.get('settings', 'apiKey')) as string | undefined) ?? '';
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await DB_PROMISE;
  await db.put('settings', handle, 'folderHandle');
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await DB_PROMISE;
  return ((await db.get('settings', 'folderHandle')) as FileSystemDirectoryHandle | undefined) ?? null;
}

export interface RecentFile {
  id?: number;
  handle: FileSystemFileHandle;
  title: string;
  openedAt: number;
}

const MAX_RECENTS = 20;

export async function addRecentFile(handle: FileSystemFileHandle, title: string): Promise<void> {
  const db = await DB_PROMISE;
  const tx = db.transaction('recents', 'readwrite');
  const all = await tx.store.getAll();
  if (all.length >= MAX_RECENTS) {
    const oldest = all.sort((a, b) => a.openedAt - b.openedAt)[0];
    if (oldest.id !== undefined) await tx.store.delete(oldest.id);
  }
  await tx.store.add({ handle, title, openedAt: Date.now() });
  await tx.done;
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  const db = await DB_PROMISE;
  const all = await db.getAll('recents');
  return all.sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_RECENTS);
}
