import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/lib/components/editor/Editor.svelte'), 'utf8');

describe('editor layout', () => {
  it('shrinks inside the app content slot instead of overflowing over tab rows', () => {
    expect(source).toContain('<div class="flex flex-col flex-1 min-h-0 overflow-hidden">');
    expect(source).not.toContain('<div class="flex flex-col h-full">');
  });
});
