<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import ToolbarDropdown from './ToolbarDropdown.svelte';
  import type { ShareVariant } from '../extensions/ShareButton';

  let { editor } = $props<{ editor: Editor }>();

  type Item =
    | { kind: 'subscribe' | 'subscribe-caption' }
    | { kind: 'share'; variant: ShareVariant; label: string; description: string }
    | { kind: 'custom' };

  const ITEMS: Item[] = [
    { kind: 'subscribe' },
    { kind: 'subscribe-caption' },
    {
      kind: 'share',
      variant: 'share-post',
      label: 'Share post',
      description: 'Encourage readers to share this post',
    },
    {
      kind: 'share',
      variant: 'share-post-caption',
      label: 'Share post w/ caption',
      description: 'Share post button with editable caption',
    },
    {
      kind: 'share',
      variant: 'share-publication',
      label: 'Share publication',
      description: 'Share your whole publication',
    },
    {
      kind: 'share',
      variant: 'leave-comment',
      label: 'Leave a comment',
      description: 'Jump readers to the comments',
    },
    {
      kind: 'share',
      variant: 'send-message',
      label: 'Send a message',
      description: 'Open Substack chat / DM',
    },
    { kind: 'custom' },
  ];

  function apply(item: Item, close: () => void) {
    if (item.kind === 'subscribe') {
      editor.chain().focus().insertContent({ type: 'subscribeButton' }).run();
    } else if (item.kind === 'subscribe-caption') {
      const caption = prompt('Caption text:', 'Join the newsletter for free') ?? '';
      editor.chain().focus().insertContent({ type: 'subscribeButton', attrs: { caption } }).run();
    } else if (item.kind === 'share') {
      const attrs: Record<string, any> = { variant: item.variant };
      if (item.variant === 'share-post-caption') {
        attrs.caption = prompt('Caption text:', 'Share this with someone you know') ?? '';
      }
      if (typeof editor.commands.insertShareButton === 'function') {
        editor.commands.insertShareButton(attrs);
      } else {
        editor.chain().focus().insertContent({ type: 'shareButton', attrs }).run();
      }
    } else if (item.kind === 'custom') {
      const label = prompt('Button label:', 'Click here');
      if (label === null) {
        close();
        return;
      }
      const url = prompt('Button URL:', 'https://');
      if (url === null) {
        close();
        return;
      }
      editor
        .chain()
        .focus()
        .insertContent({ type: 'shareButton', attrs: { variant: 'custom', label, url } })
        .run();
    }
    close();
  }
</script>

<ToolbarDropdown label="Button" width="w-56">
  {#snippet children(close)}
    <button
      type="button"
      onclick={() => apply({ kind: 'subscribe' }, close)}
      class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 w-full"
    >
      Subscribe
    </button>
    <button
      type="button"
      onclick={() => apply({ kind: 'subscribe-caption' }, close)}
      class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 w-full"
    >
      Subscribe w/ caption
    </button>
    <div class="h-px bg-dark-700 my-1"></div>
    {#each ITEMS.filter((i) => i.kind === 'share') as item (item.variant)}
      <button
        type="button"
        onclick={() => apply(item, close)}
        class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 w-full"
        title={item.description}
      >
        {item.label}
      </button>
    {/each}
    <div class="h-px bg-dark-700 my-1"></div>
    <button
      type="button"
      onclick={() => apply({ kind: 'custom' }, close)}
      class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 w-full"
    >
      Custom…
    </button>
  {/snippet}
</ToolbarDropdown>
