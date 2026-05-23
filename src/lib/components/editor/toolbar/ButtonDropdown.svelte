<script lang="ts">
  import type { Editor } from '@tiptap/core';
  import ToolbarDropdown from './ToolbarDropdown.svelte';

  let { editor } = $props<{ editor: Editor }>();

  type Item =
    | { kind: 'subscribe' }
    | { kind: 'paywall' }
    | { kind: 'poll' };

  function apply(item: Item, close: () => void) {
    switch (item.kind) {
      case 'subscribe':
        editor.chain().focus().insertContent({
          type: 'subscribeButton',
          attrs: { publication: '', section: '' }
        }).run();
        break;
      case 'paywall':
        editor.chain().focus().insertContent({ type: 'paywall' }).run();
        break;
      case 'poll':
        (editor.commands as any).insertPoll?.();
        break;
    }
    close();
  }
</script>

<ToolbarDropdown label="Button">
  {#snippet children(close)}
    <div class="py-1 border-b border-dark-700">
      <p class="px-3 py-1 text-xs font-semibold text-dark-400 uppercase">Substack</p>
      <button
        type="button"
        onclick={() => apply({ kind: 'subscribe' }, close)}
        class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 w-full"
      >
        Subscribe
      </button>
      <button
        type="button"
        onclick={() => apply({ kind: 'paywall' }, close)}
        class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 w-full"
      >
        Paywall
      </button>
      <button
        type="button"
        onclick={() => apply({ kind: 'poll' }, close)}
        class="text-left px-3 py-2 text-sm text-dark-200 hover:bg-dark-700 hover:text-primary-500 w-full"
      >
        Poll
      </button>
    </div>
  {/snippet}
</ToolbarDropdown>
