<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import StyleDropdown from './toolbar/StyleDropdown.svelte';
  import ButtonDropdown from './toolbar/ButtonDropdown.svelte';
  import MoreDropdown from './toolbar/MoreDropdown.svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { pickImageForArticle } from '$lib/services/imagePicker';

  let { editor }: { editor: Editor | null } = $props();

  function run(fn: () => void) {
    if (!editor) return;
    fn();
    editor.view.focus();
  }

  function toggleBold() {
    run(() => editor!.chain().toggleBold().run());
  }
  function toggleItalic() {
    run(() => editor!.chain().toggleItalic().run());
  }
  function toggleStrike() {
    run(() => editor!.chain().toggleStrike().run());
  }
  function toggleSuperscript() {
    run(() => (editor!.commands as any).toggleSuperscript?.());
  }
  function toggleSubscript() {
    run(() => (editor!.commands as any).toggleSubscript?.());
  }
  function toggleCode() {
    run(() => editor!.chain().toggleCode().run());
  }
  function toggleBlockquote() {
    run(() => editor!.chain().toggleBlockquote().run());
  }
  function toggleBulletList() {
    run(() => editor!.chain().toggleBulletList().run());
  }
  function toggleOrderedList() {
    run(() => editor!.chain().toggleOrderedList().run());
  }
  function toggleTaskList() {
    run(() => editor!.chain().toggleTaskList().run());
  }
  function undo() {
    run(() => editor!.chain().undo().run());
  }
  function redo() {
    run(() => editor!.chain().redo().run());
  }

  let linkDialogOpen = $state(false);
  let linkUrl = $state('');
  let linkSelection: { from: number; to: number } | null = null;
  let linkDialog = $state<HTMLDialogElement>();
  let linkInput = $state<HTMLInputElement>();

  $effect(() => {
    if (linkDialogOpen) {
      linkDialog?.showModal();
      linkInput?.focus();
      linkInput?.select();
    } else {
      linkDialog?.close();
    }
  });

  function addLink() {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    linkSelection = { from, to };
    linkUrl = editor.getAttributes('link').href ?? '';
    linkDialogOpen = true;
  }

  function closeLink() {
    linkDialogOpen = false;
    if (editor && linkSelection) {
      editor.chain().setTextSelection(linkSelection).focus().run();
    }
  }

  function applyLink(event: SubmitEvent) {
    event.preventDefault();
    if (!editor || !linkSelection) return;
    const chain = editor.chain().setTextSelection(linkSelection).extendMarkRange('link');
    const url = linkUrl.trim();
    if (url) chain.setLink({ href: url }).run();
    else chain.unsetLink().run();
    closeLink();
  }

  async function addImage() {
    if (!editor) return;
    const image = await pickImageForArticle(documentStore.filePath);
    if (!image) return;
    const caption = window.prompt('Caption (optional):', '');
    const credit = window.prompt('Image credit (optional):', '')?.trim() ?? '';
    const isHero = window.confirm('Set as hero image?');
    editor
      .chain()
      .focus()
      .insertCaptionedImage(
        {
          src: image.src,
          alt: image.alt,
          title: credit ? `Credit: ${credit}` : null,
          credit: credit || null,
          topImage: isHero,
        },
        caption || undefined,
      )
      .run();
  }

  function openImageGenerator() {
    window.dispatchEvent(new CustomEvent('stacked:open-image-generator'));
  }
</script>

