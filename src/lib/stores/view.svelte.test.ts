import { describe, it, expect, beforeEach } from 'vitest';
import { viewStore } from './view.svelte';
import { documentStore } from './document.svelte';
import { emptyScaffold } from '$lib/types/scaffold';

beforeEach(() => {
  viewStore.reset();
  documentStore.reset();
});

describe('view store', () => {
  it('starts in the library', () => {
    expect(viewStore.current).toBe('library');
  });

  it('openDocument switches to write', () => {
    viewStore.openDocument();
    expect(viewStore.current).toBe('write');
  });

  it('goLibrary returns to the library', () => {
    viewStore.openDocument();
    viewStore.goLibrary();
    expect(viewStore.current).toBe('library');
  });

  it('plan and finish require an open document', () => {
    viewStore.showPlan();
    expect(viewStore.current).toBe('library');
    viewStore.showFinish();
    expect(viewStore.current).toBe('library');
  });

  it('plan and finish open once a document is loaded', () => {
    documentStore.load(emptyScaffold());
    viewStore.openDocument();
    viewStore.showPlan();
    expect(viewStore.current).toBe('plan');
    viewStore.showFinish();
    expect(viewStore.current).toBe('finish');
    viewStore.backToWrite();
    expect(viewStore.current).toBe('write');
  });

  it('backToWrite falls back to the library when no document is open', () => {
    viewStore.openDocument();
    documentStore.reset();
    viewStore.backToWrite();
    expect(viewStore.current).toBe('library');
  });
});
