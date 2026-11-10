// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import StarterKit from '@tiptap/starter-kit';
import { markdownToPMDoc } from './scaffoldMigration';

describe('markdownToPMDoc', () => {
  it('markdownToPMDoc sanitises raw html in markdown', () => {
    const doc = markdownToPMDoc('hello\n\n<img src="https://x.test/a.png" onerror="alert(1)">', [
      StarterKit,
    ]);
    const text = JSON.stringify(doc);
    expect(text).not.toContain('onerror');
    expect(text).not.toContain('alert');
  });
});
