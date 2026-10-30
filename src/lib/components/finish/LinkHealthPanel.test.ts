import { afterEach, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { writable } from 'svelte/store';
import { LinkHealthService, type LinkCheckResult } from '$lib/services/linkHealth';
import type { PMDoc } from '$lib/types/scaffold';
import Harness from './__tests__/LinkHealthPanelHarness.svelte';

let component: ReturnType<typeof mount> | undefined;
let target: HTMLDivElement;
afterEach(async () => {
  if (component) await unmount(component);
  component = undefined;
  target?.remove();
});
function linked(url: string): PMDoc {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Reference', marks: [{ type: 'link', attrs: { href: url } }] },
        ],
      },
    ],
  };
}
function render(body: PMDoc, service: LinkHealthService) {
  target = document.createElement('div');
  document.body.append(target);
  const store = writable(body);
  const onblockedchange = vi.fn();
  component = mount(Harness, { target, props: { body: store, service, onblockedchange } });
  return { store, onblockedchange };
}
it.each(['dead', 'unknown'] as const)('shows %s blockers and retries to green', async (status) => {
  let result: LinkCheckResult = { status, reason: 'Fixture failure' };
  const service = new LinkHealthService(async () => result);
  const { onblockedchange } = render(linked('https://example.com'), service);
  await vi.waitFor(() => expect(target.textContent).toContain('Fixture failure'));
  expect(onblockedchange).toHaveBeenLastCalledWith(true);
  expect(target.textContent).toContain('https://example.com');
  result = { status: 'working', reason: 'HTTP 200' };
  target.querySelector<HTMLButtonElement>('button')!.click();
  await vi.waitFor(() => expect(onblockedchange).toHaveBeenLastCalledWith(false));
  expect(target.textContent).toContain('All links verified');
});
it('blocks while checking and immediately after switching to another linked document', async () => {
  const resolvers: ((result: LinkCheckResult) => void)[] = [];
  const service = new LinkHealthService(() => new Promise((resolve) => resolvers.push(resolve)));
  const { store, onblockedchange } = render(linked('https://first.test'), service);
  await vi.waitFor(() => expect(resolvers).toHaveLength(1));
  expect(onblockedchange).toHaveBeenLastCalledWith(true);
  resolvers[0]({ status: 'working', reason: 'HTTP 200' });
  await vi.waitFor(() => expect(onblockedchange).toHaveBeenLastCalledWith(false));
  store.set(linked('https://second.test'));
  await tick();
  expect(onblockedchange).toHaveBeenLastCalledWith(true);
  expect(target.textContent).toContain('Checking');
});
it('allows a document without links', async () => {
  const { onblockedchange } = render({ type: 'doc', content: [] }, new LinkHealthService());
  await tick();
  expect(onblockedchange).toHaveBeenLastCalledWith(false);
  expect(target.textContent).toContain('No links to check');
});
