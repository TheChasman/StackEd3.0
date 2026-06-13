<script lang="ts">
  let {
    phase,
    yamlVisible,
    onToggleYaml,
    onOpenPreview,
    onOpenSettings,
  }: {
    phase: 'draft' | 'final';
    yamlVisible: boolean;
    onToggleYaml: () => void;
    onOpenPreview: () => void;
    onOpenSettings: () => void;
  } = $props();
</script>

<div class="flex items-center justify-between px-4 py-1.5 border-b border-dark-700 bg-dark-900 shrink-0 text-[11px] select-none">

  <!-- Timeline -->
  <div class="flex items-center gap-0 flex-1 justify-center overflow-hidden">

    <span class="text-dark-500 whitespace-nowrap">SPARK</span>
    <span class="w-5 h-px bg-dark-600 mx-1.5 inline-block shrink-0"></span>

    <!-- [DRAFT | PREVIEW ↗] bracket -->
    <span class="border border-dark-600 rounded px-2 py-0.5 flex items-center gap-1.5 shrink-0
      {phase === 'draft' ? 'border-green-700' : 'border-dark-700'}">
      <span class="{phase === 'draft' ? 'text-green-400' : 'text-dark-600'}">DRAFT</span>
      <span class="text-dark-700">|</span>
      <button
        onclick={onOpenPreview}
        disabled={phase !== 'draft'}
        class="text-blue-400 hover:text-blue-300 disabled:text-dark-600 disabled:pointer-events-none"
      >
        PREVIEW ↗
      </button>
    </span>

    <!-- Connecting line -->
    <span class="w-5 h-px {phase === 'final' ? 'bg-green-700' : 'bg-dark-600'} mx-1.5 inline-block shrink-0"></span>

    <!-- FINAL DRAFT -->
    <span class="whitespace-nowrap shrink-0 {phase === 'final'
      ? 'font-semibold text-amber-400 border border-amber-700 rounded px-2 py-0.5'
      : 'text-dark-600'}">
      FINAL DRAFT
    </span>

    <span class="w-5 h-px bg-dark-600 mx-1.5 inline-block shrink-0"></span>

    <span class="text-dark-600 whitespace-nowrap">PUBLISHED</span>

  </div>

  <!-- Right controls: YAML toggle + cog -->
  <div class="flex items-center gap-1 ml-4 shrink-0">

    <!-- YAML panel toggle: hollow = hidden, filled-right = visible -->
    <button
      onclick={onToggleYaml}
      title={yamlVisible ? 'Hide YAML panel' : 'Show YAML panel'}
      aria-label={yamlVisible ? 'Hide YAML panel' : 'Show YAML panel'}
      aria-pressed={yamlVisible}
      class="relative w-6 h-4 border rounded flex items-center justify-center overflow-hidden transition-colors
        {yamlVisible ? 'border-dark-300' : 'border-dark-600 hover:border-dark-400'}"
    >
      {#if yamlVisible}
        <span class="absolute right-0 top-0 bottom-0 w-[40%] bg-dark-300 opacity-40"></span>
        <span class="absolute top-[2px] bottom-[2px] w-px bg-dark-300 opacity-50" style="right: 40%"></span>
      {/if}
    </button>

    <!-- Cog / Settings button -->
    <button
      onclick={onOpenSettings}
      title="Settings"
      aria-label="Open settings"
      class="text-dark-500 hover:text-dark-300 text-base leading-none px-0.5"
    >⚙</button>

  </div>

</div>
