import { afterEach, expect, it, vi } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { LinkHealth } from './LinkHealth';
import { Image2 } from './Image2';
import { ShareButton } from './ShareButton';
import { LinkHealthService, type LinkCheckResult } from '$lib/services/linkHealth';
import { generateMarkdownMirror } from '$lib/utils/scaffold';
import { emptyScaffold, isPostPayload } from '$lib/types/scaffold';

let editor: Editor | undefined;
afterEach(() => {
  editor?.destroy();
  editor = undefined;
});
function create(
  service: LinkHealthService,
  content = '<p><a href="https://example.com">Words</a></p>',
) {
  editor = new Editor({
    extensions: [StarterKit, Image2, ShareButton, LinkHealth.configure({ service })],
    content,
  });
  return editor;
}
it('decorates links by status without changing JSON, HTML or Markdown', async () => {
  let resolve!: (value: LinkCheckResult) => void;
  const service = new LinkHealthService(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const instance = create(service);
  const beforeJSON = instance.getJSON();
  const beforeHTML = instance.getHTML();
  const scaffold = emptyScaffold('post');
  if (isPostPayload(scaffold.payload))
    scaffold.payload.draft_body = beforeJSON as typeof scaffold.payload.draft_body;
  const beforeMD = generateMarkdownMirror(scaffold, [StarterKit]);
  await vi.waitFor(() => expect(resolve).toBeDefined());
  expect(instance.view.dom.querySelector('.link-health-checking')).not.toBeNull();
  resolve({ status: 'working', reason: 'HTTP 200' });
  await vi.waitFor(() =>
    expect(instance.view.dom.querySelector('.link-health-working')).not.toBeNull(),
  );
  expect(instance.getJSON()).toEqual(beforeJSON);
  expect(instance.getHTML()).toBe(beforeHTML);
  expect(generateMarkdownMirror(scaffold, [StarterKit])).toBe(beforeMD);
});
it.each(['dead', 'unknown'] as const)(
  'shows %s reasons in text and atom-node DOM',
  async (status) => {
    const service = new LinkHealthService(async () => ({ status, reason: 'Fixture reason' }));
    const instance = create(service, '<p><a href="https://example.com">Text</a></p>');
    instance.commands.insertContent([
      { type: 'image2', attrs: { src: 'https://example.com/a.png', href: 'https://image.test' } },
      {
        type: 'shareButton',
        attrs: { variant: 'custom', url: 'https://button.test', label: 'Custom' },
      },
    ]);
    await vi.waitFor(() =>
      expect(
        instance.view.dom.querySelectorAll(`.link-health-${status}`).length,
      ).toBeGreaterThanOrEqual(3),
    );
    expect(
      instance.view.dom.querySelector(`.link-health-${status}`)?.getAttribute('title'),
    ).toContain('Fixture reason');
    expect(instance.view.dom.querySelector(`.link-health-${status} a`)).not.toBeNull();
  },
);
it('rechecks edited and pasted links without reusing the old destination status', async () => {
  const service = new LinkHealthService(async (url) => ({
    status: url.includes('new') ? 'dead' : 'working',
    reason: url,
  }));
  const instance = create(service);
  await vi.waitFor(() =>
    expect(instance.view.dom.querySelector('.link-health-working')).not.toBeNull(),
  );
  instance.commands.setTextSelection({ from: 1, to: 6 });
  instance.commands.setLink({ href: 'https://new.test' });
  await vi.waitFor(() =>
    expect(instance.view.dom.querySelector('.link-health-dead')).not.toBeNull(),
  );
  expect(instance.view.dom.querySelector('.link-health-working')).toBeNull();
  instance.commands.setContent('<p><a href="https://pasted.test">Pasted</a></p>');
  await vi.waitFor(() =>
    expect(instance.view.dom.querySelector('.link-health-working')).not.toBeNull(),
  );
});
it('ignores late responses after replacing the document and after destruction', async () => {
  const resolvers: ((result: LinkCheckResult) => void)[] = [];
  const service = new LinkHealthService(() => new Promise((resolve) => resolvers.push(resolve)));
  const instance = create(service);
  await vi.waitFor(() => expect(resolvers).toHaveLength(1));
  instance.commands.setContent('<p>Different document</p>');
  resolvers[0]({ status: 'working', reason: 'Old document' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(instance.view.dom.querySelector('[class*="link-health-"]')).toBeNull();
  instance.destroy();
  editor = undefined;
});
