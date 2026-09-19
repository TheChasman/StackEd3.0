import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/App.svelte'), 'utf8');

describe('app shell', () => {
  it('renders exactly one space at a time via the view store', () => {
    expect(source).toContain("viewStore.current === 'library'");
    expect(source).toContain("viewStore.current === 'write'");
    expect(source).toContain("viewStore.current === 'plan'");
    expect(source).toContain("viewStore.current === 'finish'");
    expect(source).toContain('FinishView');
  });

  it('has no permanent sidebar or theme switcher chrome', () => {
    expect(source).not.toContain('ScaffoldPanel');
    expect(source).not.toContain('ThemeSwitcher');
    expect(source).not.toContain('ThemeBrowser');
    expect(source).not.toContain('SIDEBAR_MIN_WIDTH');
    expect(source).not.toContain('sidebarWidth');
  });

  it('debounces autosave to path-backed documents only', () => {
    expect(source).toContain('const AUTOSAVE_DEBOUNCE_MS = 4000;');
    expect(source).toContain('if (dirty && filePath) {');
    expect(source).toContain('saveScaffoldPath(documentStore.filePath, documentStore.scaffold)');
  });
});
