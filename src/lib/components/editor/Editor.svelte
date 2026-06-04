<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { marked } from 'marked';
  import TurndownService from 'turndown';
  import { Paywall } from './extensions/Paywall';
  import { SubscribeButton } from './extensions/SubscribeButton';
  import { ShareButton } from './extensions/ShareButton';
  import { Poll } from './extensions/Poll';
  import { Poetry } from './extensions/Poetry';
  import { Latex } from './extensions/LaTeX';
  import { Footnote } from './extensions/Footnote';
import Image from '@tiptap/extension-image';
import { FinancialChart } from './extensions/FinancialChart';
import { PredictionMarket } from './extensions/PredictionMarket';
import { Recipe } from './extensions/Recipe';
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
      el.dataset?.type === 'share-button' ||
      el.dataset?.type === 'poll' ||
      el.dataset?.type === 'latex' ||
      el.dataset?.type === 'footnote' ||
      el.className === 'poetry-block'
    );
  });

  function getMarkdown(): string {
    if (!editor) return '';
    const html = editor.getHTML();
    return turndown.turndown(html);
  }

  function setMarkdown(md: string): void {
    if (!editor) return;
    const html = marked.parse(md) as string;
    editor.commands.setContent(html, { emitUpdate: false });
  }

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Image,
        Paywall,
        SubscribeButton,
        ShareButton,
        Poll,
        Poetry,
        Latex,
        Footnote,
        FinancialChart,
        PredictionMarket,
        Recipe,
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
    const textHandler = (e: Event) => {
      editor?.commands.insertContent((e as CustomEvent).detail.text);
    };
    const imageHandler = (e: Event) => {
      const { src, alt } = (e as CustomEvent).detail;
      editor?.chain().focus().setImage({ src, alt }).run();
    };
    window.addEventListener('stacked:insert', textHandler);
    window.addEventListener('stacked:insert-image', imageHandler);
    return () => {
      window.removeEventListener('stacked:insert', textHandler);
      window.removeEventListener('stacked:insert-image', imageHandler);
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col h-full">
  <Toolbar {editor} />
  <div
    bind:this={element}
    class="flex-1 overflow-y-auto prose prose-invert max-w-none"
    aria-label="Article body editor"
  ></div>
</div>
