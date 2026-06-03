import { catppuccinPalettes, type CatppuccinFlavor } from '$lib/themes/catppuccin';
import type { CustomTheme } from './themeStorage';
import { themeStorage } from './themeStorage';

export interface CatppuccinMetadata {
  version: string;
  latte: {
    name: string;
    emoji: string;
    dark: boolean;
  };
  frappe: {
    name: string;
    emoji: string;
    dark: boolean;
  };
  macchiato: {
    name: string;
    emoji: string;
    dark: boolean;
  };
  mocha: {
    name: string;
    emoji: string;
    dark: boolean;
  };
}

export const catalogueMetadata: CatppuccinMetadata = {
  version: '1.8.0',
  latte: { name: 'Latte', emoji: '🌻', dark: false },
  frappe: { name: 'Frappé', emoji: '🪴', dark: true },
  macchiato: { name: 'Macchiato', emoji: '🌺', dark: true },
  mocha: { name: 'Mocha', emoji: '☕', dark: true },
};

class CatalogueSyncService {
  async importFromCatalogue(flavor: CatppuccinFlavor): Promise<CustomTheme> {
    const palette = catppuccinPalettes[flavor];
    const metadata = catalogueMetadata[flavor];

    // Convert palette to Record<string, string>
    const colors: Record<string, string> = {};
    for (const [key, value] of Object.entries(palette)) {
      colors[key] = value as string;
    }

    const theme: CustomTheme = {
      id: themeStorage.generateId(),
      name: `${metadata.name} (Official)`,
      description: `Official Catppuccin ${metadata.name} flavor v${catalogueMetadata.version}`,
      timestamp: Date.now(),
      colors,
      source: 'imported',
    };

    await themeStorage.saveTheme(theme);
    return theme;
  }

  getOfficialFlavors(): Array<{
    flavor: CatppuccinFlavor;
    name: string;
    emoji: string;
    dark: boolean;
  }> {
    return [
      { flavor: 'latte', ...catalogueMetadata.latte },
      { flavor: 'frappe', ...catalogueMetadata.frappe },
      { flavor: 'macchiato', ...catalogueMetadata.macchiato },
      { flavor: 'mocha', ...catalogueMetadata.mocha },
    ];
  }
}

export const catalogueSync = new CatalogueSyncService();
