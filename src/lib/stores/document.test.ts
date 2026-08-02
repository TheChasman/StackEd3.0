import { describe, it, expect, beforeEach } from 'vitest';
import { documentStore } from './document.svelte';
import { emptyScaffold, isPostPayload, type Scaffold, type PMDoc } from '$lib/types/scaffold';

const newScaffold = (): Scaffold => emptyScaffold();

beforeEach(() => documentStore.reset());

describe('document store', () => {
  it('starts with no scaffold and an empty body', () => {
    expect(documentStore.scaffold).toBeNull();
    expect(documentStore.body).toEqual({ type: 'doc', content: [] });
    expect(documentStore.dirty).toBe(false);
  });

  it('load() sets scaffold and file path', () => {
    const scaffold = newScaffold();
    documentStore.load(scaffold, '/drafts/test.stacked.json');
    expect(documentStore.scaffold).toEqual(scaffold);
    expect(documentStore.filePath).toBe('/drafts/test.stacked.json');
    expect(documentStore.dirty).toBe(false);
  });

  it('setBody() marks dirty', () => {
    documentStore.load(newScaffold());
    const body: PMDoc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Updated' }] }],
    };
    documentStore.setBody(body);
    expect(documentStore.body).toEqual(body);
    expect(documentStore.dirty).toBe(true);
  });

  it('patchPayload() updates a payload field', () => {
    documentStore.load(newScaffold());
    documentStore.patchPayload('draft_title', 'New Title');
    expect(isPostPayload(documentStore.payload!)).toBe(true);
    expect(documentStore.title).toBe('New Title');
    expect(documentStore.dirty).toBe(true);
  });

  it('patchWorkshop() updates a workshop field', () => {
    documentStore.load(newScaffold());
    documentStore.patchWorkshop('spark', 'A new idea');
    expect(documentStore.scaffold?.workshop.spark).toBe('A new idea');
    expect(documentStore.dirty).toBe(true);
  });

  it('markClean() clears dirty and reset() clears the active document', () => {
    documentStore.load(newScaffold());
    documentStore.setBody({ type: 'doc', content: [] });
    documentStore.markClean();
    expect(documentStore.dirty).toBe(false);
    documentStore.reset();
    expect(documentStore.scaffold).toBeNull();
    expect(documentStore.filePath).toBeNull();
    expect(documentStore.body).toEqual({ type: 'doc', content: [] });
  });

  it('openInNewTab reuses the blank tab when only one empty tab exists', () => {
    const scaffold = newScaffold();
    documentStore.openInNewTab(scaffold, '/a.stacked.json');
    expect(documentStore.tabCount).toBe(1);
    expect(documentStore.scaffold).toEqual(scaffold);
    expect(documentStore.filePath).toBe('/a.stacked.json');
  });

  it('openInNewTab creates a second tab when current tab has content', () => {
    const first = newScaffold();
    const second = newScaffold();
    documentStore.load(first, '/a.stacked.json');
    documentStore.openInNewTab(second, '/b.stacked.json');
    expect(documentStore.tabCount).toBe(2);
    expect(documentStore.activeIndex).toBe(1);
    expect(documentStore.scaffold).toEqual(second);
  });

  it('switchTab makes the correct tab active', () => {
    const first = newScaffold();
    const second = newScaffold();
    documentStore.load(first);
    documentStore.openInNewTab(second);
    documentStore.switchTab(0);
    expect(documentStore.activeIndex).toBe(0);
    expect(documentStore.scaffold).toEqual(first);
  });

  it('closeTab removes a tab and adjusts activeIndex', () => {
    const first = newScaffold();
    const second = newScaffold();
    documentStore.load(first);
    documentStore.openInNewTab(second);
    documentStore.closeTab(0);
    expect(documentStore.tabCount).toBe(1);
    expect(documentStore.scaffold).toEqual(second);
  });

  it('closeTab on last tab resets to empty rather than removing it', () => {
    documentStore.load(newScaffold());
    documentStore.closeTab(0);
    expect(documentStore.tabCount).toBe(1);
    expect(documentStore.scaffold).toBeNull();
    expect(documentStore.body).toEqual({ type: 'doc', content: [] });
  });

  it('wordCount counts words from PMDoc', () => {
    const scaffold = newScaffold();
    if (isPostPayload(scaffold.payload)) {
      scaffold.payload.draft_body = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one two three' }] }],
      };
    }
    documentStore.load(scaffold);
    expect(documentStore.wordCount).toBe(3);
  });

  it('title returns draft_title for posts', () => {
    documentStore.load(newScaffold());
    documentStore.patchPayload('draft_title', 'A post title');
    expect(documentStore.title).toBe('A post title');
  });

  it('toggleLocked adds and removes paths', () => {
    documentStore.load(newScaffold());
    documentStore.toggleLocked('payload.draft_title');
    expect(documentStore.scaffold?.locked).toEqual(['payload.draft_title']);
    documentStore.toggleLocked('payload.draft_title');
    expect(documentStore.scaffold?.locked).toEqual([]);
    expect(documentStore.dirty).toBe(true);
  });
});
