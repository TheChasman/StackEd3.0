export const BASE16_KEYS = [
  'base00',
  'base01',
  'base02',
  'base03',
  'base04',
  'base05',
  'base06',
  'base07',
  'base08',
  'base09',
  'base0A',
  'base0B',
  'base0C',
  'base0D',
  'base0E',
  'base0F',
] as const;

export type Base16Key = (typeof BASE16_KEYS)[number];
export type Base16Colors = Record<Base16Key, string>;

export interface Base16Scheme {
  id: string;
  name: string;
  description: string;
  emoji: string;
  dark: boolean;
  colors: Base16Colors;
}

function defineColors(colors: Base16Colors): Base16Colors {
  return colors;
}

export const base16Schemes: readonly Base16Scheme[] = [
  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    description: 'Rich dark with cool accents',
    emoji: '☕',
    dark: true,
    colors: defineColors({
      base00: '#1e1e2e',
      base01: '#181825',
      base02: '#313244',
      base03: '#45475a',
      base04: '#6c7086',
      base05: '#cdd6f4',
      base06: '#f5e0dc',
      base07: '#b4befe',
      base08: '#f38ba8',
      base09: '#fab387',
      base0A: '#f9e2af',
      base0B: '#a6e3a1',
      base0C: '#94e2d5',
      base0D: '#89b4fa',
      base0E: '#cba6f7',
      base0F: '#eba0ac',
    }),
  },
  {
    id: 'catppuccin-macchiato',
    name: 'Catppuccin Macchiato',
    description: 'Balanced dark with bright accents',
    emoji: '🌺',
    dark: true,
    colors: defineColors({
      base00: '#24273a',
      base01: '#1e2030',
      base02: '#363a4f',
      base03: '#494d64',
      base04: '#6e738d',
      base05: '#cad3f5',
      base06: '#f4dbd6',
      base07: '#b7bdf8',
      base08: '#ed8796',
      base09: '#f5a97f',
      base0A: '#eed49f',
      base0B: '#a6da95',
      base0C: '#8bd5ca',
      base0D: '#8aadf4',
      base0E: '#c6a0f6',
      base0F: '#ee99a0',
    }),
  },
  {
    id: 'catppuccin-frappe',
    name: 'Catppuccin Frappé',
    description: 'Muted dark with soft accents',
    emoji: '🪴',
    dark: true,
    colors: defineColors({
      base00: '#303446',
      base01: '#292c3c',
      base02: '#414559',
      base03: '#51576d',
      base04: '#737994',
      base05: '#c6d0f5',
      base06: '#f2d5cf',
      base07: '#babbf1',
      base08: '#e78284',
      base09: '#ef9f76',
      base0A: '#e5c890',
      base0B: '#a6d189',
      base0C: '#81c8be',
      base0D: '#8caaee',
      base0E: '#ca9ee6',
      base0F: '#ea999c',
    }),
  },
  {
    id: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    description: 'Soft light with vivid accents',
    emoji: '🌻',
    dark: false,
    colors: defineColors({
      base00: '#eff1f5',
      base01: '#e6e9ef',
      base02: '#ccd0da',
      base03: '#bcc0cc',
      base04: '#9ca0b0',
      base05: '#4c4f69',
      base06: '#dc8a78',
      base07: '#7287fd',
      base08: '#d20f39',
      base09: '#fe640b',
      base0A: '#df8e1d',
      base0B: '#40a02b',
      base0C: '#179299',
      base0D: '#1e66f5',
      base0E: '#8839ef',
      base0F: '#e64553',
    }),
  },
  {
    id: 'monokai',
    name: 'Monokai',
    description: 'Classic high-contrast dark',
    emoji: '🌙',
    dark: true,
    colors: defineColors({
      base00: '#272822',
      base01: '#1f201b',
      base02: '#49483e',
      base03: '#75715e',
      base04: '#a59f85',
      base05: '#f8f8f2',
      base06: '#f5f4f1',
      base07: '#f9f8f5',
      base08: '#f92672',
      base09: '#fd971f',
      base0A: '#f4bf75',
      base0B: '#a6e22e',
      base0C: '#a1efe4',
      base0D: '#66d9ef',
      base0E: '#ae81ff',
      base0F: '#cc6633',
    }),
  },
  {
    id: 'gruvbox-dark-hard',
    name: 'Gruvbox Dark Hard',
    description: 'Earthy dark with strong contrast',
    emoji: '🪵',
    dark: true,
    colors: defineColors({
      base00: '#1d2021',
      base01: '#3c3836',
      base02: '#504945',
      base03: '#665c54',
      base04: '#bdae93',
      base05: '#ebdbb2',
      base06: '#fbf1c7',
      base07: '#f9f5d7',
      base08: '#fb4934',
      base09: '#fe8019',
      base0A: '#fabd2f',
      base0B: '#b8bb26',
      base0C: '#8ec07c',
      base0D: '#83a598',
      base0E: '#d3869b',
      base0F: '#d65d0e',
    }),
  },
  {
    id: 'dracula',
    name: 'Dracula',
    description: 'Neon accents on deep purple dark',
    emoji: '🧛',
    dark: true,
    colors: defineColors({
      base00: '#282a36',
      base01: '#21222c',
      base02: '#44475a',
      base03: '#6272a4',
      base04: '#9ea8c7',
      base05: '#f8f8f2',
      base06: '#f0f1f4',
      base07: '#ffffff',
      base08: '#ff5555',
      base09: '#ffb86c',
      base0A: '#f1fa8c',
      base0B: '#50fa7b',
      base0C: '#8be9fd',
      base0D: '#80bfff',
      base0E: '#bd93f9',
      base0F: '#ff79c6',
    }),
  },
  {
    id: 'nord',
    name: 'Nord',
    description: 'Arctic dark with cool blues',
    emoji: '❄️',
    dark: true,
    colors: defineColors({
      base00: '#2e3440',
      base01: '#3b4252',
      base02: '#434c5e',
      base03: '#4c566a',
      base04: '#d8dee9',
      base05: '#e5e9f0',
      base06: '#eceff4',
      base07: '#8fbcbb',
      base08: '#bf616a',
      base09: '#d08770',
      base0A: '#ebcb8b',
      base0B: '#a3be8c',
      base0C: '#88c0d0',
      base0D: '#81a1c1',
      base0E: '#b48ead',
      base0F: '#5e81ac',
    }),
  },
  {
    id: 'one-dark',
    name: 'One Dark',
    description: 'Balanced dark inspired by Atom',
    emoji: '💡',
    dark: true,
    colors: defineColors({
      base00: '#282c34',
      base01: '#21252b',
      base02: '#353b45',
      base03: '#3e4451',
      base04: '#565c64',
      base05: '#abb2bf',
      base06: '#b6bdca',
      base07: '#c8ccd4',
      base08: '#e06c75',
      base09: '#d19a66',
      base0A: '#e5c07b',
      base0B: '#98c379',
      base0C: '#56b6c2',
      base0D: '#61afef',
      base0E: '#c678dd',
      base0F: '#be5046',
    }),
  },
  {
    id: 'tokyo-night-dark',
    name: 'Tokyo Night',
    description: 'Deep navy dark with saturated accents',
    emoji: '🌃',
    dark: true,
    colors: defineColors({
      base00: '#1a1b26',
      base01: '#16161e',
      base02: '#2f3549',
      base03: '#444b6a',
      base04: '#787c99',
      base05: '#a9b1d6',
      base06: '#cbccd1',
      base07: '#d5d6db',
      base08: '#f7768e',
      base09: '#ff9e64',
      base0A: '#e0af68',
      base0B: '#9ece6a',
      base0C: '#7dcfff',
      base0D: '#7aa2f7',
      base0E: '#bb9af7',
      base0F: '#c0caf5',
    }),
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    description: 'Low-contrast dark tuned for readability',
    emoji: '🌘',
    dark: true,
    colors: defineColors({
      base00: '#002b36',
      base01: '#073642',
      base02: '#586e75',
      base03: '#657b83',
      base04: '#839496',
      base05: '#93a1a1',
      base06: '#eee8d5',
      base07: '#fdf6e3',
      base08: '#dc322f',
      base09: '#cb4b16',
      base0A: '#b58900',
      base0B: '#859900',
      base0C: '#2aa198',
      base0D: '#268bd2',
      base0E: '#6c71c4',
      base0F: '#d33682',
    }),
  },
  {
    id: 'ayu-dark',
    name: 'Ayu Dark',
    description: 'Warm dark with bright accents',
    emoji: '🌌',
    dark: true,
    colors: defineColors({
      base00: '#0a0e14',
      base01: '#131721',
      base02: '#272d38',
      base03: '#3e4b59',
      base04: '#bfbdb6',
      base05: '#e6e1cf',
      base06: '#f3f4f5',
      base07: '#f8f9fa',
      base08: '#f07178',
      base09: '#ff8f40',
      base0A: '#ffb454',
      base0B: '#b8cc52',
      base0C: '#95e6cb',
      base0D: '#59c2ff',
      base0E: '#d2a6ff',
      base0F: '#e6b673',
    }),
  },
  {
    id: 'material-darker',
    name: 'Material Darker',
    description: 'Muted dark material palette',
    emoji: '📘',
    dark: true,
    colors: defineColors({
      base00: '#212121',
      base01: '#303030',
      base02: '#353535',
      base03: '#4a4a4a',
      base04: '#b2ccd6',
      base05: '#eeffff',
      base06: '#eeffff',
      base07: '#ffffff',
      base08: '#f07178',
      base09: '#f78c6c',
      base0A: '#ffcb6b',
      base0B: '#c3e88d',
      base0C: '#89ddff',
      base0D: '#82aaff',
      base0E: '#c792ea',
      base0F: '#ff5370',
    }),
  },
  {
    id: 'oxocarbon-dark',
    name: 'Oxocarbon Dark',
    description: 'IBM-inspired dark with cyan accents',
    emoji: '🧪',
    dark: true,
    colors: defineColors({
      base00: '#161616',
      base01: '#262626',
      base02: '#393939',
      base03: '#525252',
      base04: '#dde1e6',
      base05: '#f2f4f8',
      base06: '#ffffff',
      base07: '#08bdba',
      base08: '#ff7eb6',
      base09: '#ee5396',
      base0A: '#33b1ff',
      base0B: '#42be65',
      base0C: '#3ddbd9',
      base0D: '#78a9ff',
      base0E: '#be95ff',
      base0F: '#82cfff',
    }),
  },
  {
    id: 'github-dark',
    name: 'GitHub Dark',
    description: 'Neutral dark optimized for UI clarity',
    emoji: '🐙',
    dark: true,
    colors: defineColors({
      base00: '#0d1117',
      base01: '#161b22',
      base02: '#21262d',
      base03: '#30363d',
      base04: '#8b949e',
      base05: '#c9d1d9',
      base06: '#f0f6fc',
      base07: '#ffffff',
      base08: '#ff7b72',
      base09: '#ffa657',
      base0A: '#d29922',
      base0B: '#3fb950',
      base0C: '#39c5cf',
      base0D: '#58a6ff',
      base0E: '#bc8cff',
      base0F: '#db61a2',
    }),
  },
  {
    id: 'everforest-dark',
    name: 'Everforest Dark',
    description: 'Calm nature-inspired dark',
    emoji: '🌲',
    dark: true,
    colors: defineColors({
      base00: '#2b3339',
      base01: '#323c41',
      base02: '#3a454a',
      base03: '#4a555b',
      base04: '#859289',
      base05: '#d3c6aa',
      base06: '#e4e1cd',
      base07: '#fdf6e3',
      base08: '#e67e80',
      base09: '#e69875',
      base0A: '#dbbc7f',
      base0B: '#a7c080',
      base0C: '#83c092',
      base0D: '#7fbbb3',
      base0E: '#d699b6',
      base0F: '#d3c6aa',
    }),
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    description: 'Soft dark with pastel accents',
    emoji: '🌹',
    dark: true,
    colors: defineColors({
      base00: '#191724',
      base01: '#1f1d2e',
      base02: '#26233a',
      base03: '#6e6a86',
      base04: '#908caa',
      base05: '#e0def4',
      base06: '#e0def4',
      base07: '#524f67',
      base08: '#eb6f92',
      base09: '#f6c177',
      base0A: '#f6c177',
      base0B: '#31748f',
      base0C: '#9ccfd8',
      base0D: '#c4a7e7',
      base0E: '#ebbcba',
      base0F: '#56526e',
    }),
  },
] as const;

