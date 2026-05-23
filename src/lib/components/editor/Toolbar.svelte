<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import StyleDropdown from './toolbar/StyleDropdown.svelte';
  import ButtonDropdown from './toolbar/ButtonDropdown.svelte';
  import MoreDropdown from './toolbar/MoreDropdown.svelte';

  let { editor }: { editor: Editor | null } = $props();

  function run(fn: () => void) {
    if (!editor) return;
    fn();
    editor.view.focus();
  }

  let fileInput: HTMLInputElement;

  function toggleBold() { run(() => editor!.chain().toggleBold().run()); }
  function toggleItalic() { run(() => editor!.chain().toggleItalic().run()); }
  function toggleStrike() { run(() => editor!.chain().toggleStrike().run()); }
  function toggleCode() { run(() => editor!.chain().toggleCode().run()); }
  function toggleBlockquote() { run(() => editor!.chain().toggleBlockquote().run()); }
  function toggleBulletList() { run(() => editor!.chain().toggleBulletList().run()); }
  function toggleOrderedList() { run(() => editor!.chain().toggleOrderedList().run()); }
  function toggleTaskList() { run(() => editor!.chain().toggleTaskList().run()); }
  function undo() { run(() => editor!.chain().undo().run()); }
  function redo() { run(() => editor!.chain().redo().run()); }

  function addLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }

  function addImage() {
    if (!editor) return;
    fileInput?.click();
  }

  function handleImageUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file && editor) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result && editor) {
          editor.chain().focus().setImage({ src: e.target.result as string }).run();
        }
      };
      reader.readAsDataURL(file);
    }
    target.value = '';
  }
</script>

<input
  type="file"
  accept="image/*"
  class="hidden"
  bind:this={fileInput}
  onchange={handleImageUpload}
/>

{#if editor}
<div class="flex items-center gap-1 p-2 border-b border-dark-700 bg-dark-800 relative z-20 flex-wrap">
  <!-- Undo / Redo -->
  <button
    onclick={undo}
    class="p-1.5 rounded hover:bg-dark-600 text-dark-200 disabled:opacity-50"
    disabled={!editor.can().undo()}
    title="Undo"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
    </svg>
  </button>
  <button
    onclick={redo}
    class="p-1.5 rounded hover:bg-dark-600 text-dark-200 disabled:opacity-50"
    disabled={!editor.can().redo()}
    title="Redo"
  >
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
    </svg>
  </button>

  <div class="w-px h-4 bg-dark-600 mx-1"></div>

  <!-- Style dropdown (Heading 1-6 / Normal text) -->
  <StyleDropdown {editor} />

  <div class="w-px h-4 bg-dark-600 mx-1"></div>

  <!-- Bold / Italic / Strikethrough -->
  <button onclick={toggleBold} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('bold') ? 'bg-dark-600 text-primary-500' : ''}" title="Bold">
    <span class="font-bold">B</span>
  </button>
  <button onclick={toggleItalic} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('italic') ? 'bg-dark-600 text-primary-500' : ''}" title="Italic">
    <span class="italic">I</span>
  </button>
  <button onclick={toggleStrike} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('strike') ? 'bg-dark-600 text-primary-500' : ''}" title="Strikethrough">
    <span class="line-through">S</span>
  </button>

  <div class="w-px h-4 bg-dark-600 mx-1"></div>

  <!-- Inline code / Blockquote -->
  <button onclick={toggleCode} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('code') ? 'bg-dark-600 text-primary-500' : ''}" title="Inline code">
    &lt;/&gt;
  </button>
  <button onclick={toggleBlockquote} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('blockquote') ? 'bg-dark-600 text-primary-500' : ''}" title="Quote">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  </button>

  <div class="w-px h-4 bg-dark-600 mx-1"></div>

  <!-- Link / Image -->
  <button onclick={addLink} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('link') ? 'bg-dark-600 text-primary-500' : ''}" title="Link">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  </button>
  <button onclick={addImage} class="p-1.5 rounded hover:bg-dark-600 text-dark-200" title="Image">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  </button>

  <div class="w-px h-4 bg-dark-600 mx-1"></div>

  <!-- Bullet list / Numbered list / Task list -->
  <button onclick={toggleBulletList} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('bulletList') ? 'bg-dark-600 text-primary-500' : ''}" title="Bullet List">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  </button>
  <button onclick={toggleOrderedList} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('orderedList') ? 'bg-dark-600 text-primary-500' : ''}" title="Numbered List">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  </button>
  <button onclick={toggleTaskList} class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('taskList') ? 'bg-dark-600 text-primary-500' : ''}" title="Task List">
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  </button>

  <div class="w-px h-4 bg-dark-600 mx-1"></div>

  <!-- Button dropdown (Subscribe, Paywall, Poll) -->
  <ButtonDropdown {editor} />

  <!-- More dropdown (LaTeX, Footnote, Verse) -->
  <MoreDropdown {editor} />
</div>
{/if}
