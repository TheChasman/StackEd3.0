import {
  applyBase16Colors,
  getBase16Scheme,
  isBase16Colors,
  legacyThemeColorsToBase16,
  mapLegacyFlavorToSchemeId,
  type Base16Colors,
} from '$lib/themes/base16';
import { themeStorage, type CustomTheme } from '$lib/services/themeStorage';
import { catalogueSync } from '$lib/services/catalogueSync';

class CustomThemesStore {
  customThemes = $state<CustomTheme[]>([]);
  isLoaded = $state(false);
  activeCustomId = $state<string | null>(null);

  constructor() {
    this.loadThemes();
  }

  private normalizeColors(colors: Base16Colors | Record<string, string>): Base16Colors {
    if (isBase16Colors(colors)) return colors;
    return legacyThemeColorsToBase16(colors);
  }

  private normalizeTheme(theme: CustomTheme): { theme: CustomTheme; changed: boolean } {
    const colors = this.normalizeColors(theme.colors);
    const catalogueId = theme.catalogueId
      ?? (theme.catalogueFlavor ? mapLegacyFlavorToSchemeId(theme.catalogueFlavor) : null)
      ?? undefined;
    const changed = !isBase16Colors(theme.colors) || catalogueId !== theme.catalogueId || Boolean(theme.catalogueFlavor);
    return {
      theme: {
        ...theme,
        colors,
        catalogueId,
        catalogueFlavor: undefined,
      },
      changed,
    };
  }

  async loadThemes(): Promise<void> {
    try {
      const loadedThemes = await themeStorage.loadThemes();
      const normalizedThemes: CustomTheme[] = [];

      for (const loadedTheme of loadedThemes) {
        const normalized = this.normalizeTheme(loadedTheme);
        normalizedThemes.push(normalized.theme);
        if (normalized.changed) {
          await themeStorage.saveTheme(normalized.theme);
        }
      }

      this.customThemes = normalizedThemes;
      const savedId = localStorage.getItem('activeCustomThemeId');
      if (savedId && this.customThemes.some(t => t.id === savedId)) {
        this.activeCustomId = savedId;
        const activeTheme = this.customThemes.find((theme) => theme.id === savedId);
        if (activeTheme) {
          applyBase16Colors(activeTheme.colors as Base16Colors);
        }
      }
    } catch (e) {
      console.error('Failed to load custom themes:', e);
    }
    this.isLoaded = true;
  }

  async createTheme(name: string, colors: Base16Colors | Record<string, string>, description?: string): Promise<CustomTheme> {
    const theme: CustomTheme = {
      id: themeStorage.generateId(),
      name,
      description,
      timestamp: Date.now(),
      colors: this.normalizeColors(colors),
      source: 'custom',
    };

    await themeStorage.saveTheme(theme);
    this.customThemes = [theme, ...this.customThemes];
    return theme;
  }

  async updateTheme(id: string, updates: Partial<CustomTheme>): Promise<void> {
    const theme = this.customThemes.find(t => t.id === id);
    if (!theme) throw new Error(`Theme ${id} not found`);

    const updatedColors = updates.colors
      ? this.normalizeColors(updates.colors)
      : (theme.colors as Base16Colors);
    const updated = {
      ...theme,
      ...updates,
      colors: updatedColors,
      timestamp: Date.now(),
    };
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
    localStorage.removeItem('themeSchemeId');

    applyBase16Colors(theme.colors as Base16Colors);
  }

  async toggleFavorite(id: string): Promise<void> {
    const theme = this.customThemes.find(t => t.id === id);
    if (theme) {
      await this.updateTheme(id, { isFavorite: !theme.isFavorite });
    }
  }

  async importFromCatalogue(schemeId: string): Promise<CustomTheme> {
    const existing = this.getThemeByCatalogueId(schemeId);
    if (existing) return existing;
    const imported = await catalogueSync.importFromCatalogue(schemeId);
    const normalized = this.normalizeTheme(imported).theme;
    this.customThemes = [normalized, ...this.customThemes];
    return normalized;
  }

  getThemeByCatalogueId(schemeId: string): CustomTheme | undefined {
    return this.customThemes.find(theme => theme.catalogueId === schemeId);
  }

  cloneFromCatalogueScheme(schemeId: string): Promise<CustomTheme> {
    const scheme = getBase16Scheme(schemeId);
    if (!scheme) throw new Error(`Theme scheme ${schemeId} not found`);
    return this.createTheme(
      `${scheme.name} (Custom)`,
      { ...scheme.colors },
      `Custom variant of ${scheme.name}`,
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
