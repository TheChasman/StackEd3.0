import { invoke } from '@tauri-apps/api/core';
import { appConfigDir, join } from '@tauri-apps/api/path';

export interface CustomTheme {
  id: string;
  name: string;
  description?: string;
  timestamp: number;
  colors: Record<string, string>;
  isFavorite?: boolean;
  source?: 'custom' | 'imported';
}

class ThemeStorage {
  private themesDir: string | null = null;

  private async getThemesDir(): Promise<string> {
    if (this.themesDir) return this.themesDir;
    const configDir = await appConfigDir();
    this.themesDir = await join(configDir, 'themes');
    // Ensure directory exists
    try {
      await invoke('create_dir_recursive', { path: this.themesDir });
    } catch {
      // Directory might already exist
    }
    return this.themesDir;
  }

  async loadThemes(): Promise<CustomTheme[]> {
    try {
      const themesDir = await this.getThemesDir();
      const files = await invoke<string[]>('list_files', { path: themesDir });
      const themes: CustomTheme[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await invoke<string>('read_file', {
            path: await join(themesDir, file),
          });
          themes.push(JSON.parse(content) as CustomTheme);
        }
      }

      return themes.sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }

  async saveTheme(theme: CustomTheme): Promise<void> {
    const themesDir = await this.getThemesDir();
    const filePath = await join(themesDir, `${theme.id}.json`);
    const content = JSON.stringify(theme, null, 2);
    await invoke('write_file', { path: filePath, contents: content });
  }

  async deleteTheme(id: string): Promise<void> {
    const themesDir = await this.getThemesDir();
    const filePath = await join(themesDir, `${id}.json`);
    await invoke('delete_file', { path: filePath });
  }

  async loadTheme(id: string): Promise<CustomTheme | null> {
    try {
      const themesDir = await this.getThemesDir();
      const filePath = await join(themesDir, `${id}.json`);
      const content = await invoke<string>('read_file', { path: filePath });
      return JSON.parse(content) as CustomTheme;
    } catch {
      return null;
    }
  }

  generateId(): string {
    return `theme_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const themeStorage = new ThemeStorage();