{#if editor}
  <dialog
    bind:this={linkDialog}
    aria-labelledby="link-dialog-title"
    oncancel={(event) => {
      event.preventDefault();
      closeLink();
    }}
    class="m-auto w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-dark-600 bg-dark-800 p-5 text-dark-100 shadow-xl backdrop:bg-black/50"
  >
    <form onsubmit={applyLink} class="flex flex-col gap-4">
      <h2 id="link-dialog-title" class="text-lg font-semibold">Link</h2>
      <label class="flex flex-col gap-2">
        URL
        <input
          bind:this={linkInput}
          bind:value={linkUrl}
          aria-label="URL"
          type="text"
          inputmode="url"
          placeholder="https://example.com"
          class="w-full rounded-md border border-dark-600 bg-dark-900 px-3 py-2 shadow-inner focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </label>
      <p class="text-sm text-dark-300">Clear the URL to remove an existing link.</p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          title="Cancel link"
          onclick={closeLink}
          class="rounded-md border border-dark-600 px-3 py-2 shadow-sm hover:bg-dark-600 focus:ring-2 focus:ring-primary-500"
          >Cancel</button
        >
        <button
          type="submit"
          class="rounded-md border border-primary-500 bg-primary-600 px-3 py-2 text-white shadow-sm hover:bg-primary-500 focus:ring-2 focus:ring-primary-500"
          >Apply link</button
        >
      </div>
    </form>
  </dialog>
  <div
    class="flex items-center gap-1 p-2 border-b border-dark-700 bg-dark-800 relative z-20 flex-wrap"
  >
    <!-- Undo / Redo -->
    <button
      onclick={undo}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 disabled:opacity-50"
      disabled={!editor.can().undo()}
      title="Undo"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
        />
      </svg>
    </button>
    <button
      onclick={redo}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 disabled:opacity-50"
      disabled={!editor.can().redo()}
      title="Redo"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
        />
      </svg>
    </button>

    <div class="w-px h-4 bg-dark-600 mx-1"></div>

    <!-- Style dropdown (Heading 2-4 / Normal text) -->
    <StyleDropdown {editor} />

    <div class="w-px h-4 bg-dark-600 mx-1"></div>

    <!-- Bold / Italic / Strikethrough -->
    <button
      onclick={toggleBold}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('bold')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Bold"
    >
      <span class="font-bold">B</span>
    </button>
    <button
      onclick={toggleItalic}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('italic')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Italic"
    >
      <span class="italic">I</span>
    </button>
    <button
      onclick={toggleStrike}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('strike')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Strikethrough"
    >
      <span class="line-through">S</span>
    </button>
    <button
      onclick={toggleSuperscript}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('superscript')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Superscript"
    >
      <span class="text-xs">X²</span>
    </button>
    <button
      onclick={toggleSubscript}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('subscript')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Subscript"
    >
      <span class="text-xs">X₂</span>
    </button>

    <div class="w-px h-4 bg-dark-600 mx-1"></div>

    <!-- Inline code / Blockquote -->
    <button
      onclick={toggleCode}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('code')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Inline code"
    >
      &lt;/&gt;
    </button>
    <button
      onclick={toggleBlockquote}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('blockquote')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Quote"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
        />
      </svg>
    </button>

    <div class="w-px h-4 bg-dark-600 mx-1"></div>

    <!-- Link / Image -->
    <button
      onclick={addLink}
      onmousedown={(event) => event.preventDefault()}
      aria-haspopup="dialog"
      class="p-1.5 border border-dark-600 shadow-sm rounded hover:bg-dark-600 text-dark-200 {editor.isActive(
        'link',
      )
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Link"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    </button>
    <button onclick={addImage} class="p-1.5 rounded hover:bg-dark-600 text-dark-200" title="Image">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </button>
    <button
      onclick={openImageGenerator}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200"
      title="Generate Image"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9.5 3.5l1.2 3.1 3.3 1.2-3.3 1.2-1.2 3.1-1.2-3.1L5 7.8l3.3-1.2 1.2-3.1zM17 10l.8 2.1L20 13l-2.2.9L17 16l-.8-2.1L14 13l2.2-.9L17 10zM12 15l.6 1.6 1.6.6-1.6.6L12 20l-.6-1.6-1.6-.6 1.6-.6L12 15z"
        />
      </svg>
    </button>

    <div class="w-px h-4 bg-dark-600 mx-1"></div>

    <!-- Bullet list / Numbered list / Task list -->
    <button
      onclick={toggleBulletList}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('bulletList')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Bullet List"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
    <button
      onclick={toggleOrderedList}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('orderedList')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Numbered List"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
        />
      </svg>
    </button>
    <button
      onclick={toggleTaskList}
      class="p-1.5 rounded hover:bg-dark-600 text-dark-200 {editor.isActive('taskList')
        ? 'bg-dark-600 text-primary-500'
        : ''}"
      title="Task List"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </button>

    <div class="w-px h-4 bg-dark-600 mx-1"></div>

    <!-- Button dropdown (Subscribe, Paywall, Poll) -->
    <ButtonDropdown {editor} />

    <!-- More dropdown (LaTeX, Footnote, Verse) -->
    <MoreDropdown {editor} />
  </div>
{/if}
