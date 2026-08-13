<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Snippet } from 'svelte';

  type Align = 'left' | 'right';

  let {
    label,
    width = 'w-48',
    align = 'left',
    disabled = false,
    open = $bindable(false),
    trigger,
    children,
  }: {
    label: string;
    width?: string;
    align?: Align;
    disabled?: boolean;
    open?: boolean;
    trigger?: unknown;
    children: Snippet<[close: () => void]>;
  } = $props();

  function toggle() {
    if (disabled) return;
    open = !open;
  }
  function close() {
    open = false;
  }

  function handleBlur(e: FocusEvent) {
    const target = e.relatedTarget as HTMLElement | null;
    if (target && (e.currentTarget as HTMLElement).contains(target)) return;
    close();
  }
</script>

<div class="relative" onfocusout={handleBlur}>
  <button
    type="button"
    {disabled}
    onclick={toggle}
    class="px-2 py-1 text-sm rounded text-dark-200 hover:bg-dark-600 hover:text-primary-500 {open
      ? 'bg-dark-600 text-primary-500'
      : ''}"
  >
    {label}
    <svg class="w-3 h-3 inline ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
    </svg>
  </button>

  {#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="fixed inset-0 z-30"
      onclick={close}
      onkeydown={(e) => e.key === 'Escape' && close()}
      aria-hidden="true"
    ></div>
    <div
      class="absolute top-full mt-1 z-40 {width} bg-dark-800 border border-dark-600 rounded-lg shadow-xl overflow-hidden {align ===
      'right'
        ? 'right-0'
        : 'left-0'}"
      transition:fade={{ duration: 100 }}
    >
      {@render children(close)}
    </div>
  {/if}
</div>
