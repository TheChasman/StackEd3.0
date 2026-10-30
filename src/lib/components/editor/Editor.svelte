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
  import { isPostPayload, type PMDoc } from '$lib/types/scaffold';
  import Toolbar from './Toolbar.svelte';
  import { LinkHealth } from './extensions/LinkHealth';

  let element: HTMLDivElement;
  let editor = $state<Editor | null>(null);
  // Title and subtitle live in the canvas, at the top of the writing column.
  let post = $derived(
    Boolean(documentStore.scaffold && isPostPayload(documentStore.scaffold.payload)),
  );
  let subtitle = $derived(
    documentStore.scaffold && isPostPayload(documentStore.scaffold.payload)
      ? documentStore.scaffold.payload.draft_subtitle
      : '',
  );

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
      extensions: [...substackExtensions, LinkHealth],
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
  <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
    <div
      class="mx-auto w-full px-8 pb-16 min-h-full flex flex-col"
      style="max-width: var(--stacked-measure);"
    >
      {#if post}
        <input
          type="text"
          placeholder="Title"
          value={documentStore.title}
          oninput={(e) => documentStore.patchPayload('draft_title', e.currentTarget.value)}
          class="mt-6 w-full bg-transparent text-3xl font-bold text-dark-100 outline-none placeholder:text-dark-600"
        />
        <input
          type="text"
          placeholder="Subtitle (optional)"
          value={subtitle}
          oninput={(e) => documentStore.patchPayload('draft_subtitle', e.currentTarget.value)}
          class="mt-2 mb-1 w-full bg-transparent text-lg text-dark-300 outline-none placeholder:text-dark-600"
        />
      {/if}
      <div
        bind:this={element}
        class="prose prose-invert max-w-none flex-1"
        aria-label="Article body editor"
      ></div>
    </div>
  </div>
</div>
