import { applyCatppuccinTheme, catppuccinPalettes, type CatppuccinFlavor } from '$lib/themes/catppuccin';
import { themeStorage, type CustomTheme } from '$lib/services/themeStorage';
import { catalogueSync } from '$lib/services/catalogueSync';

class CustomThemesStore {
  customThemes = $state<CustomTheme[]>([]);
  isLoaded = $state(false);
  activeCustomId = $state<string | null>(null);

  constructor() {
    this.loadThemes();
  }

  async loadThemes(): Promise<void> {
    try {
      this.customThemes = await themeStorage.loadThemes();
      const savedId = localStorage.getItem('activeCustomThemeId');
      if (savedId && this.customThemes.some(t => t.id === savedId)) {
        this.activeCustomId = savedId;
      }
    } catch (e) {
      console.error('Failed to load custom themes:', e);
    }
    this.isLoaded = true;
  }

  async createTheme(name: string, colors: Record<string, string>, description?: string): Promise<CustomTheme> {
    const theme: CustomTheme = {
      id: themeStorage.generateId(),
      name,
      description,
      timestamp: Date.now(),
      colors,
      source: 'custom',
    };

    await themeStorage.saveTheme(theme);
    this.customThemes = [theme, ...this.customThemes];
    return theme;
  }

  async updateTheme(id: string, updates: Partial<CustomTheme>): Promise<void> {
    const theme = this.customThemes.find(t => t.id === id);
    if (!theme) throw new Error(`Theme ${id} not found`);

    const updated = { ...theme, ...updates, timestamp: Date.now() };
    await themeStorage.saveTheme(updated);

    const index = this.customThemes.indexOf(theme);
    this.customThemes[index] = updated;

    if (this.activeCustomId === id) {
      this.applyCustomTheme(id);
    }
  }

  async deleteTheme(id: string): Promise<void> {
    await themeStorage.deleteTheme(id);
    this.customThemes = this.customThemes.filter(t => t.id !== id);
    if (this.activeCustomId === id) {
      this.activeCustomId = null;
      localStorage.removeItem('activeCustomThemeId');
    }
  }

  async cloneTheme(id: string, newName: string): Promise<CustomTheme> {
    const theme = this.customThemes.find(t => t.id === id);
    if (!theme) throw new Error(`Theme ${id} not found`);

    return this.createTheme(newName, { ...theme.colors }, `Clone of ${theme.name}`);
  }

  async applyCustomTheme(id: string): Promise<void> {
    const theme = this.customThemes.find(t => t.id === id);
    if (!theme) throw new Error(`Theme ${id} not found`);

    this.activeCustomId = id;
    localStorage.setItem('activeCustomThemeId', id);

    // Apply colors to document
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([name, value]) => {
      root.style.setProperty(`--cat-${name}`, value);
    });
  }

  async toggleFavorite(id: string): Promise<void> {
    const theme = this.customThemes.find(t => t.id === id);
    if (theme) {
      await this.updateTheme(id, { isFavorite: !theme.isFavorite });
    }
  }

  async importFromCatalogue(flavor: CatppuccinFlavor): Promise<CustomTheme> {
    const existing = this.getThemeByCatalogueFlavor(flavor);
    if (existing) return existing;
    const theme = await catalogueSync.importFromCatalogue(flavor);
    this.customThemes = [theme, ...this.customThemes];
    return theme;
  }

  getThemeByCatalogueFlavor(flavor: CatppuccinFlavor): CustomTheme | undefined {
    return this.customThemes.find(theme => theme.catalogueFlavor === flavor);
  }

  cloneFromCatalogueFlavor(flavor: CatppuccinFlavor): Promise<CustomTheme> {
    const paletteData = catppuccinPalettes[flavor];
    const metadata = catalogueSync.getOfficialFlavors().find(f => f.flavor === flavor);
    
    // Convert palette to Record<string, string>
    const colors: Record<string, string> = {};
    for (const [key, value] of Object.entries(paletteData)) {
      colors[key] = value as string;
    }

    return this.createTheme(
      `${metadata?.name} (Custom)`,
      colors,
      `Custom variant of ${metadata?.name}`
    );
  }

  getFavorites(): CustomTheme[] {
    return this.customThemes.filter(t => t.isFavorite);
  }

  search(query: string): CustomTheme[] {
    const q = query.toLowerCase();
    return this.customThemes.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q)
    );
  }
}

export const customThemesStore = new CustomThemesStore();
