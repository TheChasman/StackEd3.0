<script lang="ts">
  import type { PMDoc } from '$lib/types/scaffold';
  import {
    checkBodyLinks,
    linkHealth,
    linkReport,
    type LinkHealthService,
  } from '$lib/services/linkHealth';

  let {
    body,
    service = linkHealth,
    onblockedchange = () => {},
  }: {
    body: PMDoc;
    service?: LinkHealthService;
    onblockedchange?: (blocked: boolean) => void;
  } = $props();
  let revision = $state(0);
  let retrying = $state(false);
  $effect(() =>
    service.subscribe(() => {
      revision++;
    }),
  );
  $effect(() => {
    void checkBodyLinks(body, {}, service);
  });
  let report = $derived.by(() => {
    void revision;
    return linkReport(body, service);
  });
  let blockers = $derived(report.filter((link) => link.status !== 'working'));
  $effect(() => onblockedchange(blockers.length > 0));

  async function recheck() {
    retrying = true;
    try {
      await checkBodyLinks(body, { fresh: true }, service);
    } finally {
      retrying = false;
    }
  }
</script>

<section class="flex flex-col gap-3 border-t border-dark-700 pt-5" aria-label="Link health">
  <div class="flex items-center justify-between gap-3">
    <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider">Link health</h3>
    <button
      onclick={recheck}
      disabled={retrying || report.length === 0}
      class="rounded-md border border-dark-600 px-3 py-1.5 text-xs shadow-sm hover:bg-dark-700 hover:shadow-md focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:saturate-50 disabled:shadow-none disabled:cursor-not-allowed"
      >{retrying ? 'Checking…' : 'Recheck links'}</button
    >
  </div>
  <p
    class="text-sm"
    style:color={blockers.length ? 'var(--cat-yellow)' : 'var(--cat-green)'}
    aria-live="polite"
  >
    {#if report.length === 0}No links to check.
    {:else if blockers.length === 0}✓ All links verified ({report.length}).
    {:else}Publication blocked: {blockers.length}
      {blockers.length === 1 ? 'link needs' : 'links need'} verification.{/if}
  </p>
  {#if blockers.length}
    <ul class="flex flex-col gap-2 text-xs">
      {#each blockers as link (link.url)}
        <li class="rounded-md border border-dark-600 bg-dark-800 p-3 break-words">
          <span
            class="font-medium"
            style:color={link.status === 'dead' ? 'var(--cat-red)' : 'var(--cat-yellow)'}
          >
            {link.status === 'dead'
              ? 'Dead'
              : link.status === 'checking'
                ? 'Checking'
                : 'Couldn’t verify'}
          </span>
          <span class="block text-dark-100">{link.url || '(empty URL)'}</span>
          <span class="text-dark-300">{link.reason}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
