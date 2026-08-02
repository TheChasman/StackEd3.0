import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/services/storage', () => ({
  addRecentFile: vi.fn(async () => {}),
}));

vi.mock('$lib/services/recentMenu', () => ({
  syncRecentFilesMenu: vi.fn(async () => {}),
}));

import { titleFromFilePath } from './files';

describe('files service', () => {
  describe('titleFromFilePath', () => {
    it('removes the scaffold extension from a file name', () => {
      expect(titleFromFilePath('/tmp/Test Article.stacked.json')).toBe('Test Article');
    });

    it('removes the markdown extension from a file name', () => {
      expect(titleFromFilePath('/tmp/Test Article.md')).toBe('Test Article');
    });

    it('handles Windows path separators', () => {
      expect(titleFromFilePath(String.raw`C:\articles\Test Article.STACKED.JSON`)).toBe('Test Article');
    });

    it('preserves names without a recognized extension', () => {
      expect(titleFromFilePath('/tmp/Test Article.txt')).toBe('Test Article.txt');
    });
  });
});
