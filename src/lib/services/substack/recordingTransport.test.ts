import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { RecordingTransport } from './recordingTransport';
import type { SubstackTransport, SubstackResponse, ImageUploadResult } from './transport';

class StubTransport implements Partial<SubstackTransport> {
  createDraft: Mock = vi.fn();
  publishDraft: Mock = vi.fn();
  scheduleDraft: Mock = vi.fn();
  uploadImage: Mock = vi.fn();
  getUserInfo: Mock = vi.fn();
  // ... other methods stubbed as needed
  isLoggedIn: Mock = vi.fn().mockResolvedValue(true);
}

import { recordEntry, clearBuffer } from '$lib/stores/transportRecorder.svelte';

describe('RecordingTransport', () => {
  beforeEach(() => clearBuffer());

  it('delegates createDraft and records a 200 entry', async () => {
    const stub = new StubTransport();
    const response: SubstackResponse = { ok: true, status: 200, body: { id: 42 } };
    stub.createDraft.mockResolvedValue(response);
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    recordEntry({ id: 't1', startedAt: 1, method: 'POST', path: '/api/v1/drafts', bodyIn: { x: 1 }, status: 'pending', bodyOut: null, error: null, endedAt: null });
    const result = await recorder.createDraft({ x: 1 });
    expect(result).toEqual(response);
    expect(stub.createDraft).toHaveBeenCalledTimes(1);
    expect(stub.createDraft).toHaveBeenCalledWith({ x: 1 });
  });

  it('records an error when the inner throws, then re-throws', async () => {
    const stub = new StubTransport();
    stub.getUserInfo.mockRejectedValue(new Error('boom'));
    const recorder = new RecordingTransport(stub as unknown as SubstackTransport);
    await expect(recorder.getUserInfo()).rejects.toThrow('boom');
  });
});
