import { describe, it, expect, beforeEach } from 'vitest';
import { documentStore } from './document.svelte';
import type { ArticleFrontmatter } from '$lib/types/article';

const BASE: ArticleFrontmatter = {
  SPARK: 'Raw idea',
  TITLE: 'Test Article',
  SUBTITLE: 'A test',
  HOOK: 'The opening hook',
  LANDING: 'The closing thought',
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

  it('wordCount counts words in body', () => {
    documentStore.load(BASE, 'one two three', [], FAKE_HANDLE);
    expect(documentStore.wordCount).toBe(3);
  });

  it('wordCount ignores markdown syntax', () => {
    documentStore.load(BASE, '# Heading\n\nA paragraph.', [], FAKE_HANDLE);
    expect(documentStore.wordCount).toBeGreaterThan(0);
  });
});
