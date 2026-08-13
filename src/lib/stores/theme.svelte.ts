import {
  applyBase16Theme,
  DEFAULT_SCHEME_ID,
  getDarkBase16Schemes,
  getStoredSchemeId,
} from '$lib/themes/base16';

type AllThemes = readonly string[];

class ThemeStore {
  currentSchemeId = $state(DEFAULT_SCHEME_ID);
  isLoaded = $state(false);
  private readonly allSchemeIds: AllThemes = getDarkBase16Schemes().map((scheme) => scheme.id);

  constructor() {
    this.loadTheme();
  }

  loadTheme(): void {
    const saved = getStoredSchemeId();
    const normalized = this.allSchemeIds.includes(saved) ? saved : DEFAULT_SCHEME_ID;
    this.currentSchemeId = normalized;
    this.applyTheme(normalized);
    this.isLoaded = true;
  }

  setScheme(schemeId: string): void {
    if (!this.allSchemeIds.includes(schemeId)) return;
    this.currentSchemeId = schemeId;
    localStorage.removeItem('activeCustomThemeId');
    this.applyTheme(schemeId);
  }

  cycleNext(): void {
    const currentIndex = this.allSchemeIds.indexOf(this.currentSchemeId);
    const nextIndex = (currentIndex + 1) % this.allSchemeIds.length;
    this.setScheme(this.allSchemeIds[nextIndex]);
  }

  cyclePrev(): void {
    const currentIndex = this.allSchemeIds.indexOf(this.currentSchemeId);
    const prevIndex = (currentIndex - 1 + this.allSchemeIds.length) % this.allSchemeIds.length;
    this.setScheme(this.allSchemeIds[prevIndex]);
  }

  getAllSchemeIds(): AllThemes {
    return this.allSchemeIds;
  }

  private applyTheme(schemeId: string): void {
    applyBase16Theme(schemeId);
  }
}

export const themeStore = new ThemeStore();
