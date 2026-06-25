import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/lib/components/RecentFiles.svelte'), 'utf8');

describe('RecentFiles', () => {
  it('opens recent files through the tab-aware document path', () => {
    expect(source).toContain('documentStore.openInNewTab(parsed);');
    expect(source).not.toContain('documentStore.load(parsed.frontmatter');
  });
});
