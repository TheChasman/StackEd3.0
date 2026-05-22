<script lang="ts">
  interface Command {
    title: string;
    command: () => void;
  }
  let { items = [], command }: { items: Command[]; command: (item: Command) => void } = $props();
  let selectedIndex = $state(0);

  export function onKeyDown(event: KeyboardEvent): boolean {
    if (event.key === 'ArrowUp') {
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      return true;
    }
    if (event.key === 'ArrowDown') {
      selectedIndex = (selectedIndex + 1) % items.length;
      return true;
    }
    if (event.key === 'Enter') {
      command(items[selectedIndex]);
      return true;
    }
    return false;
  }
</script>

<div class="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-56">
  {#each items as item, i}
    <button
      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 {i === selectedIndex ? 'bg-gray-100' : ''}"
      onclick={() => command(item)}
    >
      {item.title}
    </button>
  {/each}
  {#if items.length === 0}
    <p class="px-3 py-2 text-sm text-gray-400">No commands</p>
  {/if}
</div>
