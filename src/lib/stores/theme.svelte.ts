import { applyCatppuccinTheme, getCatppuccinFlavor, type CatppuccinFlavor } from '$lib/themes/catppuccin';

class ThemeStore {
  currentFlavor = $state<CatppuccinFlavor>('mocha');
  isLoaded = $state(false);

  constructor() {
    this.loadTheme();
  }

  loadTheme(): void {
    const saved = getCatppuccinFlavor();
    this.currentFlavor = saved;
    this.applyTheme(saved);
    this.isLoaded = true;
  }

  setFlavor(flavor: CatppuccinFlavor): void {
    this.currentFlavor = flavor;
    this.applyTheme(flavor);
  }

  private applyTheme(flavor: CatppuccinFlavor): void {
    applyCatppuccinTheme(flavor);
  }
}

export const themeStore = new ThemeStore();
