import type { SubstackTransport, SubstackResponse, ImageUploadResult } from './transport';
import type { Byline } from '$lib/types/scaffold';
import { recordEntry } from '$lib/stores/transportRecorder.svelte';

let entryCounter = 0;
function newEntryId(): string { return `e_${++entryCounter}`; }

export class RecordingTransport implements SubstackTransport {
  constructor(private readonly inner: SubstackTransport) {}

  private async wrap<T>(method: string, path: string, bodyIn: unknown, call: () => Promise<T>): Promise<T> {
    const id = newEntryId();
    const startedAt = Date.now();
    if (import.meta.env.DEV) {
      recordEntry({ id, startedAt, method, path, bodyIn, status: 'pending', bodyOut: null, error: null, endedAt: null });
    }
    try {
      const bodyOut = await call();
      if (import.meta.env.DEV) {
        recordEntry({ id, startedAt, method, path, bodyIn, status: 200, bodyOut, error: null, endedAt: Date.now() });
      }
      return bodyOut;
    } catch (e) {
      if (import.meta.env.DEV) {
        recordEntry({ id, startedAt, method, path, bodyIn, status: 0, bodyOut: null, error: String(e), endedAt: Date.now() });
      }
      throw e;
    }
  }

  createDraft(body: unknown): Promise<SubstackResponse> {
    return this.wrap('POST', '/api/v1/drafts', body, () => this.inner.createDraft(body));
  }
  updateDraft(id: number, body: unknown): Promise<SubstackResponse> {
    return this.wrap('PUT', `/api/v1/drafts/${id}`, body, () => this.inner.updateDraft(id, body));
  }
  publishDraft(id: number, body: unknown): Promise<SubstackResponse> {
    return this.wrap('PUT', `/api/v1/drafts/${id}/publish`, body, () => this.inner.publishDraft(id, body));
  }
  scheduleDraft(id: number, body: unknown): Promise<SubstackResponse> {
    return this.wrap('POST', `/api/v1/drafts/${id}/scheduled_release`, body, () => this.inner.scheduleDraft(id, body));
  }
  unscheduleDraft(id: number): Promise<SubstackResponse> {
    return this.wrap('DELETE', `/api/v1/drafts/${id}/scheduled_release`, undefined, () => this.inner.unscheduleDraft(id));
  }
  createNote(body: unknown): Promise<SubstackResponse> {
    return this.wrap('POST', '/api/v1/comment/feed', body as { bodyJson: unknown }, () => this.inner.createNote(body));
  }
  listPostTags(): Promise<SubstackResponse> {
    return this.wrap('GET', '/api/v1/publication/post-tag', undefined, () => this.inner.listPostTags());
  }
  createPostTag(name: string): Promise<SubstackResponse> {
    return this.wrap('POST', '/api/v1/publication/post-tag', { name }, () => this.inner.createPostTag(name));
  }
  attachTag(postId: number, tagId: string): Promise<SubstackResponse> {
    return this.wrap('POST', `/api/v1/post/${postId}/tag/${tagId}`, undefined, () => this.inner.attachTag(postId, tagId));
  }
  uploadImage(dataUrl: string): Promise<ImageUploadResult> {
    return this.wrap('POST', '/api/v1/image', { image: dataUrl }, () => this.inner.uploadImage(dataUrl));
  }
  isLoggedIn(): Promise<boolean> {
    return this.wrap('GET', '/api/v1/user/profile/self', undefined, () => this.inner.isLoggedIn());
  }
  getUserInfo(): Promise<Byline> {
    return this.wrap('GET', '/api/v1/user/profile/self', undefined, () => this.inner.getUserInfo());
  }
}