export const DEFAULT_SCHEME_ID = 'catppuccin-mocha';

const schemeById = new Map(base16Schemes.map((scheme) => [scheme.id, scheme]));
const fallbackColors = schemeById.get(DEFAULT_SCHEME_ID)?.colors ?? base16Schemes[0].colors;

export function getBase16Scheme(id: string): Base16Scheme | undefined {
  return schemeById.get(id);
}

export function getDarkBase16Schemes(): Base16Scheme[] {
  return base16Schemes.filter((scheme) => scheme.dark);
}

export function toAppThemeColors(colors: Base16Colors): Record<string, string> {
  return {
    rosewater: colors.base06,
    flamingo: colors.base08,
    pink: colors.base0E,
    mauve: colors.base0F,
    red: colors.base08,
    maroon: colors.base0F,
    peach: colors.base09,
    yellow: colors.base0A,
    green: colors.base0B,
    teal: colors.base0C,
    sky: colors.base0C,
    sapphire: colors.base0D,
    blue: colors.base0D,
    lavender: colors.base0E,
    text: colors.base05,
    subtext1: colors.base04,
    subtext0: colors.base03,
    overlay2: colors.base04,
    overlay1: colors.base03,
    overlay0: colors.base02,
    surface2: colors.base03,
    surface1: colors.base02,
    surface0: colors.base01,
    base: colors.base00,
    mantle: colors.base01,
    crust: colors.base00,
  };
}

