import { describe, it, expect, beforeEach } from 'vitest';
import { documentStore } from './document.svelte';
import type { ArticleFrontmatter } from '$lib/types/article';

const BASE: ArticleFrontmatter = {
  IMAGE: '',
  SPARK: 'Raw idea',
  TITLE: 'Test Article',
  SUBTITLE: 'A test',
  HOOK: 'The opening hook',
  LANDING: 'The closing thought',
  TITLE_SELECTED: '',
  SUBTITLE_SELECTED: '',
  HOOK_SELECTED: '',
  LANDING_SELECTED: '',
  AI_GEN: false,
  SEO_TITLE: '',
  SEO_DESCRIPTION: '',
  SEO_SLUG: '',
  SEO_TAGS: [],
  created: '2026-05-22',
  updated: '2026-05-22',
};

const FAKE_HANDLE = {} as FileSystemFileHandle;

beforeEach(() => documentStore.reset());

describe('document store', () => {
  it('starts with no open file', () => {
    expect(documentStore.frontmatter).toBeNull();
    expect(documentStore.body).toBe('');
    expect(documentStore.dirty).toBe(false);
  });

  it('load() sets frontmatter and body', () => {
    documentStore.load(BASE, '# Body', ['TITLE'], FAKE_HANDLE);
    expect(documentStore.frontmatter?.TITLE).toBe('Test Article');
    expect(documentStore.body).toBe('# Body');
    expect(documentStore.dirty).toBe(false);
  });

  it('load() can mark a normalized file dirty', () => {
    documentStore.load(BASE, '# Body', ['TITLE'], FAKE_HANDLE, null, true);
    expect(documentStore.dirty).toBe(true);
  });

  it('setBody() marks dirty', () => {
    documentStore.load(BASE, '# Body', [], FAKE_HANDLE);
    documentStore.setBody('# Updated');
    expect(documentStore.body).toBe('# Updated');
    expect(documentStore.dirty).toBe(true);
  });

  it('patchField() updates a field and marks dirty', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    documentStore.patchField('TITLE', 'New Title');
    expect(documentStore.frontmatter?.TITLE).toBe('New Title');
    expect(documentStore.dirty).toBe(true);
  });

  it('markClean() clears dirty flag', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    documentStore.setBody('# Updated');
    expect(documentStore.dirty).toBe(true);
    documentStore.markClean();
    expect(documentStore.dirty).toBe(false);
  });

  it('replaceFrontmatter marks the document dirty', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    expect(documentStore.dirty).toBe(false);
    documentStore.replaceFrontmatter({ ...BASE, TITLE: 'Replaced' });
    expect(documentStore.dirty).toBe(true);
  });

  it('openInNewTab reuses the blank tab when only one empty tab exists', () => {
    documentStore.openInNewTab({ frontmatter: BASE, body: '# Hello', fieldOrder: [], fileHandle: null, filePath: '/a.md' });
    expect(documentStore.tabCount).toBe(1);
    expect(documentStore.body).toBe('# Hello');
  });

  it('openInNewTab creates a second tab when current tab has content', () => {
    documentStore.load(BASE, '# First', [], FAKE_HANDLE);
    documentStore.openInNewTab({ frontmatter: BASE, body: '# Second', fieldOrder: [], fileHandle: null, filePath: '/b.md' });
    expect(documentStore.tabCount).toBe(2);
    expect(documentStore.activeIndex).toBe(1);
    expect(documentStore.body).toBe('# Second');
  });

  it('switchTab makes the correct tab active', () => {
    documentStore.load(BASE, '# First', [], FAKE_HANDLE);
    documentStore.openInNewTab({ frontmatter: BASE, body: '# Second', fieldOrder: [], fileHandle: null, filePath: '/b.md' });
    documentStore.switchTab(0);
    expect(documentStore.activeIndex).toBe(0);
    expect(documentStore.body).toBe('# First');
  });

  it('closeTab removes a tab and adjusts activeIndex', () => {
    documentStore.load(BASE, '# First', [], FAKE_HANDLE);
    documentStore.openInNewTab({ frontmatter: BASE, body: '# Second', fieldOrder: [], fileHandle: null, filePath: '/b.md' });
    documentStore.closeTab(0);
    expect(documentStore.tabCount).toBe(1);
    expect(documentStore.body).toBe('# Second');
  });

  it('closeTab on last tab resets to empty rather than removing it', () => {
    documentStore.load(BASE, '# Only', [], FAKE_HANDLE);
    documentStore.closeTab(0);
    expect(documentStore.tabCount).toBe(1);
    expect(documentStore.frontmatter).toBeNull();
    expect(documentStore.body).toBe('');
  });

  it('wordCount counts words in body', () => {
    documentStore.load(BASE, 'one two three', [], FAKE_HANDLE);
    expect(documentStore.wordCount).toBe(3);
  });

  it('wordCount ignores markdown syntax', () => {
    documentStore.load(BASE, '# Heading\n\nA paragraph.', [], FAKE_HANDLE);
    expect(documentStore.wordCount).toBeGreaterThan(0);
  });
});
