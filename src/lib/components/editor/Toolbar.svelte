<script lang="ts">
  import type { Editor } from '@tiptap/core';
  let { editor }: { editor: Editor | null } = $props();

  function run(fn: () => void) {
    if (!editor) return;
    fn();
    editor.view.focus();
  }
</script>

{#if editor}
<div class="flex flex-wrap gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
  <!-- Text formatting -->
  <button onclick={() => run(() => editor!.chain().toggleBold().run())}
    class="px-2 py-1 rounded text-sm font-bold {editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-200'}">B</button>
  <button onclick={() => run(() => editor!.chain().toggleItalic().run())}
    class="px-2 py-1 rounded text-sm italic {editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-200'}">I</button>
  <button onclick={() => run(() => editor!.chain().toggleCode().run())}
    class="px-2 py-1 rounded text-sm font-mono {editor.isActive('code') ? 'bg-gray-200' : 'hover:bg-gray-200'}">{'`'}</button>

  <div class="w-px bg-gray-300 mx-1"></div>

  <!-- Headings -->
  {#each [1, 2, 3] as level}
    <button onclick={() => run(() => editor!.chain().toggleHeading({ level: level as 1|2|3 }).run())}
      class="px-2 py-1 rounded text-sm {editor.isActive('heading', { level }) ? 'bg-gray-200' : 'hover:bg-gray-200'}">H{level}</button>
  {/each}

  <div class="w-px bg-gray-300 mx-1"></div>

  <!-- Lists -->
  <button onclick={() => run(() => editor!.chain().toggleBulletList().run())}
    class="px-2 py-1 rounded text-sm {editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-200'}">• List</button>
  <button onclick={() => run(() => editor!.chain().toggleOrderedList().run())}
    class="px-2 py-1 rounded text-sm {editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-200'}">1. List</button>
  <button onclick={() => run(() => editor!.chain().toggleBlockquote().run())}
    class="px-2 py-1 rounded text-sm {editor.isActive('blockquote') ? 'bg-gray-200' : 'hover:bg-gray-200'}">"</button>

  <div class="w-px bg-gray-300 mx-1"></div>

  <!-- Substack extensions -->
  <button onclick={() => run(() => editor!.chain().insertContent({ type: 'paywall' }).run())}
    class="px-2 py-1 rounded text-sm hover:bg-purple-100 text-purple-700">Paywall</button>
  <button onclick={() => run(() => editor!.chain().insertContent({
      type: 'subscribeButton',
      attrs: { publication: '', section: '' }
    }).run())}
    class="px-2 py-1 rounded text-sm hover:bg-amber-100 text-amber-700">Subscribe</button>
  <button onclick={() => run(() => editor!.chain().insertPoll().run())}
    class="px-2 py-1 rounded text-sm hover:bg-blue-100 text-blue-700">Poll</button>
  <button onclick={() => run(() => editor!.chain().setPoetry().run())}
    class="px-2 py-1 rounded text-sm hover:bg-green-100 text-green-700">Verse</button>
  <button onclick={() => run(() => editor!.chain().insertLatex().run())}
    class="px-2 py-1 rounded text-sm hover:bg-gray-100 font-mono">∑</button>
  <button onclick={() => {
    const text = prompt('Footnote text:');
    if (text) run(() => editor!.chain().addFootnote(text).run());
  }} class="px-2 py-1 rounded text-sm hover:bg-gray-100">fn</button>
</div>
{/if}
