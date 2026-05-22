<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { getHTMLFromFragment } from '@tiptap/html';
  import { marked } from 'marked';
  import TurndownService from 'turndown';
  import { Paywall } from './extensions/Paywall';
  import { SubscribeButton } from './extensions/SubscribeButton';
  import { Poll } from './extensions/Poll';
  import { Poetry } from './extensions/Poetry';
  import { Latex } from './extensions/LaTeX';
  import { Footnote } from './extensions/Footnote';
  import { documentStore } from '$lib/stores/document.svelte';
  import Toolbar from './Toolbar.svelte';

  let element: HTMLDivElement;
  let editor = $state<Editor | null>(null);

  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  // Keep Substack custom elements as raw HTML in the Markdown body
  turndown.keep((node) => {
    const el = node as HTMLElement;
    return (
      el.dataset?.type === 'paywall' ||
      el.dataset?.type === 'subscribe-button' ||
      el.dataset?.type === 'poll' ||
      el.dataset?.type === 'latex' ||
      el.dataset?.type === 'footnote' ||
      el.className === 'poetry-block'
    );
  });

  function getMarkdown(): string {
    if (!editor) return '';
    const html = getHTMLFromFragment(editor.state.doc.content, editor.schema);
    return turndown.turndown(html);
  }

  function setMarkdown(md: string): void {
    if (!editor) return;
    const html = marked.parse(md) as string;
    editor.commands.setContent(html, false);
  }

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Paywall,
        SubscribeButton,
        Poll,
        Poetry,
        Latex,
        Footnote,
      ],
      content: '',
      onUpdate: () => {
        documentStore.setBody(getMarkdown());
      },
      onTransaction: () => {
        // Trigger Svelte reactivity on selection changes
        editor = editor;
      },
    });

    // Load initial body from store
    if (documentStore.body) {
      setMarkdown(documentStore.body);
    }
  });

  // When a new file is opened, reload editor content
  $effect(() => {
    const body = documentStore.body;
    if (editor && !documentStore.dirty) {
      setMarkdown(body);
    }
  });

  onDestroy(() => {
    editor?.destroy();
    editor = null;
  });

  // Keyboard shortcut: Cmd/Ctrl+S triggers save (App.svelte handles the actual save)
  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('stacked:save'));
    }
  }

  // Listen for insert events from ResearchPanel (colon in event name can't use svelte:window binding)
  $effect(() => {
    const handler = (e: Event) => {
      editor?.commands.insertContent((e as CustomEvent).detail.text);
    };
    window.addEventListener('stacked:insert', handler);
    return () => window.removeEventListener('stacked:insert', handler);
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col h-full">
  <Toolbar {editor} />
  <div
    bind:this={element}
    class="flex-1 overflow-y-auto prose prose-gray max-w-none"
    aria-label="Article body editor"
  ></div>
</div>
