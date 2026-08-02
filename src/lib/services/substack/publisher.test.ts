import { describe, expect, it } from 'vitest';
import { emptyScaffold, isPostPayload, type Scaffold, type Byline } from '$lib/types/scaffold';
import type { SubstackTransport, SubstackResponse, ImageUploadResult } from './transport';
import { syncTags } from './publisher';

function postWithTags(tags: string[]): Scaffold {
  const scaffold = emptyScaffold('post');
  if (isPostPayload(scaffold.payload)) scaffold.payload.tags = tags;
  return scaffold;
}

const ok = (body: unknown): SubstackResponse => ({ ok: true, status: 200, body });
const fail = (status: number, body: unknown = {}): SubstackResponse => ({ ok: false, status, body });

/** A transport stub that records calls and returns scripted responses. */
class StubTransport implements SubstackTransport {
  created: string[] = [];
  attached: { postId: number; tagId: string }[] = [];

  constructor(
    private existing: { id: string; name: string }[] = [],
    private opts: { listFails?: boolean; createFails?: boolean; attachFails?: boolean } = {},
  ) {}

  async listPostTags(): Promise<SubstackResponse> {
    return this.opts.listFails ? fail(500) : ok(this.existing);
  }
  async createPostTag(name: string): Promise<SubstackResponse> {
    if (this.opts.createFails) return fail(400);
    this.created.push(name);
    return ok({ id: `uuid-${name}`, name });
  }
  async attachTag(postId: number, tagId: string): Promise<SubstackResponse> {
    if (this.opts.attachFails) return fail(404);
    this.attached.push({ postId, tagId });
    return ok({});
  }

  // Unused by syncTags.
  async uploadImage(): Promise<ImageUploadResult> { throw new Error('unused'); }
  async createDraft(): Promise<SubstackResponse> { throw new Error('unused'); }
  async updateDraft(): Promise<SubstackResponse> { throw new Error('unused'); }
  async publishDraft(): Promise<SubstackResponse> { throw new Error('unused'); }
  async scheduleDraft(): Promise<SubstackResponse> { throw new Error('unused'); }
  async unscheduleDraft(): Promise<SubstackResponse> { throw new Error('unused'); }
  async createNote(): Promise<SubstackResponse> { throw new Error('unused'); }
  async isLoggedIn(): Promise<boolean> { return true; }
  async getUserInfo(): Promise<Byline> { throw new Error('unused'); }
}

describe('syncTags', () => {
  it('reuses an existing tag by case-insensitive name, without creating it', async () => {
    const transport = new StubTransport([{ id: 'uuid-1', name: 'Policing' }]);
    const result = await syncTags(42, postWithTags(['policing']), transport);

    expect(transport.created).toEqual([]);
    expect(transport.attached).toEqual([{ postId: 42, tagId: 'uuid-1' }]);
    expect(result.warnings).toEqual([]);
    expect(result.publicationTags).toEqual(['Policing']);
  });

  it('creates a missing tag then attaches it', async () => {
    const transport = new StubTransport([]);
    const result = await syncTags(42, postWithTags(['Justice']), transport);

    expect(transport.created).toEqual(['Justice']);
    expect(transport.attached).toEqual([{ postId: 42, tagId: 'uuid-Justice' }]);
    expect(result.warnings).toEqual([]);
  });

  it('warns but does not throw when attach fails', async () => {
    const transport = new StubTransport([{ id: 'uuid-1', name: 'Policing' }], { attachFails: true });
    const result = await syncTags(42, postWithTags(['Policing']), transport);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('Policing');
  });

  it('warns and stops when the tag list cannot be fetched', async () => {
    const transport = new StubTransport([], { listFails: true });
    const result = await syncTags(42, postWithTags(['Policing']), transport);

    expect(result.warnings).toHaveLength(1);
    expect(transport.created).toEqual([]);
    expect(transport.attached).toEqual([]);
  });

  it('is a no-op when there are no tags', async () => {
    const transport = new StubTransport([{ id: 'uuid-1', name: 'Policing' }]);
    const result = await syncTags(42, postWithTags([]), transport);

    expect(result).toEqual({ warnings: [], publicationTags: [] });
    expect(transport.attached).toEqual([]);
  });
});
