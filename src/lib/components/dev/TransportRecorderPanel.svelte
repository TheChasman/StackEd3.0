<script lang="ts">
  import { subscribe, clearBuffer, type RecorderEntry } from '$lib/stores/transportRecorder.svelte';

  let entries = $state<RecorderEntry[]>([]);

  $effect(() => {
    const unsub = subscribe((buf) => {
      entries = buf;
    });
    return unsub;
  });

  function color(entry: RecorderEntry): string {
    if (entry.error || (typeof entry.status === 'number' && entry.status >= 400))
      return 'text-red-400';
    if (entry.status === 'pending') return 'text-yellow-400';
    return 'text-green-400';
  }

  function copyAll(): void {
    navigator.clipboard.writeText(JSON.stringify(entries, null, 2));
  }
</script>

<div
  class="flex flex-col h-full text-xs font-mono bg-dark-900 text-dark-100 p-2 gap-2 overflow-hidden"
>
  <div class="flex gap-2 items-center">
    <span class="font-semibold">Transport Recorder ({entries.length}/200)</span>
    <button class="px-2 py-1 border border-dark-700 rounded" onclick={clearBuffer}>Clear</button>
    <button class="px-2 py-1 border border-dark-700 rounded" onclick={copyAll}>Copy JSON</button>
  </div>
  <div class="flex-1 overflow-y-auto">
    {#each entries as e (e.id)}
      <details class="border-b border-dark-800 py-1">
        <summary class="flex gap-2 {color(e)}">
          <span class="text-dark-500">{new Date(e.startedAt).toLocaleTimeString()}</span>
          <span class="font-semibold">{e.method}</span>
          <span>{e.path}</span>
          <span class="ml-auto px-1.5 py-0.5 rounded bg-dark-800">{e.status}</span>
          <span class="text-dark-500">{e.endedAt ? `${e.endedAt - e.startedAt}ms` : '…'}</span>
        </summary>
        <div class="mt-1 grid grid-cols-2 gap-2">
          <div>
            <div class="text-dark-400">body in</div>
            <pre class="whitespace-pre-wrap break-all">{JSON.stringify(e.bodyIn, null, 2)}</pre>
          </div>
          <div>
            <div class="text-dark-400">{e.error ? 'error' : 'body out'}</div>
            <pre class="whitespace-pre-wrap break-all">{e.error ??
                JSON.stringify(e.bodyOut, null, 2)}</pre>
          </div>
        </div>
      </details>
    {/each}
  </div>
</div>
