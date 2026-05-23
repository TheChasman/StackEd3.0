<script lang="ts">
  let { label, value }: { label: string; value: string | boolean | string[] | null } = $props();

  function display(v: typeof value): string {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    return String(v);
  }
</script>

<div class="flex flex-col gap-0.5">
  <label class="text-xs font-medium text-dark-400 uppercase tracking-wide">{label}</label>
  <p class="text-sm text-dark-400 truncate">{display(value)}</p>
</div>
