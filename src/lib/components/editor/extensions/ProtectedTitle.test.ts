import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ProtectedTitle } from './ProtectedTitle';

function createEditor(content = ''): Editor {
  const element = document.createElement('div');
  return new Editor({
    element,
    extensions: [StarterKit, ProtectedTitle],
    content,
  });
}

function firstNodeInfo(editor: Editor): { type: string; level?: number; text: string } {
  const node = editor.state.doc.firstChild;
  if (!node) return { type: 'none', text: '' };
  return { type: node.type.name, level: node.attrs.level, text: node.textContent };
}

describe('ProtectedTitle', () => {
  it('converts a non-heading first paragraph into an H1 on load', () => {
    const editor = createEditor('<p>Not a title yet</p>');
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    expect(info.text).toBe('Not a title yet');
    editor.destroy();
  });

  it('inserts an empty H1 when the document is empty', () => {
    const editor = createEditor('');
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    editor.destroy();
  });

  it('restores the H1 after select-all + delete', () => {
    const editor = createEditor('<h1>My Title</h1><p>Body paragraph.</p>');
    editor.chain().focus().selectAll().deleteSelection().run();
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    editor.destroy();
  });

  it('keeps the first node as H1 after a Backspace-merge from line 2', () => {
    const editor = createEditor('<h1>Title</h1><p>Second line</p>');
    // Place the cursor at the very start of the second block, then merge it backward.
    const secondBlockStart = editor.state.doc.firstChild!.nodeSize + 1;
    editor.chain().focus().setTextSelection(secondBlockStart).run();
    editor.commands.keyboardShortcut('Backspace');
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    expect(info.text).toBe('TitleSecond line');
    editor.destroy();
  });

  it('reverts an attempt to change line 1 to H2', () => {
    const editor = createEditor('<h1>Title</h1><p>Body</p>');
    editor.chain().focus().setTextSelection(1).setNode('heading', { level: 2 }).run();
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    editor.destroy();
  });

  it('splits Enter inside the title into a new paragraph below', () => {
    const editor = createEditor('<h1>Title text</h1>');
    // Cursor between "Title " and "text" (position 7 inside the heading).
    editor.chain().focus().setTextSelection(7).run();
    editor.commands.keyboardShortcut('Enter');
    const doc = editor.state.doc;
    expect(doc.firstChild?.type.name).toBe('heading');
    expect(doc.firstChild?.attrs.level).toBe(1);
    expect(doc.firstChild?.textContent).toBe('Title ');
    const secondNode = doc.maybeChild(1);
    expect(secondNode?.type.name).toBe('paragraph');
    expect(secondNode?.textContent).toBe('text');
    editor.destroy();
  });
});
