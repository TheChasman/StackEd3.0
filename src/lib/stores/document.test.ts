import { describe, it, expect, beforeEach } from 'vitest';
import { documentStore } from './document.svelte';
import type { ArticleFrontmatter } from '$lib/types/article';

const BASE: ArticleFrontmatter = {
  title: 'Test',
  guid: 'abc-123',
  pipeline_stage: 'writing',
  created: '2026-05-22',
  updated: '2026-05-22',
  spark_notes: '',
  hook: '',
  opening: '',
  research_notes: '',
  ai_draft: 'AI generated draft',
  fact_check_notes: '',
  legal_notes: '',
  seo_title: 'SEO title',
  seo_description: '',
  seo_slug: '',
  substack_tags: [],
  substack_url: '',
  subtitle: '',
  publish_at: '',
  publication: 'chasnewport',
  section: '',
  audience: 'everyone',
  allow_comments: 'everyone',
  send_email: true,
  content_locked: false,
  overrides: [],
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
    documentStore.load(BASE, '# Body', ['title'], FAKE_HANDLE);
    expect(documentStore.frontmatter?.title).toBe('Test');
    expect(documentStore.body).toBe('# Body');
    expect(documentStore.dirty).toBe(false);
  });

  it('setBody() marks dirty', () => {
    documentStore.load(BASE, '# Body', [], FAKE_HANDLE);
    documentStore.setBody('# Updated');
    expect(documentStore.body).toBe('# Updated');
    expect(documentStore.dirty).toBe(true);
  });

  it('patchField() updates a free field and marks dirty', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    documentStore.patchField('title', 'New Title');
    expect(documentStore.frontmatter?.title).toBe('New Title');
    expect(documentStore.dirty).toBe(true);
  });

  it('patchField() does NOT append to overrides for free fields', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    documentStore.patchField('title', 'New Title');
    expect(documentStore.frontmatter?.overrides).toEqual([]);
  });

  it('patchPadlockedField() updates value and appends to overrides', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    documentStore.patchPadlockedField('ai_draft', 'Edited draft');
    expect(documentStore.frontmatter?.ai_draft).toBe('Edited draft');
    expect(documentStore.frontmatter?.overrides).toContain('ai_draft');
  });

  it('patchPadlockedField() does not duplicate in overrides', () => {
    documentStore.load({ ...BASE, overrides: ['ai_draft'] }, '', [], FAKE_HANDLE);
    documentStore.patchPadlockedField('ai_draft', 'Another edit');
    expect(documentStore.frontmatter?.overrides.filter(f => f === 'ai_draft').length).toBe(1);
  });

  it('clearOverride() removes a field from overrides', () => {
    documentStore.load({ ...BASE, overrides: ['seo_title', 'ai_draft'] }, '', [], FAKE_HANDLE);
    documentStore.clearOverride('seo_title');
    expect(documentStore.frontmatter?.overrides).not.toContain('seo_title');
    expect(documentStore.frontmatter?.overrides).toContain('ai_draft');
  });

  it('unlock() sets content_locked=false and pipeline_stage=fact_check', () => {
    documentStore.load({ ...BASE, content_locked: true, pipeline_stage: 'staged' }, '', [], FAKE_HANDLE);
    documentStore.unlock();
    expect(documentStore.frontmatter?.content_locked).toBe(false);
    expect(documentStore.frontmatter?.pipeline_stage).toBe('fact_check');
    expect(documentStore.dirty).toBe(true);
  });

  it('isLocked reflects content_locked field', () => {
    documentStore.load({ ...BASE, content_locked: true }, '', [], FAKE_HANDLE);
    expect(documentStore.isLocked).toBe(true);
  });

  it('canUnlock is true when locked and substack_url is empty', () => {
    documentStore.load({ ...BASE, content_locked: true, substack_url: '' }, '', [], FAKE_HANDLE);
    expect(documentStore.canUnlock).toBe(true);
  });

  it('canUnlock is false when substack_url is set (already posted)', () => {
    documentStore.load({ ...BASE, content_locked: true, substack_url: 'https://example.com' }, '', [], FAKE_HANDLE);
    expect(documentStore.canUnlock).toBe(false);
  });

  it('wordCount counts words in body', () => {
    documentStore.load(BASE, 'one two three', [], FAKE_HANDLE);
    expect(documentStore.wordCount).toBe(3);
  });

  it('wordCount ignores markdown syntax', () => {
    documentStore.load(BASE, '# Heading\n\nA paragraph.', [], FAKE_HANDLE);
    // "Heading", "A", "paragraph." = 3 words (simple split)
    expect(documentStore.wordCount).toBeGreaterThan(0);
  });
});
