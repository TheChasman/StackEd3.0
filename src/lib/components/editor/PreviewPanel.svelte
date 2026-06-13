<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import { renderForPreview } from '$lib/utils/manuscript';
  import { runBodyParser } from '$lib/utils/frontmatter';
  import type { AltBlock } from '$lib/utils/manuscript';

  // Reactively compute preview whenever frontmatter or body changes
  let preview = $derived.by(() => {
    const fm = documentStore.frontmatter;
    const body = documentStore.body;
    if (!fm) return null;
    // Run parser in-memory to get latest _SELECTED fields without saving
    const parsed = runBodyParser(fm, body);
    return renderForPreview(body, parsed);
  });

  function selectAlt(section: AltBlock['section'], text: string) {
    const body = documentStore.body;
    // Update the [✓] marker in the body for this section's Alt block
    const altHeadingRe = new RegExp(
      `(## Alt ${section}[^\\n]*)\\n([\\s\\S]*?)(?=\\n##|$)`,
      'i'
    );
    const updatedBody = body.replace(altHeadingRe, (_, heading, block) => {
      const updatedBlock = block
        .split('\n')
        .map((line: string) => {
          const match = line.match(/^(\d+\.\s+)(.*?)(\s*\[✓\])?\s*$/);
          if (!match) return line;
          const itemText = match[2].trim();
          return itemText === text
            ? `${match[1]}${itemText} [✓]`
            : `${match[1]}${itemText}`;
        })
        .join('\n');
      return `${heading}\n${updatedBlock}`;
    });

    if (updatedBody !== body) {
      documentStore.setBody(updatedBody);
      documentStore.setAltSelection(section, text);
    }
  }
</script>

{#if !preview}
  <div class="p-8 text-sm text-dark-400 text-center">No file open.</div>
{:else}
  <div class="flex flex-col h-full overflow-y-auto">

    <!-- SPARK callout -->
    {#if preview.spark}
      <div class="mx-6 mt-6 p-3 bg-dark-800 border border-dark-600 rounded text-xs text-dark-400 italic">
        <span class="font-semibold text-dark-500 uppercase tracking-wide text-[10px] mr-2">SPARK</span>
        {preview.spark}
      </div>
    {/if}

    <!-- Alt blocks (interactive radio buttons) -->
    {#if preview.altBlocks.length > 0}
      <div class="mx-6 mt-4 flex flex-col gap-3">
        {#each preview.altBlocks as block}
          <div class="border border-dark-700 rounded p-3">
            <div class="text-[10px] font-semibold text-dark-500 uppercase tracking-wide mb-2">
              Alt {block.section}
            </div>
            <div class="flex flex-col gap-1">
              {#each block.items as item}
                <label class="flex items-start gap-2 cursor-pointer hover:text-dark-100 text-sm text-dark-300">
                  <input
                    type="radio"
                    name={`alt-${block.section}`}
                    checked={item.selected}
                    onchange={() => selectAlt(block.section, item.text)}
                    class="mt-0.5 shrink-0"
                  />
                  <span class:text-dark-100={item.selected}>{item.text}</span>
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Clean prose -->
    <div class="mx-6 my-6 prose prose-invert prose-sm max-w-none leading-relaxed">
      {#each preview.prose.split('\n\n') as paragraph}
        {#if paragraph.trim()}
          <p>{paragraph.trim()}</p>
        {/if}
      {/each}
    </div>

  </div>
{/if}
