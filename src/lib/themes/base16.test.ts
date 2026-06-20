import { describe, expect, it } from 'vitest';
import {
  base16Schemes,
  legacyThemeColorsToBase16,
  mapLegacyFlavorToSchemeId,
  toAppThemeColors,
  type Base16Colors,
} from './base16';

function makeBase16Colors(overrides: Partial<Base16Colors> = {}): Base16Colors {
  return {
    base00: '#000000',
    base01: '#111111',
    base02: '#222222',
    base03: '#333333',
    base04: '#444444',
    base05: '#555555',
    base06: '#666666',
    base07: '#777777',
    base08: '#880000',
    base09: '#990000',
    base0A: '#aaaa00',
    base0B: '#00bb00',
    base0C: '#00cccc',
    base0D: '#0000dd',
    base0E: '#ee00ee',
    base0F: '#ff00ff',
    ...overrides,
  };
}

describe('base16 theme registry', () => {
  it('contains a broad built-in dark catalogue', () => {
    expect(base16Schemes.length).toBeGreaterThanOrEqual(12);
    expect(base16Schemes.some((scheme) => scheme.id === 'monokai')).toBe(true);
    expect(base16Schemes.some((scheme) => scheme.id === 'gruvbox-dark-hard')).toBe(true);
    expect(base16Schemes.some((scheme) => scheme.id === 'dracula')).toBe(true);
  });

  it('maps base16 slots into app theme tokens', () => {
    const appColors = toAppThemeColors(makeBase16Colors());
    expect(appColors.base).toBe('#000000');
    expect(appColors.text).toBe('#555555');
    expect(appColors.blue).toBe('#0000dd');
    expect(appColors.green).toBe('#00bb00');
    expect(appColors.red).toBe('#880000');
  });

  it('converts legacy catppuccin-like colors into base16 slots', () => {
    const converted = legacyThemeColorsToBase16({
      base: '#101010',
      mantle: '#1a1a1a',
      surface0: '#202020',
      overlay0: '#303030',
      subtext0: '#505050',
      text: '#f0f0f0',
      rosewater: '#f8f8f8',
      red: '#ff0000',
      peach: '#ff8800',
      yellow: '#ffff00',
      green: '#00ff00',
      teal: '#00ffaa',
      blue: '#0088ff',
      mauve: '#aa00ff',
      lavender: '#cc88ff',
      maroon: '#dd4444',
    });

    expect(converted.base00).toBe('#101010');
    expect(converted.base01).toBe('#1a1a1a');
    expect(converted.base02).toBe('#202020');
    expect(converted.base03).toBe('#303030');
    expect(converted.base04).toBe('#505050');
    expect(converted.base05).toBe('#f0f0f0');
    expect(converted.base08).toBe('#ff0000');
    expect(converted.base0B).toBe('#00ff00');
    expect(converted.base0D).toBe('#0088ff');
  });

  it('maps legacy catppuccin flavor ids to scheme ids', () => {
    expect(mapLegacyFlavorToSchemeId('latte')).toBe('catppuccin-latte');
    expect(mapLegacyFlavorToSchemeId('mocha')).toBe('catppuccin-mocha');
    expect(mapLegacyFlavorToSchemeId('unknown')).toBe(null);
  });
});
