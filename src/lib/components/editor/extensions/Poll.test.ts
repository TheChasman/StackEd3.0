// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import { Poll } from './Poll';
import { marked } from 'marked';

describe('Poll', () => {
  it('poll duration renders as text from markdown and json', () => {
    const duration = '<b data-x="1">x</b>';
    const html = '<div data-type="poll" duration="<b data-x=&quot;1&quot;>x</b>"></div>';
    for (const content of [
      { type: 'doc', content: [{ type: 'poll', attrs: { duration } }] },
      html,
      marked.parse(html) as string,
    ]) {
      const editor = new Editor({ extensions: [StarterKit, Poll], content });
      try {
        expect(editor.view.dom.textContent).toContain(`Duration: ${duration}`);
        expect(editor.view.dom.querySelector('[data-x]')).toBeNull();
      } finally {
        editor.destroy();
      }
    }
  });
});
