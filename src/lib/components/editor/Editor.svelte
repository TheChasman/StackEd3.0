<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { Editor } from '@tiptap/core';
  import { substackExtensions } from '$lib/editor/schema';
  import {
    clearHeroImageFlags,
    insertHeroImageAtTop,
    replaceHeroImage,
  } from './extensions/heroImage';
  import { documentStore } from '$lib/stores/document.svelte';
  import type { PMDoc } from '$lib/types/scaffold';
  import Toolbar from './Toolbar.svelte';

  let element: HTMLDivElement;
  let editor = $state<Editor | null>(null);

  function getDoc(): PMDoc {
    if (!editor) return { type: 'doc', content: [] };
    return editor.getJSON() as PMDoc;
  }

  function setDoc(doc: PMDoc): void {
    if (!editor) return;
    editor.commands.setContent(doc, { emitUpdate: false });
  }

  onMount(() => {
    editor = new Editor({
      element,
      extensions: substackExtensions,
      content: '',
      onUpdate: () => {
        documentStore.setBody(getDoc());
      },
      onTransaction: () => {
        // Trigger Svelte reactivity on selection changes
        editor = editor;
      },
    });

    // Load initial body from store
    const body = untrack(() => documentStore.body);
    if (body.content.length > 0) {
      setDoc(body);
    }
  });

  // When a new file is opened, reload editor content
  $effect(() => {
    documentStore.loadVersion;
    const body = untrack(() => documentStore.body);
    if (editor) {
      setDoc(body);
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
      const { src, alt, hero, replaceHero, subtitle, credit } =
        (
          e as CustomEvent<{
            src?: string;
            alt?: string;
            hero?: boolean;
            replaceHero?: boolean;
            subtitle?: string;
            credit?: string;
          }>
        ).detail || {};

      const imageSrc = String(src ?? '').trim();
      if (!imageSrc) return;
      const imageAlt = String(alt ?? '').trim();
      const isHero = Boolean(hero);
      const shouldReplaceHero = Boolean(replaceHero);
      const imageSubtitle = String(subtitle ?? '').trim();
      const imageCredit = String(credit ?? '').trim();

      if (
        isHero &&
        shouldReplaceHero &&
        replaceHeroImage(editor, {
          src: imageSrc,
          alt: imageAlt,
          subtitle: imageSubtitle || undefined,
          credit: imageCredit || undefined,
        })
      ) {
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

      editor
        .chain()
        .focus()
        .insertCaptionedImage(
          {
            src: imageSrc,
            alt: imageAlt,
            title: imageCredit ? `Credit: ${imageCredit}` : null,
            credit: imageCredit || null,
            topImage: isHero,
          },
          imageSubtitle || undefined,
        )
        .run();
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
