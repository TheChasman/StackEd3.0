import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/App.svelte'), 'utf8');

describe('right sidebar layout', () => {
  it('keeps the unified tool tabs visible in a full-height sidebar', () => {
    expect(source).toContain(
      'class="z-20 border-l-2 border-primary-500 bg-dark-900 flex flex-col h-full min-h-0 shrink-0 relative"',
    );
    expect(source).toContain(
      'class="flex overflow-x-auto min-h-10 border-b border-dark-600 bg-dark-800 px-2 pt-2 shrink-0"',
    );
  });

  it('keeps loaded editor content from stealing the app tab rows', () => {
    expect(source).toContain('<div class="flex-1 min-w-0 flex flex-col">');
    expect(source).toContain(
      'class="flex overflow-x-auto min-h-10 border-b border-dark-600 bg-dark-800 px-2 pt-2 shrink-0"',
    );
  });

  it('does not restore or resize below the tab bar minimum width', () => {
    expect(source).toContain('const SIDEBAR_MIN_WIDTH = 320;');
    expect(source).toContain('sidebarWidth = clampSidebarWidth(parseInt(savedWidth, 10));');
    expect(source).toContain('sidebarWidth = clampSidebarWidth(newWidth);');
  });
});
