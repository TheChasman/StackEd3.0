<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { TextStyle, FontFamily, FontSize } from '@tiptap/extension-text-style';
  import { marked } from 'marked';
  import TurndownService from 'turndown';
  import { Paywall } from './extensions/Paywall';
  import { SubscribeButton } from './extensions/SubscribeButton';
  import { ShareButton } from './extensions/ShareButton';
  import { Poll } from './extensions/Poll';
  import { Poetry } from './extensions/Poetry';
  import { Latex } from './extensions/LaTeX';
  import { Footnote } from './extensions/Footnote';
  import { CaptionedImage } from './extensions/CaptionedImage';
  import { Image2 } from './extensions/Image2';
  import { Caption } from './extensions/Caption';
  import { FinancialChart } from './extensions/FinancialChart';
  import { PredictionMarket } from './extensions/PredictionMarket';
  import { Recipe } from './extensions/Recipe';
  import { ProtectedTitle } from './extensions/ProtectedTitle';
  import { clearHeroImageFlags, insertHeroImageAtTop, replaceHeroImage } from './extensions/heroImage';
  import { documentStore } from '$lib/stores/document.svelte';
  import Toolbar from './Toolbar.svelte';

  let element: HTMLDivElement;
  let editor = $state<Editor | null>(null);

  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  // Keep Substack custom elements as raw HTML in the Markdown body
  turndown.keep((node) => {
    const el = node as HTMLElement;
    return (
      (el.nodeName === 'SPAN' && Boolean(el.getAttribute('style'))) ||
      el.dataset?.type === 'paywall' ||
      el.dataset?.type === 'subscribe-button' ||
      el.dataset?.type === 'share-button' ||
      el.dataset?.type === 'poll' ||
      el.dataset?.type === 'latex' ||
      el.dataset?.type === 'footnote' ||
      el.dataset?.type === 'financial-chart' ||
      el.dataset?.type === 'prediction-market' ||
      el.dataset?.type === 'recipe' ||
      el.dataset?.type === 'captioned-image' ||
      el.dataset?.type === 'image2' ||
      el.dataset?.type === 'caption' ||
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
        TextStyle,
        FontFamily,
        FontSize,
        StarterKit,
        CaptionedImage,
        Image2,
        Caption,
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
        ProtectedTitle,
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
    // Note: setMarkdown() uses emitUpdate: false, so if ProtectedTitle's
    // ProseMirror plugin normalizes line 1 into an H1 here, that normalized
    // markdown is never written back to documentStore.body (onUpdate doesn't
    // fire). A legacy file opened and saved without an edit will keep its
    // original line 1 on disk, even though the editor renders it as an H1.
    if (documentStore.body) {
      setMarkdown(documentStore.body);
    }
  });

  // When a new file is opened, reload editor content
  $effect(() => {
    documentStore.loadVersion;
    const body = untrack(() => documentStore.body);
    if (editor) {
      // Same emitUpdate: false caveat as onMount above: ProtectedTitle's
      // load-time H1 normalization doesn't dirty documentStore.body.
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
      if (!editor) return;
      const { src, alt, hero, replaceHero, subtitle, credit } = (e as CustomEvent<{
        src?: string;
        alt?: string;
        hero?: boolean;
        replaceHero?: boolean;
        subtitle?: string;
        credit?: string;
      }>).detail || {};

      const imageSrc = String(src ?? '').trim();
      if (!imageSrc) return;
      const imageAlt = String(alt ?? '').trim();
      const isHero = Boolean(hero);
      const shouldReplaceHero = Boolean(replaceHero);
      const imageSubtitle = String(subtitle ?? '').trim();
      const imageCredit = String(credit ?? '').trim();

      if (isHero && shouldReplaceHero && replaceHeroImage(editor, {
        src: imageSrc,
        alt: imageAlt,
        subtitle: imageSubtitle || undefined,
        credit: imageCredit || undefined,
      })) {
        return;
      }

      if (isHero && shouldReplaceHero) {
        clearHeroImageFlags(editor);
        insertHeroImageAtTop(editor, {
          src: imageSrc,
          alt: imageAlt,
          subtitle: imageSubtitle || undefined,
          credit: imageCredit || undefined,
        });
        return;
      }

      if (isHero) {
        clearHeroImageFlags(editor);
      }

      editor.chain().focus().insertCaptionedImage({
        src: imageSrc,
        alt: imageAlt,
        title: imageCredit ? `Credit: ${imageCredit}` : null,
        credit: imageCredit || null,
        topImage: isHero,
      }, imageSubtitle || undefined).run();
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

<div class="flex flex-col flex-1 min-h-0 overflow-hidden">
  <Toolbar {editor} />
  <div
    bind:this={element}
    class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden prose prose-invert max-w-none"
    aria-label="Article body editor"
  ></div>
</div>
