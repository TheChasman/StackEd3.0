<script lang="ts">
  interface Props {
    colors: Record<string, string>;
  }

  const { colors }: Props = $props();

  // Show 6 key colors: base, text, blue, green, red, yellow
  const previewColors = [
    colors.base,
    colors.text,
    colors.blue,
    colors.green,
    colors.red,
    colors.yellow,
  ].filter(Boolean);
</script>

<div class="flex gap-2">
  {#each previewColors as color}
    <div
      class="w-8 h-8 rounded border border-dark-500"
      style="background-color: {color}"
      title={color}
    ></div>
  {/each}
</div>
