// Catppuccin-flavour-only theme store (3.0). The flavour is chosen in
// Settings, never cycled from the keyboard; the 27-scheme base16 catalogue
// and custom-theme editor are gone (see docs/CHERRIES.md).
import {
  applyCatppuccinTheme,
  getCatppuccinFlavor,
  type CatppuccinFlavor,
} from '$lib/themes/catppuccin';

class ThemeStore {
  currentFlavor = $state<CatppuccinFlavor>('mocha');
  isLoaded = $state(false);

  constructor() {
    this.loadTheme();
  }

  loadTheme(): void {
    this.currentFlavor = getCatppuccinFlavor();
    this.applyTheme();
    this.isLoaded = true;
  }

  setFlavor(flavor: CatppuccinFlavor): void {
    this.currentFlavor = flavor;
    this.applyTheme();
  }

  private applyTheme(): void {
    applyCatppuccinTheme(this.currentFlavor);
  }
}

export const themeStore = new ThemeStore();
