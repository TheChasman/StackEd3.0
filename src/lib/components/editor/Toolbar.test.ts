import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, unmount, tick } from 'svelte';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Toolbar from './Toolbar.svelte';

let editor: Editor;
let toolbar: ReturnType<typeof mount>;
let target: HTMLDivElement;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  target = document.createElement('div');
  document.body.append(target);
  editor = new Editor({ extensions: [StarterKit], content: '<p>Selected words remain here</p>' });
  editor.commands.setTextSelection({ from: 1, to: 15 });
  toolbar = mount(Toolbar, { target, props: { editor } });
  vi.spyOn(window, 'prompt').mockReturnValue(null);
});

afterEach(async () => {
  await unmount(toolbar);
  editor.destroy();
  target.remove();
  vi.restoreAllMocks();
});

async function openLink() {
  target.querySelector<HTMLButtonElement>('button[title="Link"]')!.click();
  await tick();
  const input = target.querySelector<HTMLInputElement>('input[aria-label="URL"]');
  expect(input, 'Link opens an in-app URL field without a browser prompt').not.toBeNull();
  expect(target.querySelector<HTMLDialogElement>('dialog')!.open).toBe(true);
  expect(document.activeElement).toBe(input);
  return input!;
}

async function submit() {
  target
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await tick();
}

describe('Link toolbar', () => {
  it('opens a URL dialog and applies the URL to the original selection', async () => {
    const input = await openLink();
    editor.commands.setTextSelection(20);
    input.value = 'https://example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await submit();
    expect(editor.getHTML()).toContain('href="https://example.com"');
    expect(editor.getHTML()).toMatch(/<a[^>]*>Selected words<\/a> remain here/);
    expect(target.querySelector<HTMLDialogElement>('dialog')!.open).toBe(false);
  });

  it('pre-fills an existing link and removes it when the URL is cleared', async () => {
    editor.commands.setLink({ href: 'https://example.com' });
    const input = await openLink();
    expect(input.value).toBe('https://example.com');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await submit();
    expect(editor.getHTML()).toBe('<p>Selected words remain here</p>');
  });

  it('dismisses with Escape without changing the document', async () => {
    const original = editor.getJSON();
    await openLink();
    target.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    await tick();
    expect(editor.getJSON()).toEqual(original);
    expect(target.querySelector<HTMLDialogElement>('dialog')!.open).toBe(false);
  });

  it('cancels without changing the document', async () => {
    const original = editor.getJSON();
    await openLink();
    target.querySelector<HTMLButtonElement>('button[title="Cancel link"]')!.click();
    await tick();
    expect(editor.getJSON()).toEqual(original);
    expect(target.querySelector<HTMLDialogElement>('dialog')!.open).toBe(false);
  });
});