export function applyBase16Colors(colors: Base16Colors): void {
  const root = document.documentElement;
  const appColors = toAppThemeColors(colors);

  for (const [name, value] of Object.entries(appColors)) {
    root.style.setProperty(`--cat-${name}`, value);
  }

  for (const key of BASE16_KEYS) {
    root.style.setProperty(`--theme-${key}`, colors[key]);
  }
}

export function applyBase16Theme(schemeId: string): Base16Scheme {
  const scheme = getBase16Scheme(schemeId) ?? schemeById.get(DEFAULT_SCHEME_ID)!;
  applyBase16Colors(scheme.colors);
  localStorage.setItem('themeSchemeId', scheme.id);
  localStorage.removeItem('catppuccinFlavor');
  return scheme;
}

const legacyFlavorSchemeMap: Record<string, string> = {
  latte: 'catppuccin-latte',
  frappe: 'catppuccin-frappe',
  macchiato: 'catppuccin-macchiato',
  mocha: 'catppuccin-mocha',
};

export function mapLegacyFlavorToSchemeId(flavor: string): string | null {
  return legacyFlavorSchemeMap[flavor] ?? null;
}

export function getStoredSchemeId(): string {
  const saved = localStorage.getItem('themeSchemeId');
  if (saved && schemeById.has(saved)) return saved;

  const legacyFlavor = localStorage.getItem('catppuccinFlavor');
  if (legacyFlavor) {
    const mapped = mapLegacyFlavorToSchemeId(legacyFlavor);
    if (mapped) return mapped;
  }

  return DEFAULT_SCHEME_ID;
}

