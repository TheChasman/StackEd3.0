import { describe, it, expect } from 'vitest';
import {
  getFieldPermission,
  isEditable,
  isPadlocked,
  isReadonly,
  getContentFields,
} from './permissions';

describe('permissions service', () => {
  it('returns free access for title', () => {
    expect(getFieldPermission('title').access).toBe('free');
  });

  it('returns padlocked for ai_draft', () => {
    expect(getFieldPermission('ai_draft').access).toBe('padlocked');
  });

  it('returns readonly for guid', () => {
    expect(getFieldPermission('guid').access).toBe('readonly');
  });

  it('marks body as a content_field', () => {
    expect(getFieldPermission('body').content_field).toBe(true);
  });

  it('marks publish_at as not a content_field', () => {
    expect(getFieldPermission('publish_at').content_field).toBe(false);
  });

  it('isEditable: free field is editable when not locked', () => {
    expect(isEditable('title', false)).toBe(true);
  });

  it('isEditable: free content_field is NOT editable when content_locked', () => {
    expect(isEditable('title', true)).toBe(false);
  });

  it('isEditable: free non-content_field is editable even when content_locked', () => {
    expect(isEditable('publish_at', true)).toBe(true);
  });

  it('isEditable: padlocked field is never editable via isEditable', () => {
    expect(isEditable('ai_draft', false)).toBe(false);
  });

  it('isEditable: readonly field is never editable', () => {
    expect(isEditable('guid', false)).toBe(false);
  });

  it('isPadlocked: returns true for ai-owned fields', () => {
    expect(isPadlocked('seo_title')).toBe(true);
  });

  it('isPadlocked: returns false for author-owned fields', () => {
    expect(isPadlocked('title')).toBe(false);
  });

  it('isReadonly: returns true for stackpipe-owned fields', () => {
    expect(isReadonly('guid', false)).toBe(true);
  });

  it('isReadonly: content_locked makes content_field=true fields readonly', () => {
    expect(isReadonly('title', true)).toBe(true);
  });

  it('getContentFields: returns array including body and title', () => {
    const fields = getContentFields();
    expect(fields).toContain('body');
    expect(fields).toContain('title');
    expect(fields).not.toContain('publish_at');
  });
});
