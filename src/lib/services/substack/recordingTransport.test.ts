import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { RecordingTransport } from './recordingTransport';
import type { SubstackTransport, SubstackResponse } from './transport';
import { clearBuffer, getBuffer } from '$lib/stores/transportRecorder.svelte';

class StubTransport implements Partial<SubstackTransport> {
  createDraft: Mock = vi.fn();
  updateDraft: Mock = vi.fn();
  publishDraft: Mock = vi.fn();
  scheduleDraft: Mock = vi.fn();
  unscheduleDraft: Mock = vi.fn();
  createNote: Mock = vi.fn();
  listPostTags: Mock = vi.fn();
  createPostTag: Mock = vi.fn();
  attachTag: Mock = vi.fn();
  uploadImage: Mock = vi.fn();
  getDraft: Mock = vi.fn();
  isLoggedIn: Mock = vi.fn().mockResolvedValue(true);
  getUserInfo: Mock = vi.fn();
}

describe('RecordingTransport', () => {
  beforeEach(() => clearBuffer());

  it('delegates createDraft and records a 200 entry with response.body as bodyOut', async () => {
    const stub = new StubTransport();
    const response: SubstackResponse = { ok: true, status: 200, body: { id: 42 } };
    stub.createDraft.mockResolvedValue(response);
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    const result = await recorder.createDraft({ x: 1 });
    expect(result).toEqual(response);
    expect(stub.createDraft).toHaveBeenCalledTimes(1);
    expect(stub.createDraft).toHaveBeenCalledWith({ x: 1 });

    const entries = getBuffer();
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe(200);
    expect(entries[0].bodyOut).toEqual({ id: 42 });
    expect(entries[0].error).toBeNull();
    expect(entries[0].endedAt).not.toBeNull();
  });

  it('records the actual SubstackResponse status (not a hardcoded 200) on non-throwing failures', async () => {
    const stub = new StubTransport();
    // createDraft returns a 401 body without throwing (per spec).
    const response: SubstackResponse = { ok: false, status: 401, body: { error: 'unauthorized' } };
    stub.createDraft.mockResolvedValue(response);
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await recorder.createDraft({ x: 1 });
    const entries = getBuffer();
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe(401);
    expect(entries[0].bodyOut).toEqual({ error: 'unauthorized' });
  });

  it('records an error when the inner throws, then re-throws', async () => {
    const stub = new StubTransport();
    stub.getUserInfo.mockRejectedValue(new Error('boom'));
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await expect(recorder.getUserInfo()).rejects.toThrow('boom');
    const entries = getBuffer();
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe(0);
    expect(entries[0].error).toBe('Error: boom');
  });

  it('delegates updateDraft with the id-interpolated path and forwards both args', async () => {
    const stub = new StubTransport();
    stub.updateDraft.mockResolvedValue({ ok: true, status: 200, body: { id: 7 } });
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await recorder.updateDraft(7, { title: 'hi' });
    expect(stub.updateDraft).toHaveBeenCalledWith(7, { title: 'hi' });
    const entries = getBuffer();
    expect(entries[0].method).toBe('PUT');
    expect(entries[0].path).toBe('/api/v1/drafts/7');
    expect(entries[0].bodyIn).toEqual({ title: 'hi' });
  });

  it('delegates attachTag with postId/tagId-interpolated path', async () => {
    const stub = new StubTransport();
    stub.attachTag.mockResolvedValue({ ok: true, status: 200, body: {} });
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await recorder.attachTag(123, 'tag-abc');
    expect(stub.attachTag).toHaveBeenCalledWith(123, 'tag-abc');
    const entries = getBuffer();
    expect(entries[0].method).toBe('POST');
    expect(entries[0].path).toBe('/api/v1/post/123/tag/tag-abc');
  });

  it('delegates scheduleDraft to the scheduled_release path', async () => {
    const stub = new StubTransport();
    stub.scheduleDraft.mockResolvedValue({ ok: true, status: 200, body: {} });
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await recorder.scheduleDraft(9, { trigger_at: '2026-01-01T00:00:00Z' });
    expect(stub.scheduleDraft).toHaveBeenCalledWith(9, { trigger_at: '2026-01-01T00:00:00Z' });
    const entries = getBuffer();
    expect(entries[0].method).toBe('POST');
    expect(entries[0].path).toBe('/api/v1/drafts/9/scheduled_release');
  });

  it('stores the whole non-SubstackResponse return (e.g. Byline) as bodyOut with status 200', async () => {
    const stub = new StubTransport();
    const byline = { name: 'Ada', byline: 'Writer', profile_url: 'https://x.com/ada' };
    stub.getUserInfo.mockResolvedValue(byline);
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await recorder.getUserInfo();
    const entries = getBuffer();
    expect(entries[0].status).toBe(200);
    expect(entries[0].bodyOut).toEqual(byline);
  });

  it('does not push duplicate entries: one pending becomes one resolved', async () => {
    const stub = new StubTransport();
    stub.createDraft.mockResolvedValue({ ok: true, status: 200, body: { id: 1 } });
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await recorder.createDraft({});
    expect(getBuffer()).toHaveLength(1);
  });

  it('returns a snapshot from getBuffer that is not the internal array', async () => {
    const stub = new StubTransport();
    stub.createDraft.mockResolvedValue({ ok: true, status: 200, body: { id: 1 } });
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await recorder.createDraft({});
    const snap = getBuffer();
    snap.push({ id: 'tampered', startedAt: 0, method: 'X', path: '/', bodyIn: null, status: 0, bodyOut: null, error: null, endedAt: null });
    expect(getBuffer()).toHaveLength(1);
  });

  it('delegates getDraft with id-interpolated path, forwards id, and records in the buffer', async () => {
    const stub = new StubTransport() as unknown as SubstackTransport;
    const response: SubstackResponse = { ok: true, status: 200, body: { id: 42, draft_title: 'X' } };
    stub.getDraft = vi.fn().mockResolvedValue(response);
    const recorder = new RecordingTransport(stub);
    const result = await recorder.getDraft(42);
    expect(result).toEqual(response);
    expect(stub.getDraft).toHaveBeenCalledTimes(1);
    expect(stub.getDraft).toHaveBeenCalledWith(42);
    expect(getBuffer()).toHaveLength(1);
    expect(getBuffer()[0]).toMatchObject({ method: 'GET', path: '/api/v1/drafts/42' });
    expect(getBuffer()[0].bodyIn).toBeUndefined();
  });

  it('records non-throwing SubstackResponse status on a getDraft that returns 404', async () => {
    const stub = new StubTransport() as unknown as SubstackTransport;
    const response: SubstackResponse = { ok: false, status: 404, body: { error: 'not found' } };
    stub.getDraft = vi.fn().mockResolvedValue(response);
    const recorder = new RecordingTransport(stub);
    const result = await recorder.getDraft(404);
    expect(result).toEqual(response);
    expect(getBuffer()).toHaveLength(1);
    expect(getBuffer()[0].status).toBe(404);
  });
});
