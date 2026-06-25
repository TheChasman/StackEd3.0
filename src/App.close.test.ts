import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'src/App.svelte'), 'utf8');

describe('dirty quit handling', () => {
  it('intercepts native window close when the active document is dirty', () => {
    expect(source).toContain("import { getCurrentWindow } from '@tauri-apps/api/window';");
    expect(source).toContain("import { message } from '@tauri-apps/plugin-dialog';");
    expect(source).toContain('onCloseRequested');
    expect(source).toContain('event.preventDefault();');
    expect(source).toContain("buttons: { yes: 'Save', no: \"Don't Save\", cancel: 'Cancel' }");
    expect(source).toContain('await handleSave();');
  });
});