export function isBase16Colors(value: Record<string, string>): value is Base16Colors {
  return BASE16_KEYS.every((key) => typeof value[key] === 'string');
}

export function legacyThemeColorsToBase16(colors: Record<string, string>): Base16Colors {
  if (isBase16Colors(colors)) return colors;

  return {
    base00: colors.base ?? colors.crust ?? fallbackColors.base00,
    base01: colors.mantle ?? colors.surface0 ?? fallbackColors.base01,
    base02: colors.surface0 ?? colors.surface1 ?? fallbackColors.base02,
    base03: colors.overlay0 ?? colors.surface2 ?? fallbackColors.base03,
    base04: colors.subtext0 ?? colors.overlay1 ?? fallbackColors.base04,
    base05: colors.text ?? colors.subtext1 ?? fallbackColors.base05,
    base06: colors.rosewater ?? colors.text ?? fallbackColors.base06,
    base07: colors.lavender ?? colors.rosewater ?? fallbackColors.base07,
    base08: colors.red ?? colors.maroon ?? fallbackColors.base08,
    base09: colors.peach ?? colors.yellow ?? fallbackColors.base09,
    base0A: colors.yellow ?? colors.peach ?? fallbackColors.base0A,
    base0B: colors.green ?? fallbackColors.base0B,
    base0C: colors.teal ?? colors.sky ?? fallbackColors.base0C,
    base0D: colors.blue ?? colors.sapphire ?? fallbackColors.base0D,
    base0E: colors.mauve ?? colors.pink ?? fallbackColors.base0E,
    base0F: colors.maroon ?? colors.flamingo ?? fallbackColors.base0F,
  };
}
