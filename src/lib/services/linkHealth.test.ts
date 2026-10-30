import { describe, expect, it, vi } from 'vitest';
import { collectLinks, checkFragment, LinkHealthService } from './linkHealth';
import type { PMDoc } from '$lib/types/scaffold';

const working = { status: 'working' as const, reason: 'HTTP 200' };
const body: PMDoc = {
  type: 'doc',
  content: [
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          attrs: { id: 'target' },
          content: [
            {
              type: 'text',
              text: 'A',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
            {
              type: 'text',
              text: 'B',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
      ],
    },
    { type: 'image2', attrs: { src: 'https://image.test/a.png', href: 'https://image-link.test' } },
    { type: 'shareButton', attrs: { variant: 'custom', url: 'https://button.test' } },
    { type: 'shareButton', attrs: { variant: 'share-post', url: 'https://ignored.test' } },
  ],
};

it('collects nested authored destinations once without probing media or generated actions', () => {
  expect(collectLinks(body)).toEqual([
    'https://example.com',
    'https://image-link.test',
    'https://button.test',
  ]);
});
it('keeps unsupported fragment targets unverified in every document', () => {
  expect(checkFragment('#target', body).status).toBe('unknown');
  expect(checkFragment('#target', { type: 'doc', content: [] }).status).toBe('unknown');
  expect(checkFragment('#%broken', body).status).toBe('dead');
});

describe('LinkHealthService', () => {
  it('deduplicates concurrent checks, caches results and refreshes expired results', async () => {
    let now = 0;
    const probe = vi.fn(async () => working);
    const service = new LinkHealthService(probe, () => now);
    const first = service.check('https://example.com');
    expect(service.get('https://example.com')?.status).toBe('checking');
    await Promise.all([first, service.check('https://example.com')]);
    expect(probe).toHaveBeenCalledTimes(1);
    await service.check('https://example.com');
    expect(probe).toHaveBeenCalledTimes(1);
    now = 300001;
    expect(service.get('https://example.com')).toBeUndefined();
    await service.check('https://example.com');
    expect(probe).toHaveBeenCalledTimes(2);
  });
  it('limits concurrent probes to four and continues queued checks', async () => {
    const releases: (() => void)[] = [];
    let active = 0;
    let maximum = 0;
    const service = new LinkHealthService(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return working;
    });
    const jobs = Array.from({ length: 9 }, (_, i) => service.check(`https://example.com/${i}`));
    await vi.waitFor(() => expect(releases).toHaveLength(4));
    while (releases.length) {
      releases.splice(0).forEach((resolve) => resolve());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await Promise.all(jobs);
    expect(maximum).toBe(4);
  });
  it('ignores old responses after a forced refresh', async () => {
    const resolvers: ((result: typeof working) => void)[] = [];
    const service = new LinkHealthService(() => new Promise((resolve) => resolvers.push(resolve)));
    const old = service.check('https://example.com');
    const fresh = service.check('https://example.com', { fresh: true });
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    resolvers[1](working);
    await fresh;
    resolvers[0]({ ...working, reason: 'old' });
    await old;
    expect(service.get('https://example.com')).toEqual(working);
  });
  it('turns network rejection into unknown and notifies subscribers', async () => {
    const service = new LinkHealthService(async () => {
      throw new Error('Offline');
    });
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);
    expect((await service.check('https://example.com')).status).toBe('unknown');
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    await service.check('https://other.test');
    expect(listener).not.toHaveBeenCalled();
  });
  it('does not dispatch unsupported or unsafe schemes to the backend', async () => {
    const probe = vi.fn(async () => working);
    const service = new LinkHealthService(probe);
    expect((await service.check('javascript:alert(1)')).status).toBe('dead');
    expect((await service.check('mailto:hello@example.com')).status).toBe('unknown');
    expect((await service.check('https://user:secret@example.com')).status).toBe('unknown');
    expect(probe).not.toHaveBeenCalled();
  });
});

it('collects embedded publication destinations including empty URLs as blockers', () => {
  expect(
    collectLinks({
      type: 'doc',
      content: [
        { type: 'embeddedPublication', attrs: { url: 'https://publication.test' } },
        { type: 'embeddedPublication', attrs: { url: '' } },
      ],
    }),
  ).toEqual(['https://publication.test', '']);
});
