import { invoke } from '@tauri-apps/api/core';
import { pruneRecentFiles } from '$lib/services/storage';
import type { RecentFile } from '$lib/services/storage';

interface RecentMenuEntry {
  title: string;
  filePath: string;
}

async function setRecentMenuEntries(entries: RecentMenuEntry[]): Promise<void> {
  await invoke('set_recent_files_menu', { entries });
}

function toMenuEntry(recent: RecentFile): RecentMenuEntry {
  return {
    title: recent.title?.trim() || recent.filePath.split('/').pop() || recent.filePath,
    filePath: recent.filePath,
  };
}

export async function syncRecentFilesMenu(recents?: RecentFile[]): Promise<void> {
  try {
    const list = recents ?? (await pruneRecentFiles());
    await setRecentMenuEntries(list.map(toMenuEntry));
  } catch {
    // menu sync is best-effort
  }
}
