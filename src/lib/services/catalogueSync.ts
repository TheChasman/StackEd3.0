import { getBase16Scheme, getDarkBase16Schemes } from '$lib/themes/base16';
import type { CustomTheme } from './themeStorage';
import { themeStorage } from './themeStorage';

const catalogueVersion = '2026.06';

class CatalogueSyncService {
  async importFromCatalogue(schemeId: string): Promise<CustomTheme> {
    const scheme = getBase16Scheme(schemeId);
    if (!scheme) throw new Error(`Theme scheme ${schemeId} not found`);

    const theme: CustomTheme = {
      id: themeStorage.generateId(),
      name: `${scheme.name} (Official)`,
      description: `Bundled Base16 ${scheme.name} theme v${catalogueVersion}`,
      timestamp: Date.now(),
      colors: { ...scheme.colors },
      source: 'imported',
      catalogueId: scheme.id,
    };

    await themeStorage.saveTheme(theme);
    return theme;
  }

  getCatalogueSchemes(): Array<{
    id: string;
    name: string;
    emoji: string;
    dark: boolean;
    description: string;
    colors: Record<string, string>;
  }> {
    return getDarkBase16Schemes().map((scheme) => ({
      id: scheme.id,
      name: scheme.name,
      emoji: scheme.emoji,
      dark: scheme.dark,
      description: scheme.description,
      colors: { ...scheme.colors },
    }));
  }
}

export const catalogueSync = new CatalogueSyncService();
