import { applyCatppuccinTheme, getCatppuccinFlavor, type CatppuccinFlavor } from '$lib/themes/catppuccin';

type AllThemes = readonly CatppuccinFlavor[];

class ThemeStore {
  currentFlavor = $state<CatppuccinFlavor>('mocha');
  isLoaded = $state(false);
  private readonly allFlavors: AllThemes = ['frappe', 'macchiato', 'mocha'] as const;

  constructor() {
    this.loadTheme();
  }

  loadTheme(): void {
    const saved = getCatppuccinFlavor();
    const normalized = saved === 'latte' ? 'mocha' : saved;
    this.currentFlavor = normalized;
    this.applyTheme(normalized);
    this.isLoaded = true;
  }

  setFlavor(flavor: CatppuccinFlavor): void {
    this.currentFlavor = flavor;
    this.applyTheme(flavor);
  }

  cycleNext(): void {
    const currentIndex = this.allFlavors.indexOf(this.currentFlavor);
    const nextIndex = (currentIndex + 1) % this.allFlavors.length;
    this.setFlavor(this.allFlavors[nextIndex]);
  }

  cyclePrev(): void {
    const currentIndex = this.allFlavors.indexOf(this.currentFlavor);
    const prevIndex = (currentIndex - 1 + this.allFlavors.length) % this.allFlavors.length;
    this.setFlavor(this.allFlavors[prevIndex]);
  }

  getAllFlavors(): AllThemes {
    return this.allFlavors;
  }

  private applyTheme(flavor: CatppuccinFlavor): void {
    applyCatppuccinTheme(flavor);
  }
}

export const themeStore = new ThemeStore();
