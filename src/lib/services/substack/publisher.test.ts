import { afterEach, describe, expect, it, vi } from 'vitest';
import * as publisher from './publisher';
import { linkHealth } from '$lib/services/linkHealth';
import { getBody } from '$lib/types/scaffold';
import { emptyScaffold, isPostPayload, type Scaffold, type Byline } from '$lib/types/scaffold';
import type { SubstackTransport, SubstackResponse, ImageUploadResult } from './transport';
import { syncTags } from './publisher';

function postWithTags(tags: string[]): Scaffold {
  const scaffold = emptyScaffold('post');
  if (isPostPayload(scaffold.payload)) scaffold.payload.tags = tags;
  return scaffold;
}

const ok = (body: unknown): SubstackResponse => ({ ok: true, status: 200, body });
const fail = (status: number, body: unknown = {}): SubstackResponse => ({
  ok: false,
  status,
  body,
});

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
  async uploadImage(): Promise<ImageUploadResult> {
    throw new Error('unused');
  }
  async createDraft(): Promise<SubstackResponse> {
    throw new Error('unused');
  }
  async updateDraft(): Promise<SubstackResponse> {
    throw new Error('unused');
  }
  async publishDraft(): Promise<SubstackResponse> {
    throw new Error('unused');
  }
  async scheduleDraft(): Promise<SubstackResponse> {
    throw new Error('unused');
  }
  async unscheduleDraft(): Promise<SubstackResponse> {
    throw new Error('unused');
  }
  async getDraft(): Promise<SubstackResponse> {
    throw new Error('unused');
  }
  async createNote(): Promise<SubstackResponse> {
    throw new Error('unused');
  }
  async isLoggedIn(): Promise<boolean> {
    return true;
  }
  async getUserInfo(): Promise<Byline> {
    throw new Error('unused');
  }
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
    const transport = new StubTransport([{ id: 'uuid-1', name: 'Policing' }], {
      attachFails: true,
    });
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

