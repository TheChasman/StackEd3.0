import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { documentStore } from '$lib/stores/document.svelte';
import { emptyScaffold, isPostPayload } from '$lib/types/scaffold';
import FinishView from './FinishView.svelte';

vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({
    get: vi.fn(async () => undefined),
    put: vi.fn(async () => undefined),
    getAll: vi.fn(async () => []),
  })),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async () => ({ status: 'unknown', reason: 'Fixture blocked' })),
}));
let component: ReturnType<typeof mount>;
let target: HTMLDivElement;
afterEach(async () => {
  await unmount(component);
  target.remove();
  documentStore.reset();
});
it('does not report ready to publish when link verification blocks the action', async () => {
  const scaffold = emptyScaffold('post');
  if (isPostPayload(scaffold.payload))
    Object.assign(scaffold.payload, {
      draft_title: 'Title',
      draft_subtitle: 'Subtitle',
      search_engine_title: 'Search',
      search_engine_description: 'Description',
      slug: 'slug',
      tags: ['Test'],
      draft_bylines: [{ id: 1, publicationUserId: 1 }],
      send: true,
      draft_body: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Reference',
                marks: [{ type: 'link', attrs: { href: 'https://finish-block.test' } }],
              },
            ],
          },
        ],
      },
    });
  documentStore.replaceScaffold(scaffold);
  target = document.createElement('div');
  document.body.append(target);
  component = mount(FinishView, { target });
  await vi.waitFor(() => expect(target.textContent).toContain('Fixture blocked'));
  const publish = [...target.querySelectorAll('button')].find((button) =>
    button.textContent?.includes('Publish now'),
  );
  expect(publish?.disabled).toBe(true);
  expect(target.querySelector('section')!.textContent).not.toContain('Ready to publish.');
  expect(target.querySelector('section')!.textContent).toContain('Link verification required');
});
