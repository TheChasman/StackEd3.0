<script lang="ts">
  import { customThemesStore } from '$lib/stores/customThemes.svelte';

  let { themeId, onclose }: { themeId: string; onclose: () => void } = $props();

  const foundTheme = customThemesStore.customThemes.find((t) => t.id === themeId);
  if (!foundTheme) throw new Error(`Theme ${themeId} not found`);

  const theme = foundTheme;
  const themeColors = theme.colors as Record<string, string>;

  let name = $state(theme.name);
  let description = $state(theme.description || '');
  let colors = $state<Record<string, string>>({ ...themeColors });

  const colorGroups = [
    {
      name: 'Base Ramp',
      colors: ['base00', 'base01', 'base02', 'base03', 'base04', 'base05', 'base06', 'base07'],
    },
    {
      name: 'Accent Ramp',
      colors: ['base08', 'base09', 'base0A', 'base0B', 'base0C', 'base0D', 'base0E', 'base0F'],
    },
  ];

  async function save() {
    await customThemesStore.updateTheme(themeId, {
      name,
      description,
      colors,
    });
    onclose();
  }

  function cancel() {
    onclose();
  }

  function resetColor(colorName: string) {
    if (confirm(`Reset ${colorName} to original?`)) {
      colors[colorName] = themeColors[colorName];
    }
  }
</script>

<div class="p-6 space-y-6">
  <!-- Header -->
  <div>
    <h3 class="text-2xl font-semibold text-dark-100 mb-5">Edit Theme</h3>
    <div class="space-y-4">
      <div>
        <label class="text-sm font-medium text-dark-300 uppercase">Name</label>
        <input
          type="text"
          bind:value={name}
          class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded text-dark-100 mt-2 text-base"
        />
      </div>
      <div>
        <label class="text-sm font-medium text-dark-300 uppercase">Description</label>
        <textarea
          bind:value={description}
          rows={2}
          class="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded text-dark-100 mt-2 resize-none text-base"
        ></textarea>
      </div>
    </div>
  </div>

  <!-- Color Groups -->
  <div class="space-y-6 max-h-[calc(90vh-300px)] overflow-y-auto">
    {#each colorGroups as group}
      <div>
        <h4 class="text-base font-semibold text-dark-200 mb-4">{group.name}</h4>
        <div class="grid grid-cols-2 gap-4">
          {#each group.colors as colorName}
            <div class="p-4 bg-dark-700 rounded border border-dark-600">
              <label class="text-sm font-medium text-dark-300 uppercase block mb-3">
                {colorName}
              </label>
              <div class="flex gap-2 items-center">
                <input
                  type="color"
                  bind:value={colors[colorName]}
                  class="w-12 h-12 rounded cursor-pointer"
                />
                <input
                  type="text"
                  bind:value={colors[colorName]}
                  class="flex-1 px-3 py-2 bg-dark-600 border border-dark-500 rounded text-sm text-dark-100 font-mono"
                />
                <button
                  onclick={() => resetColor(colorName)}
                  class="px-3 py-2 bg-dark-600 hover:bg-dark-500 rounded text-base text-dark-300"
                  title="Reset to original"
                >
                  ↺
                </button>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- Actions -->
  <div class="flex gap-3 pt-5 border-t border-dark-700">
    <button
      onclick={save}
      class="px-6 py-3 bg-primary-600 hover:bg-primary-700 rounded text-dark-900 font-medium text-base transition-colors"
    >
      Save Changes
    </button>
    <button
      onclick={cancel}
      class="px-6 py-3 bg-dark-700 hover:bg-dark-600 rounded text-dark-200 font-medium text-base transition-colors"
    >
      Cancel
    </button>
  </div>
</div>