// Publication gate tests exercise the real orchestrator and record every external call.
class PublicationTransport extends StubTransport {
  calls: string[] = [];
  sentBody: unknown;
  override async getUserInfo(): Promise<Byline> {
    this.calls.push('user');
    return { id: 1, publicationUserId: 1 };
  }
  override async createDraft(body?: unknown): Promise<SubstackResponse> {
    this.calls.push('draft');
    this.sentBody = body;
    return ok({ id: 42 });
  }
  override async publishDraft(): Promise<SubstackResponse> {
    this.calls.push('publish');
    return ok({});
  }
  override async scheduleDraft(): Promise<SubstackResponse> {
    this.calls.push('schedule');
    return ok({});
  }
  override async createNote(body?: unknown): Promise<SubstackResponse> {
    this.calls.push('note');
    this.sentBody = body;
    return ok({ id: 'note-1' });
  }
  override async uploadImage(): Promise<ImageUploadResult> {
    this.calls.push('image');
    throw new Error('No image expected');
  }
}
function linkedScaffold(kind: 'post' | 'note' = 'post') {
  const scaffold = emptyScaffold(kind);
  const body = getBody(scaffold);
  body.content = [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'Reference',
          marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
        },
      ],
    },
  ];
  if (isPostPayload(scaffold.payload)) {
    scaffold.payload.send = true;
    scaffold.payload.tags = [];
  }
  return scaffold;
}
afterEach(() => vi.restoreAllMocks());
describe('all-green publication gate', () => {
  it.each(['dead', 'unknown', 'checking'] as const)(
    'blocks %s links before every transport call',
    async (status) => {
      vi.spyOn(linkHealth, 'check').mockResolvedValue({ status, reason: 'Fixture blocker' });
      const transport = new PublicationTransport();
      await expect(
        publisher.publishToSubstack(linkedScaffold(), transport, async () => ''),
      ).rejects.toThrow('https://example.com');
      expect(transport.calls).toEqual([]);
    },
  );
  it.each(['post', 'note'] as const)('also blocks scheduling and %s publication', async (kind) => {
    vi.spyOn(linkHealth, 'check').mockResolvedValue({ status: 'unknown', reason: 'Offline' });
    const scaffold = linkedScaffold(kind);
    if (isPostPayload(scaffold.payload)) scaffold.payload.trigger_at = '2026-12-01T12:00:00Z';
    const transport = new PublicationTransport();
    await expect(
      publisher.publishToSubstack(scaffold, transport, async () => ''),
    ).rejects.toThrow();
    expect(transport.calls).toEqual([]);
  });
  it('forces a fresh check even when a cached green exists', async () => {
    vi.spyOn(linkHealth, 'get').mockReturnValue({ status: 'working', reason: 'Cached' });
    const probe = vi
      .spyOn(linkHealth, 'check')
      .mockResolvedValue({ status: 'dead', reason: 'HTTP 404' });
    await expect(
      publisher.publishToSubstack(linkedScaffold(), new PublicationTransport(), async () => ''),
    ).rejects.toThrow();
    expect(probe).toHaveBeenCalledWith('https://example.com', { fresh: true });
  });
  it.each(['post', 'note'] as const)('allows green %s publication', async (kind) => {
    vi.spyOn(linkHealth, 'check').mockResolvedValue({ status: 'working', reason: 'HTTP 200' });
    const transport = new PublicationTransport();
    const result = await publisher.publishToSubstack(
      linkedScaffold(kind),
      transport,
      async () => '',
    );
    expect(kind === 'post' ? result.published : Boolean(result.noteId)).toBe(true);
    expect(transport.calls).toContain(kind === 'post' ? 'publish' : 'note');
  });
  it('allows a document without links', async () => {
    const scaffold = linkedScaffold();
    getBody(scaffold).content = [
      { type: 'paragraph', content: [{ type: 'text', text: 'No links' }] },
    ];
    const result = await publisher.publishToSubstack(
      scaffold,
      new PublicationTransport(),
      async () => '',
    );
    expect(result.published).toBe(true);
  });
  it('sends the validated snapshot when the original is edited during validation', async () => {
    let resolve!: (value: { status: 'working'; reason: string }) => void;
    vi.spyOn(linkHealth, 'check').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const scaffold = linkedScaffold();
    const expectedBody = JSON.stringify(getBody(scaffold));
    const transport = new PublicationTransport();
    const pending = publisher.publishToSubstack(scaffold, transport, async () => '');
    await vi.waitFor(() => expect(resolve).toBeDefined());
    getBody(scaffold).content = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Unvalidated edit' }] },
    ];
    resolve({ status: 'working', reason: 'HTTP 200' });
    await pending;
    expect((transport.sentBody as { draft_body: string }).draft_body).toBe(expectedBody);
  });
  it('exposes no unguarded publication helper', () => {
    for (const name of ['createDraft', 'scheduleDraft', 'publishDraft', 'createNote'])
      expect(name in publisher).toBe(false);
  });
});

it('blocks an embedded publication link before any Substack operation', async () => {
  vi.spyOn(linkHealth, 'check').mockResolvedValue({ status: 'dead', reason: 'HTTP 404' });
  const scaffold = linkedScaffold();
  getBody(scaffold).content = [
    { type: 'embeddedPublication', attrs: { url: 'https://publication.test' } },
  ];
  const transport = new PublicationTransport();
  await expect(publisher.publishToSubstack(scaffold, transport, async () => '')).rejects.toThrow(
    'https://publication.test',
  );
  expect(transport.calls).toEqual([]);
});

it('blocks imported fragment targets which the document schema cannot render', async () => {
  const scaffold = linkedScaffold();
  getBody(scaffold).content = [
    { type: 'paragraph', attrs: { id: 'target' }, content: [{ type: 'text', text: 'Target' }] },
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Jump', marks: [{ type: 'link', attrs: { href: '#target' } }] },
      ],
    },
  ];
  const transport = new PublicationTransport();
  await expect(publisher.publishToSubstack(scaffold, transport, async () => '')).rejects.toThrow(
    '#target',
  );
  expect(transport.calls).toEqual([]);
});
