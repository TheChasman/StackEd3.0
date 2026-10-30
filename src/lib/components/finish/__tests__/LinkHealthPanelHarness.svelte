<script lang="ts">
  import type { Writable } from 'svelte/store';
  import type { PMDoc } from '$lib/types/scaffold';
  import type { LinkHealthService } from '$lib/services/linkHealth';
  import LinkHealthPanel from '../LinkHealthPanel.svelte';
  let {
    body,
    service,
    onblockedchange,
  }: {
    body: Writable<PMDoc>;
    service: LinkHealthService;
    onblockedchange: (blocked: boolean) => void;
  } = $props();
</script>

<LinkHealthPanel body={$body} {service} {onblockedchange} />
