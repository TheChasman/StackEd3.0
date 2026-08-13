<script lang="ts">
  interface Props {
    colors: Record<string, string>;
  }

  let { colors }: Props = $props();
  const previewColors = $derived(
    [
      colors.base00 ?? colors.base,
      colors.base05 ?? colors.text,
      colors.base0D ?? colors.blue,
      colors.base0B ?? colors.green,
      colors.base08 ?? colors.red,
      colors.base0A ?? colors.yellow,
    ].filter(Boolean) as string[],
  );
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
