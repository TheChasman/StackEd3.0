# Tag/YAML Alignment & Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the YAML panel a fully read-only mirror of the editor body, add Alt block support throughout the parse/preview/promotion pipeline, introduce a two-phase Draft→Final Draft workflow with a one-way promotion gate, and wire SEO generation to the Publish step.

**Architecture:** The editor body is the single source of truth. A parser runs on every Save and every Preview activation, extracting section content and Alt block selections into YAML. A new PreviewPanel renders a clean reader's-eye view. A Promotion action strips all structural markup and writes a `_final.md` file, switching the editor to Final Draft mode.

**Tech Stack:** Svelte 5 (runes), TypeScript, Vitest, Tauri (invoke for file I/O), TipTap editor, Tailwind CSS.

**Out of scope:** AI-GEN full implementation (depends on substack-writer skill update — see `memory/project_substack_writer_todo.md`). Grammarly integration.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/types/article.ts` | Modify | Add `TITLE_SELECTED`, `SUBTITLE_SELECTED`, `HOOK_SELECTED`, `LANDING_SELECTED`, `AI_GEN` fields |
| `src/lib/utils/frontmatter.ts` | Modify | Alt block extraction, HOOK warning, `runBodyParser()` export |
| `src/lib/utils/frontmatter.test.ts` | Modify | Tests for Alt extraction, HOOK warning |
| `src/lib/utils/manuscript.ts` | **Create** | `renderForPreview()`, `renderForPromotion()`, `checkPromotionGate()` |
| `src/lib/utils/manuscript.test.ts` | **Create** | Tests for all manuscript utilities |
| `src/lib/stores/document.svelte.ts` | Modify | `phase` getter, `hookWarning` getter |
| `src/lib/stores/document.test.ts` | Modify | Tests for new getters |
| `src/lib/components/yaml/YamlPanel.svelte` | Modify | All fields read-only, `_SELECTED` display, AI_GEN checkbox |
| `src/lib/components/yaml/FieldFree.svelte` | Modify | Accept `readonly` prop |
| `src/lib/components/editor/PreviewPanel.svelte` | **Create** | Reader's eye view: strips markup, Alt checkboxes, SPARK callout |
| `src/lib/components/WorkflowTimeline.svelte` | **Create** | Timeline strip + YAML panel toggle icons |
| `src/lib/services/seo.ts` | Modify | Include Alt history in SEO prompt |
| `src/lib/services/seo.test.ts` | Modify | Test Alt history in prompt |
| `src/lib/services/files.ts` | Modify | Add `writeFilePath()` for promotion (no dialog, no recent-files side-effects) |
| `src/App.svelte` | Modify | Wire PreviewPanel tab, WorkflowTimeline, phase-aware layout, promotion, Final Draft mode |

---

## Task 1: Extend ArticleFrontmatter with Alt selection and AI_GEN fields

**Files:**
- Modify: `src/lib/types/article.ts`

- [ ] **Step 1: Add new fields to the interface**

In `src/lib/types/article.ts`, replace the existing `ArticleFrontmatter` interface and its defaults/order:

```typescript
// Simplified YAML frontmatter for Markdown articles (Substack structure + pre-posting SEO)
export interface ArticleFrontmatter {
  IMAGE: string;
  SPARK: string;
  TITLE: string;
  SUBTITLE: string;
  HOOK: string;
  LANDING: string;
  TITLE_SELECTED: string;      // [✓]-chosen Alt TITLE text, or ''
  SUBTITLE_SELECTED: string;   // [✓]-chosen Alt SUBTITLE text, or ''
  HOOK_SELECTED: string;       // [✓]-chosen Alt HOOK text, or ''
  LANDING_SELECTED: string;    // [✓]-chosen Alt LANDING text, or ''
  AI_GEN: boolean;             // true = generative mode, false = rescan mode
  SEO_TITLE: string;
  SEO_DESCRIPTION: string;
  SEO_SLUG: string;
  SEO_TAGS: string[];
  created: string;
  updated: string;
}

export const FRONTMATTER_DEFAULTS: ArticleFrontmatter = {
  IMAGE: '',
  SPARK: '',
  TITLE: '',
  SUBTITLE: '',
  HOOK: '',
  LANDING: '',
  TITLE_SELECTED: '',
  SUBTITLE_SELECTED: '',
  HOOK_SELECTED: '',
  LANDING_SELECTED: '',
  AI_GEN: false,
  SEO_TITLE: '',
  SEO_DESCRIPTION: '',
  SEO_SLUG: '',
  SEO_TAGS: [],
  created: '',
  updated: '',
};

export const FRONTMATTER_FIELD_ORDER: (keyof ArticleFrontmatter)[] = [
  'IMAGE',
  'SPARK',
  'TITLE',
  'SUBTITLE',
  'HOOK',
  'LANDING',
  'TITLE_SELECTED',
  'SUBTITLE_SELECTED',
  'HOOK_SELECTED',
  'LANDING_SELECTED',
  'AI_GEN',
  'SEO_TITLE',
  'SEO_DESCRIPTION',
  'SEO_SLUG',
  'SEO_TAGS',
  'created',
  'updated',
];
```

- [ ] **Step 2: Run TypeScript check to surface errors from new fields**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -40
```

Expected: errors in `files.ts` `parseContent` (missing new fields) and anywhere `ArticleFrontmatter` is constructed. Fix them now.

In `src/lib/services/files.ts`, inside `parseContent`, add the new fields to the `frontmatter` object:

```typescript
const frontmatter: ArticleFrontmatter = {
  IMAGE: value('IMAGE') || FRONTMATTER_DEFAULTS.IMAGE,
  SPARK: value('SPARK') || value('spark_notes') || FRONTMATTER_DEFAULTS.SPARK,
  TITLE: value('TITLE') || value('title') || fallbackTitleFromName || FRONTMATTER_DEFAULTS.TITLE,
  SUBTITLE: value('SUBTITLE') || value('subtitle') || FRONTMATTER_DEFAULTS.SUBTITLE,
  HOOK: value('HOOK') || value('hook') || value('opening') || FRONTMATTER_DEFAULTS.HOOK,
  LANDING: value('LANDING') || FRONTMATTER_DEFAULTS.LANDING,
  TITLE_SELECTED: value('TITLE_SELECTED'),
  SUBTITLE_SELECTED: value('SUBTITLE_SELECTED'),
  HOOK_SELECTED: value('HOOK_SELECTED'),
  LANDING_SELECTED: value('LANDING_SELECTED'),
  AI_GEN: raw['AI_GEN'] === true,
  SEO_TITLE: value('SEO_TITLE') || value('seo_title') || FRONTMATTER_DEFAULTS.SEO_TITLE,
  SEO_DESCRIPTION: value('SEO_DESCRIPTION') || value('seo_description') || FRONTMATTER_DEFAULTS.SEO_DESCRIPTION,
  SEO_SLUG: value('SEO_SLUG') || value('seo_slug') || FRONTMATTER_DEFAULTS.SEO_SLUG,
  SEO_TAGS: arrayValue('SEO_TAGS').length
    ? arrayValue('SEO_TAGS')
    : arrayValue('substack_tags').length
      ? arrayValue('substack_tags')
      : FRONTMATTER_DEFAULTS.SEO_TAGS,
  created: value('created') || now,
  updated: value('updated') || now,
};
```

Also update the `hasLatestSchema` check — the `expectedOrder` now has 17 fields, so the count check will still work.

In `src/lib/services/seo.test.ts`, add the new fields to the `BASE` object:

```typescript
const BASE: ArticleFrontmatter = {
  IMAGE: '',
  SPARK: 'Raw idea',
  TITLE: 'Partial Solution',
  SUBTITLE: 'What does impartiality look like?',
  HOOK: 'The oath changed in 2002.',
  LANDING: '',
  TITLE_SELECTED: '',
  SUBTITLE_SELECTED: '',
  HOOK_SELECTED: '',
  LANDING_SELECTED: '',
  AI_GEN: false,
  SEO_TITLE: '',
  SEO_DESCRIPTION: '',
  SEO_SLUG: '',
  SEO_TAGS: [],
  created: '2026-06-09T00:00:00.000Z',
  updated: '2026-06-09T00:00:00.000Z',
};
```

- [ ] **Step 3: Run TypeScript check again to confirm clean**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (clean).

- [ ] **Step 4: Run tests**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/types/article.ts src/lib/services/files.ts src/lib/services/seo.test.ts
git commit -m "feat: add TITLE/SUBTITLE/HOOK/LANDING_SELECTED and AI_GEN to ArticleFrontmatter"
```

---

## Task 2: Parser — extract Alt block selections into _SELECTED YAML fields

**Files:**
- Modify: `src/lib/utils/frontmatter.ts`
- Modify: `src/lib/utils/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/utils/frontmatter.test.ts`:

```typescript
const SAMPLE_WITH_ALT_TITLE = `---
TITLE: "Partial Solution"
TITLE_SELECTED: ""
created: "2026-06-13"
---

## TITLE
Partial Solution

## Alt TITLE
1. Lady Justice has Lost Her Blindfold [✓]
2. Remove the Blindfold from Lady Justice

## HOOK
The oath was changed in 2002.
`;

const SAMPLE_WITH_MULTIPLE_ALTS = `---
TITLE: ""
TITLE_SELECTED: ""
HOOK_SELECTED: ""
created: "2026-06-13"
---

## TITLE
Original Title

## Alt TITLE
1. Option A
2. Option B [✓]

## HOOK
Short hook.

## Alt HOOK
1. Hook variant one [✓]
2. Hook variant two
`;

const SAMPLE_NO_ALT_SELECTED = `---
TITLE: "Test"
TITLE_SELECTED: ""
created: "2026-06-13"
---

## Alt TITLE
1. Option A
2. Option B
`;

describe('Alt block extraction', () => {
  it('extracts [✓]-marked Alt TITLE into TITLE_SELECTED', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_WITH_ALT_TITLE);
    expect(frontmatter.TITLE_SELECTED).toBe('Lady Justice has Lost Her Blindfold');
  });

  it('extracts multiple Alt selections independently', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_WITH_MULTIPLE_ALTS);
    expect(frontmatter.TITLE_SELECTED).toBe('Option B');
    expect(frontmatter.HOOK_SELECTED).toBe('Hook variant one');
  });

  it('leaves _SELECTED empty when no [✓] marker present', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_NO_ALT_SELECTED);
    expect(frontmatter.TITLE_SELECTED ?? '').toBe('');
  });

  it('strips the [✓] marker from extracted text', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_WITH_ALT_TITLE);
    expect(String(frontmatter.TITLE_SELECTED)).not.toContain('[✓]');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test -- --reporter=verbose 2>&1 | grep -A 3 "Alt block"
```

Expected: 4 failures.

- [ ] **Step 3: Implement Alt block extraction in frontmatter.ts**

Add after the `ARTICLE_SECTIONS` constant in `src/lib/utils/frontmatter.ts`:

```typescript
const ALT_SECTIONS = ['TITLE', 'SUBTITLE', 'HOOK', 'LANDING'] as const;
type AltSection = typeof ALT_SECTIONS[number];
type SelectedKey = `${AltSection}_SELECTED`;

const SELECTED_ITEM_RE = /^\d+\.\s+(.*?)\s*\[✓\]\s*$/m;

function extractAltSelections(body: string): Partial<Record<SelectedKey, string>> {
  const result: Partial<Record<SelectedKey, string>> = {};

  for (const section of ALT_SECTIONS) {
    const headingRe = new RegExp(`^##\\s+Alt\\s+${section}\\s*$`, 'im');
    const match = body.match(headingRe);
    if (!match || match.index === undefined) continue;

    const startIdx = match.index + match[0].length;
    const rest = body.substring(startIdx);
    const nextHeading = rest.match(/\n##\s/);
    const chunk = nextHeading ? rest.substring(0, nextHeading.index) : rest;

    const selected = chunk.match(SELECTED_ITEM_RE);
    if (selected) {
      result[`${section}_SELECTED`] = selected[1].trim();
    }
  }

  return result;
}
```

Then in `parseMarkdownFile`, after the existing section extraction block (the `for (const section of ARTICLE_SECTIONS)` loop), add:

```typescript
  // Extract Alt block selections
  const altSelections = extractAltSelections(body);
  for (const [key, value] of Object.entries(altSelections)) {
    if (!frontmatter[key] || frontmatter[key] === '') {
      frontmatter[key] = value;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test -- --reporter=verbose 2>&1 | grep -A 3 "Alt block"
```

Expected: 4 passing.

- [ ] **Step 5: Run full test suite**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/frontmatter.ts src/lib/utils/frontmatter.test.ts
git commit -m "feat: parser extracts [✓]-marked Alt block selections into _SELECTED YAML fields"
```

---

## Task 3: Parser — HOOK length warning + export runBodyParser()

**Files:**
- Modify: `src/lib/utils/frontmatter.ts`
- Modify: `src/lib/utils/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/utils/frontmatter.test.ts`:

```typescript
const LONG_HOOK_BODY = `## HOOK
${Array(155).fill('word').join(' ')}
`;

const SHORT_HOOK_BODY = `## HOOK
Short hook paragraph.
`;

describe('HOOK length warning', () => {
  it('sets HOOK_WARNING when HOOK exceeds 150 words', () => {
    const { hookWarning } = parseMarkdownFile(LONG_HOOK_BODY);
    expect(hookWarning).toBe(true);
  });

  it('does not set HOOK_WARNING for short HOOK', () => {
    const { hookWarning } = parseMarkdownFile(SHORT_HOOK_BODY);
    expect(hookWarning).toBe(false);
  });
});

describe('runBodyParser', () => {
  it('returns updated frontmatter with Alt selections applied', () => {
    const fm: ArticleFrontmatter = {
      ...{ IMAGE: '', SPARK: '', TITLE: '', SUBTITLE: '', HOOK: '',
           LANDING: '', TITLE_SELECTED: '', SUBTITLE_SELECTED: '',
           HOOK_SELECTED: '', LANDING_SELECTED: '', AI_GEN: false,
           SEO_TITLE: '', SEO_DESCRIPTION: '', SEO_SLUG: '', SEO_TAGS: [],
           created: '2026-06-13', updated: '2026-06-13' },
    };
    const body = `## TITLE\nMy Title\n\n## Alt TITLE\n1. Better Title [✓]\n2. Other`;
    const result = runBodyParser(fm, body);
    expect(result.TITLE).toBe('My Title');
    expect(result.TITLE_SELECTED).toBe('Better Title');
  });
});
```

Add `import type { ArticleFrontmatter } from '$lib/types/article';` to the test file imports and add `runBodyParser` to the import from `./frontmatter`.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test -- --reporter=verbose 2>&1 | grep -E "(HOOK length|runBodyParser|FAIL)"
```

Expected: failures for `hookWarning` and `runBodyParser`.

- [ ] **Step 3: Implement HOOK warning and runBodyParser**

In `src/lib/utils/frontmatter.ts`:

First, extend `ParsedMarkdown` to include `hookWarning`:

```typescript
export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
  fieldOrder: string[];
  hasFrontmatter: boolean;
  removedArtifacts: boolean;
  hookWarning: boolean;
}
```

Add a word-count helper:

```typescript
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
```

In `parseMarkdownFile`, after extracting `frontmatter.HOOK`, compute the warning:

```typescript
  const hookText = typeof frontmatter.HOOK === 'string' ? frontmatter.HOOK : '';
  const hookWarning = hookText ? wordCount(hookText) > 150 : false;

  return {
    frontmatter,
    body,
    fieldOrder,
    hasFrontmatter: Boolean(match),
    removedArtifacts: cleaned.removed,
    hookWarning,
  };
```

Add the exported `runBodyParser` function at the bottom of `frontmatter.ts`:

```typescript
import type { ArticleFrontmatter } from '$lib/types/article';

/**
 * Re-parses body sections and Alt block selections into frontmatter.
 * Called on every Save and every Preview activation.
 * Does not touch SEO_*, IMAGE, or AI_GEN fields.
 * Updates `updated` timestamp.
 */
export function runBodyParser(
  frontmatter: ArticleFrontmatter,
  body: string,
): ArticleFrontmatter {
  const now = new Date().toISOString();
  const updated = { ...frontmatter, updated: now };

  // Extract primary sections (only overwrites if body has content and YAML field is empty)
  for (const section of ARTICLE_SECTIONS) {
    const extracted = extractSection(body, section);
    if (extracted) {
      updated[section] = extracted;
    }
  }

  // Extract Alt selections (always overwrites — selection is the canonical state)
  const altSelections = extractAltSelections(body);
  for (const [key, value] of Object.entries(altSelections)) {
    (updated as Record<string, unknown>)[key] = value;
  }

  // Clear _SELECTED fields for Alt blocks that no longer have a [✓] marker
  for (const section of ALT_SECTIONS) {
    const key = `${section}_SELECTED` as SelectedKey;
    if (!(key in altSelections)) {
      updated[key] = '';
    }
  }

  return updated;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/frontmatter.ts src/lib/utils/frontmatter.test.ts
git commit -m "feat: HOOK word-count warning and runBodyParser() export"
```

---

## Task 4: YAML panel — fully read-only with AI_GEN checkbox

**Files:**
- Modify: `src/lib/components/yaml/FieldFree.svelte`
- Modify: `src/lib/components/yaml/YamlPanel.svelte`

- [ ] **Step 1: Add `readonly` prop to FieldFree**

Replace `src/lib/components/yaml/FieldFree.svelte` with:

```svelte
<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let {
    label,
    field,
    type = 'text',
    rows = 2,
    readonly = false,
  }: {
    label: string;
    field: keyof ArticleFrontmatter;
    type?: 'text' | 'textarea';
    rows?: number;
    readonly?: boolean;
  } = $props();

  let inputId = $derived(`field-free-${field.toLowerCase().replaceAll('_', '-')}`);
  let value = $derived(String(documentStore.frontmatter?.[field] ?? ''));

  function update(val: string) {
    if (readonly) return;
    documentStore.patchField(field, val);
  }
</script>

<div class="flex flex-col gap-0.5">
  <label for={inputId} class="text-xs font-medium text-dark-300 uppercase tracking-wide">{label}</label>
  {#if type === 'textarea'}
    <textarea
      id={inputId}
      {rows}
      {value}
      {readonly}
      oninput={(e) => update((e.target as HTMLTextAreaElement).value)}
      class="text-sm border border-dark-600 rounded px-2 py-1 resize-none {readonly ? 'opacity-60 cursor-default bg-dark-800' : ''}"
    ></textarea>
  {:else}
    <input
      id={inputId}
      type="text"
      {value}
      {readonly}
      oninput={(e) => update((e.target as HTMLInputElement).value)}
      class="text-sm border border-dark-600 rounded px-2 py-1 {readonly ? 'opacity-60 cursor-default bg-dark-800' : ''}"
    />
  {/if}
</div>
```

- [ ] **Step 2: Rewrite YamlPanel to be fully read-only**

Replace `src/lib/components/yaml/YamlPanel.svelte` with:

```svelte
<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import FieldFree from './FieldFree.svelte';
  import FieldReadonly from './FieldReadonly.svelte';
  import FieldTags from './FieldTags.svelte';

  let fm = $derived(documentStore.frontmatter);
  let hookWarning = $derived(documentStore.hookWarning);

  function toggleAiGen() {
    if (!fm) return;
    documentStore.patchField('AI_GEN', !fm.AI_GEN);
  }
</script>

{#if !fm}
  <div class="p-4 text-sm text-dark-400">No file open.</div>
{:else}
  <div class="flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm">

    <!-- Metadata -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Metadata</h3>
      <div class="grid grid-cols-2 gap-2">
        <FieldReadonly label="Created" value={fm.created} />
        <FieldReadonly label="Updated" value={fm.updated} />
      </div>
    </section>

    <!-- Article Structure (all read-only) -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">Article Structure</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="Hero Image" field="IMAGE" type="text" readonly />
        <FieldFree label="Spark" field="SPARK" type="textarea" rows={3} readonly />
        <FieldFree label="Title" field="TITLE" type="textarea" rows={2} readonly />
        {#if fm.TITLE_SELECTED}
          <FieldFree label="Title (selected alt)" field="TITLE_SELECTED" type="textarea" rows={2} readonly />
        {/if}
        <FieldFree label="Subtitle" field="SUBTITLE" type="textarea" rows={2} readonly />
        {#if fm.SUBTITLE_SELECTED}
          <FieldFree label="Subtitle (selected alt)" field="SUBTITLE_SELECTED" type="textarea" rows={2} readonly />
        {/if}
        <div>
          <FieldFree label="Hook" field="HOOK" type="textarea" rows={3} readonly />
          {#if hookWarning}
            <p class="text-xs text-amber-400 mt-1">⚠ Hook exceeds 150 words — keep it short and sharp.</p>
          {/if}
        </div>
        {#if fm.HOOK_SELECTED}
          <FieldFree label="Hook (selected alt)" field="HOOK_SELECTED" type="textarea" rows={3} readonly />
        {/if}
        <FieldFree label="Landing" field="LANDING" type="textarea" rows={3} readonly />
        {#if fm.LANDING_SELECTED}
          <FieldFree label="Landing (selected alt)" field="LANDING_SELECTED" type="textarea" rows={3} readonly />
        {/if}
      </div>
    </section>

    <!-- SEO (read-only, AI-populated at Publish) -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">SEO</h3>
      <div class="flex flex-col gap-3">
        {#if fm.SEO_TITLE || fm.SEO_DESCRIPTION || fm.SEO_SLUG || fm.SEO_TAGS.length > 0}
          <FieldFree label="SEO Title" field="SEO_TITLE" type="textarea" rows={2} readonly />
          <FieldFree label="SEO Description" field="SEO_DESCRIPTION" type="textarea" rows={3} readonly />
          <FieldFree label="SEO Slug" field="SEO_SLUG" type="text" readonly />
          <FieldTags label="SEO Tags" field="SEO_TAGS" />
        {:else}
          <p class="text-xs text-dark-500 italic">SEO fields are generated automatically at Publish.</p>
        {/if}
      </div>
    </section>

    <!-- AI-GEN mode toggle -->
    <section class="border-t border-dark-700 pt-4">
      <button
        onclick={toggleAiGen}
        class="flex items-center gap-2 text-xs text-dark-300 hover:text-dark-100"
        title="Generative: AI fills gaps and adds Alts. Rescan: AI reviews existing content and adds Alts only."
      >
        <span class="w-4 h-4 border border-dark-500 rounded flex items-center justify-center text-[10px]">
          {fm.AI_GEN ? '✓' : ''}
        </span>
        AI-GEN {fm.AI_GEN ? '(generative)' : '(rescan)'}
      </button>
    </section>

  </div>
{/if}
```

- [ ] **Step 3: Make FieldTags read-only in Draft mode**

The `FieldTags` component currently allows editing. Since SEO_TAGS are AI-generated and read-only, update `src/lib/components/yaml/FieldTags.svelte` to be display-only (replace the `<input>` with a `<div>`):

```svelte
<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let { label, field }: { label: string; field: keyof ArticleFrontmatter } = $props();

  let tags = $derived(() => {
    const value = documentStore.frontmatter?.[field];
    return Array.isArray(value) ? value as string[] : [];
  });
</script>

<div class="flex flex-col gap-0.5">
  <span class="text-xs font-medium text-dark-300 uppercase tracking-wide">{label}</span>
  {#if tags().length > 0}
    <div class="flex flex-wrap gap-1 mt-1">
      {#each tags() as tag}
        <span class="text-xs bg-dark-700 text-dark-300 rounded px-2 py-0.5">{tag}</span>
      {/each}
    </div>
  {:else}
    <span class="text-xs text-dark-500 italic">None yet</span>
  {/if}
</div>
```

- [ ] **Step 4: Add `hookWarning` getter to document store**

In `src/lib/stores/document.svelte.ts`, add to the `DocumentStore` class after the `wordCount` getter:

```typescript
  get hookWarning(): boolean {
    const hook = this._tabs[this._activeIndex].frontmatter?.HOOK ?? '';
    if (!hook.trim()) return false;
    return hook.trim().split(/\s+/).filter(Boolean).length > 150;
  }
```

- [ ] **Step 5: Verify app compiles**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/yaml/YamlPanel.svelte src/lib/components/yaml/FieldFree.svelte src/lib/components/yaml/FieldTags.svelte src/lib/stores/document.svelte.ts
git commit -m "feat: YAML panel is fully read-only with AI_GEN toggle and HOOK warning"
```

---

## Task 5: Document store — phase getter and Alt selection write-back

**Files:**
- Modify: `src/lib/stores/document.svelte.ts`
- Modify: `src/lib/stores/document.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/lib/stores/document.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { documentStore } from './document.svelte';
import type { ArticleFrontmatter } from '$lib/types/article';

const BASE_FM: ArticleFrontmatter = {
  IMAGE: '', SPARK: '', TITLE: '', SUBTITLE: '', HOOK: '', LANDING: '',
  TITLE_SELECTED: '', SUBTITLE_SELECTED: '', HOOK_SELECTED: '', LANDING_SELECTED: '',
  AI_GEN: false,
  SEO_TITLE: '', SEO_DESCRIPTION: '', SEO_SLUG: '', SEO_TAGS: [],
  created: '2026-06-13', updated: '2026-06-13',
};

describe('documentStore.phase', () => {
  beforeEach(() => documentStore.reset());

  it('returns "draft" when no file is open', () => {
    expect(documentStore.phase).toBe('draft');
  });

  it('returns "draft" for a normal manuscript path', () => {
    documentStore.load(BASE_FM, '', [], null, '/vault/A_foo/A_foo.md');
    expect(documentStore.phase).toBe('draft');
  });

  it('returns "final" when the file path ends with _final.md', () => {
    documentStore.load(BASE_FM, '', [], null, '/vault/A_foo/A_foo_final.md');
    expect(documentStore.phase).toBe('final');
  });
});

describe('documentStore.setAltSelection', () => {
  beforeEach(() => documentStore.reset());

  it('updates the _SELECTED field and marks dirty', () => {
    documentStore.load({ ...BASE_FM, TITLE: 'Original' }, '', [], null, '/foo.md');
    documentStore.setAltSelection('TITLE', 'Better Title');
    expect(documentStore.frontmatter?.TITLE_SELECTED).toBe('Better Title');
    expect(documentStore.dirty).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test -- --reporter=verbose 2>&1 | grep -E "(phase|setAltSelection|FAIL)"
```

Expected: failures on `phase` and `setAltSelection`.

- [ ] **Step 3: Implement in document store**

In `src/lib/stores/document.svelte.ts`, add to the `DocumentStore` class:

```typescript
  get phase(): 'draft' | 'final' {
    const path = this._tabs[this._activeIndex].filePath ?? '';
    return path.endsWith('_final.md') ? 'final' : 'draft';
  }

  setAltSelection(section: 'TITLE' | 'SUBTITLE' | 'HOOK' | 'LANDING', text: string): void {
    const key = `${section}_SELECTED` as keyof ArticleFrontmatter;
    this.patchField(key, text);
  }
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/document.svelte.ts src/lib/stores/document.test.ts
git commit -m "feat: document store phase getter and setAltSelection method"
```

---

## Task 6: Manuscript utility — preview renderer, promotion builder, promotion gate

**Files:**
- Create: `src/lib/utils/manuscript.ts`
- Create: `src/lib/utils/manuscript.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/utils/manuscript.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderForPreview, renderForPromotion, checkPromotionGate } from './manuscript';
import type { ArticleFrontmatter } from '$lib/types/article';

const BASE_FM: ArticleFrontmatter = {
  IMAGE: '', SPARK: 'Raw idea seed.',
  TITLE: 'Partial Solution', SUBTITLE: 'What impartiality looks like.',
  HOOK: 'In 2002 the oath changed.', LANDING: 'Read the small print.',
  TITLE_SELECTED: '', SUBTITLE_SELECTED: '', HOOK_SELECTED: '', LANDING_SELECTED: '',
  AI_GEN: false,
  SEO_TITLE: '', SEO_DESCRIPTION: '', SEO_SLUG: '', SEO_TAGS: [],
  created: '2026-06-13', updated: '2026-06-13',
};

const BODY_WITH_ALTS = `## SPARK
Raw idea seed.

## TITLE
Partial Solution

## Alt TITLE
1. Lady Justice has Lost Her Blindfold [✓]
2. Remove the Blindfold

## SUBTITLE
What impartiality looks like.

## HOOK
In 2002 the oath changed.

## CONTEXT
Partiality is easy to spot.

[SCAFFOLD: verify 2002 date]

## Bad Seed
Men like Weinstein.

[CHECK: court records]

## LANDING
Read the small print.
`;

describe('renderForPreview', () => {
  it('includes SPARK as separate spark text', () => {
    const result = renderForPreview(BODY_WITH_ALTS, { ...BASE_FM, TITLE_SELECTED: 'Lady Justice has Lost Her Blindfold' });
    expect(result.spark).toBe('Raw idea seed.');
  });

  it('strips section headings from prose sections', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.prose).not.toContain('## CONTEXT');
    expect(result.prose).not.toContain('## Bad Seed');
  });

  it('strips scaffold annotations', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.prose).not.toContain('[SCAFFOLD:');
    expect(result.prose).not.toContain('[CHECK:');
  });

  it('strips Alt block headings and items', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.prose).not.toContain('## Alt TITLE');
    expect(result.prose).not.toContain('Lady Justice has Lost Her Blindfold');
    expect(result.prose).not.toContain('Remove the Blindfold');
  });

  it('preserves body prose', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.prose).toContain('Partiality is easy to spot.');
    expect(result.prose).toContain('Men like Weinstein.');
  });

  it('returns Alt blocks for interactive display', () => {
    const result = renderForPreview(BODY_WITH_ALTS, BASE_FM);
    expect(result.altBlocks).toHaveLength(1);
    expect(result.altBlocks[0].section).toBe('TITLE');
    expect(result.altBlocks[0].items).toHaveLength(2);
    expect(result.altBlocks[0].items[0].selected).toBe(true);
    expect(result.altBlocks[0].items[0].text).toBe('Lady Justice has Lost Her Blindfold');
  });
});

describe('renderForPromotion', () => {
  it('excludes SPARK from promotion output', () => {
    const result = renderForPromotion(BODY_WITH_ALTS, BASE_FM);
    expect(result).not.toContain('Raw idea seed.');
  });

  it('strips all headings and annotations', () => {
    const result = renderForPromotion(BODY_WITH_ALTS, BASE_FM);
    expect(result).not.toContain('##');
    expect(result).not.toContain('[SCAFFOLD:');
    expect(result).not.toContain('[CHECK:');
  });

  it('preserves body prose in order', () => {
    const result = renderForPromotion(BODY_WITH_ALTS, BASE_FM);
    expect(result).toContain('Partiality is easy to spot.');
    expect(result).toContain('Men like Weinstein.');
    const ctxIdx = result.indexOf('Partiality is easy to spot.');
    const seedIdx = result.indexOf('Men like Weinstein.');
    expect(ctxIdx).toBeLessThan(seedIdx);
  });

  it('uses TITLE_SELECTED when set, otherwise TITLE', () => {
    const withSelected = { ...BASE_FM, TITLE_SELECTED: 'Lady Justice has Lost Her Blindfold' };
    expect(renderForPromotion(BODY_WITH_ALTS, withSelected)).toContain('Lady Justice has Lost Her Blindfold');
    expect(renderForPromotion(BODY_WITH_ALTS, BASE_FM)).not.toContain('Lady Justice has Lost Her Blindfold');
  });
});

describe('checkPromotionGate', () => {
  const FULL_BODY = `## HOOK\nHook.\n\n${Array(20).fill('Body word').join(' ')}\n\n## LANDING\nLanding.\n`;

  it('passes when SPINE is complete and body has 100+ words', () => {
    const fm = { ...BASE_FM };
    const body = `## HOOK\nHook text.\n\n${Array(110).fill('word').join(' ')}\n\n## LANDING\nLanding.\n`;
    const result = checkPromotionGate(fm, body);
    expect(result.canPromote).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('fails when TITLE is empty', () => {
    const result = checkPromotionGate({ ...BASE_FM, TITLE: '' }, FULL_BODY);
    expect(result.canPromote).toBe(false);
    expect(result.missing.some(m => m.includes('TITLE'))).toBe(true);
  });

  it('fails when body word count is below 100', () => {
    const body = `## HOOK\nHook.\n\n${Array(10).fill('word').join(' ')}\n\n## LANDING\nLanding.\n`;
    const result = checkPromotionGate(BASE_FM, body);
    expect(result.canPromote).toBe(false);
    expect(result.missing.some(m => m.includes('100 words'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failures**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test -- --reporter=verbose 2>&1 | grep -E "(manuscript|renderFor|checkPromotion|FAIL)" | head -20
```

Expected: all 14 tests fail (module not found).

- [ ] **Step 3: Implement manuscript.ts**

Create `src/lib/utils/manuscript.ts`:

```typescript
import type { ArticleFrontmatter } from '$lib/types/article';

export interface AltItem {
  text: string;
  selected: boolean;
}

export interface AltBlock {
  section: 'TITLE' | 'SUBTITLE' | 'HOOK' | 'LANDING';
  items: AltItem[];
}

export interface PreviewResult {
  spark: string;
  prose: string;
  altBlocks: AltBlock[];
}

export interface PromotionGate {
  canPromote: boolean;
  missing: string[];
}

const SCAFFOLD_RE = /\[(?:SCAFFOLD|CHECK|IMAGE):[^\]]*\]/g;
const ALT_SECTION_NAMES = ['TITLE', 'SUBTITLE', 'HOOK', 'LANDING'] as const;
type SpineSection = typeof ALT_SECTION_NAMES[number];

function stripScaffold(text: string): string {
  return text.replace(SCAFFOLD_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

interface BodyChunk {
  heading: string | null;  // null for content before first heading
  content: string;
}

function splitByHeadings(body: string): BodyChunk[] {
  const lines = body.split('\n');
  const chunks: BodyChunk[] = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      chunks.push({ heading: currentHeading, content: currentLines.join('\n').trim() });
      currentHeading = headingMatch[1].trim();
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  chunks.push({ heading: currentHeading, content: currentLines.join('\n').trim() });

  return chunks.filter(c => c.heading !== null || c.content);
}

function isAltBlock(heading: string): boolean {
  return /^Alt\s+(TITLE|SUBTITLE|HOOK|LANDING)$/i.test(heading);
}

function isSpineSection(heading: string): heading is SpineSection {
  return ['SPARK', 'TITLE', 'SUBTITLE', 'HOOK', 'LANDING'].includes(heading.toUpperCase());
}

function parseAltItems(content: string): AltItem[] {
  const lines = content.split('\n');
  return lines
    .map(line => line.match(/^\d+\.\s+(.*?)(\s*\[✓\])?\s*$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map(m => ({ text: m[1].trim(), selected: Boolean(m[2]) }));
}

function spineText(field: SpineSection, frontmatter: ArticleFrontmatter): string {
  const selected = frontmatter[`${field}_SELECTED` as keyof ArticleFrontmatter] as string;
  const primary = frontmatter[field] as string;
  return (selected?.trim() ? selected : primary) ?? '';
}

export function renderForPreview(body: string, frontmatter: ArticleFrontmatter): PreviewResult {
  const chunks = splitByHeadings(body);
  const altBlocks: AltBlock[] = [];
  const proseChunks: string[] = [];
  let inBody = false;

  for (const chunk of chunks) {
    const heading = chunk.heading?.trim() ?? '';
    const upper = heading.toUpperCase();

    if (upper === 'SPARK') continue; // handled separately

    if (isAltBlock(heading)) {
      // Parse Alt items for interactive display, don't add to prose
      const sectionMatch = heading.match(/^Alt\s+(TITLE|SUBTITLE|HOOK|LANDING)$/i);
      if (sectionMatch) {
        altBlocks.push({
          section: sectionMatch[1].toUpperCase() as SpineSection,
          items: parseAltItems(chunk.content),
        });
      }
      continue;
    }

    if (upper === 'HOOK') { inBody = true; }
    if (upper === 'LANDING') { inBody = false; }

    if (isSpineSection(heading)) {
      // SPINE sections: use selected alt if available
      if (upper !== 'SPARK') {
        const text = spineText(upper as SpineSection, frontmatter);
        if (text) proseChunks.push(stripScaffold(text));
      }
      continue;
    }

    // Free body section
    if (inBody && chunk.content) {
      proseChunks.push(stripScaffold(chunk.content));
    }
  }

  const sparkChunk = chunks.find(c => c.heading?.trim().toUpperCase() === 'SPARK');
  const spark = stripScaffold(sparkChunk?.content ?? frontmatter.SPARK ?? '');

  return {
    spark,
    prose: proseChunks.filter(Boolean).join('\n\n'),
    altBlocks,
  };
}

export function renderForPromotion(body: string, frontmatter: ArticleFrontmatter): string {
  const { prose } = renderForPreview(body, frontmatter);
  return prose;
}

function countBodyWords(body: string): number {
  const chunks = splitByHeadings(body);
  let inBody = false;
  let words = 0;

  for (const chunk of chunks) {
    const upper = (chunk.heading?.trim() ?? '').toUpperCase();
    if (upper === 'HOOK') { inBody = true; continue; }
    if (upper === 'LANDING') { inBody = false; continue; }
    if (isAltBlock(chunk.heading ?? '') || isSpineSection(chunk.heading ?? '')) continue;

    if (inBody && chunk.content) {
      words += chunk.content.trim().split(/\s+/).filter(Boolean).length;
    }
  }
  return words;
}

export function checkPromotionGate(frontmatter: ArticleFrontmatter, body: string): PromotionGate {
  const missing: string[] = [];

  if (!frontmatter.TITLE.trim()) missing.push('TITLE is empty');
  if (!frontmatter.SUBTITLE.trim()) missing.push('SUBTITLE is empty');
  if (!frontmatter.HOOK.trim()) missing.push('HOOK is empty');
  if (!frontmatter.LANDING.trim()) missing.push('LANDING is empty');

  const bodyWords = countBodyWords(body);
  if (bodyWords < 100) missing.push(`Body has fewer than 100 words (${bodyWords} found)`);

  return { canPromote: missing.length === 0, missing };
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/manuscript.ts src/lib/utils/manuscript.test.ts
git commit -m "feat: manuscript utility — renderForPreview, renderForPromotion, checkPromotionGate"
```

---

## Task 7: PreviewPanel component

**Files:**
- Create: `src/lib/components/editor/PreviewPanel.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/editor/PreviewPanel.svelte`:

```svelte
<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import { renderForPreview } from '$lib/utils/manuscript';
  import { runBodyParser } from '$lib/utils/frontmatter';
  import type { AltBlock } from '$lib/utils/manuscript';

  let preview = $derived.by(() => {
    const fm = documentStore.frontmatter;
    const body = documentStore.body;
    if (!fm) return null;
    // Run parser in-memory to get latest _SELECTED fields
    const parsed = runBodyParser(fm, body);
    return renderForPreview(body, parsed);
  });

  function selectAlt(section: AltBlock['section'], text: string) {
    // Update the [✓] marker in the body
    const body = documentStore.body;
    const altHeadingRe = new RegExp(`(## Alt ${section}[^\\n]*)\\n([\\s\\S]*?)(?=\\n##|$)`, 'i');
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

    <!-- Alt blocks (interactive) -->
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/editor/PreviewPanel.svelte
git commit -m "feat: PreviewPanel component — reader's eye view with Alt radio buttons and SPARK callout"
```

---

## Task 8: Wire Editor + Preview as tabs and run body parser on Save

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Add `activeEditorTab` state and wire Preview**

In `src/App.svelte`, add to the `<script>` block:

```typescript
import PreviewPanel from '$lib/components/editor/PreviewPanel.svelte';
import { runBodyParser } from '$lib/utils/frontmatter';

let activeEditorTab = $state<'editor' | 'preview'>('editor');
```

Replace the `getFrontmatterForSave` function:

```typescript
function getFrontmatterForSave(): ArticleFrontmatter {
  const fm = documentStore.frontmatter || FRONTMATTER_DEFAULTS;
  return runBodyParser(fm, documentStore.body);
}
```

- [ ] **Step 2: Replace the editor area in the template**

Find the `<!-- Main area -->` section and replace the editor `<div>`:

```svelte
<!-- Main area -->
<div class="flex flex-1 min-h-0">
  <!-- Editor area with Preview tab -->
  <div class="flex-1 min-w-0 flex flex-col">
    <!-- Editor/Preview tab bar (Draft mode only) -->
    {#if documentStore.phase === 'draft'}
      <div class="flex items-center border-b border-dark-700 bg-dark-800 px-2 shrink-0">
        <button
          onclick={() => activeEditorTab = 'editor'}
          class="px-4 py-2 text-sm border-b-2 {activeEditorTab === 'editor'
            ? 'border-primary-400 text-dark-100'
            : 'border-transparent text-dark-400 hover:text-dark-200'}"
        >
          Editor
        </button>
        <button
          onclick={() => { activeEditorTab = 'preview'; }}
          class="px-4 py-2 text-sm border-b-2 {activeEditorTab === 'preview'
            ? 'border-primary-400 text-dark-100'
            : 'border-transparent text-dark-400 hover:text-dark-200'}"
        >
          Preview
        </button>
      </div>
    {:else}
      <!-- Final Draft mode: label only, no tabs -->
      <div class="flex items-center border-b border-dark-700 bg-dark-800 px-4 py-2 shrink-0">
        <span class="text-xs text-amber-400 font-semibold uppercase tracking-wide">Final Draft</span>
      </div>
    {/if}

    <!-- Content area -->
    {#if activeEditorTab === 'editor' || documentStore.phase === 'final'}
      <Editor />
    {:else}
      <PreviewPanel />
    {/if}
  </div>

  <!-- Right sidebar (existing code unchanged) -->
  ...
</div>
```

- [ ] **Step 3: Reset to editor tab when switching documents**

Add to the `$effect` that watches `documentStore.loadVersion`:

```typescript
  $effect(() => {
    // Reset to editor tab on document load
    documentStore.loadVersion; // reactive dependency
    activeEditorTab = 'editor';
  });
```

- [ ] **Step 4: Verify app compiles and Preview tab appears**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -20
```

Open the app (`npm run dev` or Tauri dev), open an article, confirm Editor and Preview tabs appear. Click Preview — confirm SPARK callout appears and body prose renders without section headings.

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte
git commit -m "feat: Editor/Preview tab bar in Draft mode; runBodyParser on every Save"
```

---

## Task 9: WorkflowTimeline component + YAML panel toggle

**Files:**
- Create: `src/lib/components/WorkflowTimeline.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Create WorkflowTimeline**

Create `src/lib/components/WorkflowTimeline.svelte`:

```svelte
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

<div class="flex items-center justify-between px-4 py-1.5 border-b border-dark-700 bg-dark-900 shrink-0 text-[11px]">

  <!-- Timeline -->
  <div class="flex items-center gap-0 flex-1 justify-center">

    <!-- SPARK -->
    <span class="text-dark-500">SPARK</span>
    <span class="w-6 h-px bg-dark-600 mx-1.5 inline-block"></span>

    <!-- DRAFT | PREVIEW bracket -->
    <span class="border border-dark-600 rounded px-2 py-0.5 flex items-center gap-1.5
      {phase === 'draft' ? 'border-green-700 text-green-400' : 'text-dark-600'}">
      <span>DRAFT</span>
      <span class="text-dark-600">|</span>
      <button
        onclick={onOpenPreview}
        class="text-blue-400 hover:text-blue-300 hover:underline {phase !== 'draft' ? 'pointer-events-none opacity-40' : ''}"
      >
        PREVIEW ↗
      </button>
    </span>

    <span class="w-6 h-px {phase === 'final' ? 'bg-green-700' : 'bg-dark-600'} mx-1.5 inline-block"></span>

    <!-- FINAL DRAFT -->
    <span class="{phase === 'final' ? 'font-semibold text-amber-400 border border-amber-700 rounded px-2 py-0.5' : 'text-dark-600'}">
      FINAL DRAFT
    </span>

    <span class="w-6 h-px bg-dark-600 mx-1.5 inline-block"></span>

    <!-- PUBLISHED (future) -->
    <span class="text-dark-600">PUBLISHED</span>

  </div>

  <!-- Right controls: YAML toggle + cog -->
  <div class="flex items-center gap-1.5 ml-4">

    <!-- YAML panel toggle: hollow = hidden, filled-right = visible -->
    <button
      onclick={onToggleYaml}
      title={yamlVisible ? 'Hide YAML panel' : 'Show YAML panel'}
      class="w-6 h-5 border rounded flex items-center justify-center relative overflow-hidden
        {yamlVisible ? 'border-dark-300' : 'border-dark-600'}"
    >
      {#if yamlVisible}
        <!-- Filled right portion -->
        <span class="absolute right-0 top-0 bottom-0 w-[40%] bg-dark-300 opacity-40"></span>
        <span class="absolute right-[40%] top-[2px] bottom-[2px] w-px bg-dark-300 opacity-50"></span>
      {/if}
    </button>

    <!-- Cog -->
    <button onclick={onOpenSettings} class="text-dark-500 hover:text-dark-300 text-base leading-none">⚙</button>

  </div>

</div>
```

- [ ] **Step 2: Wire WorkflowTimeline into App.svelte**

In `src/App.svelte`, add:
```typescript
import WorkflowTimeline from '$lib/components/WorkflowTimeline.svelte';
```

Replace the existing `<header>` with a simplified version (remove the gear icon from the header since it moves to the timeline) and add the timeline between the header and main area. In the timeline, pass:

```svelte
<WorkflowTimeline
  phase={documentStore.phase}
  yamlVisible={!yamlCollapsed && settingsStore.sidebarVisible}
  onToggleYaml={() => {
    if (!settingsStore.sidebarVisible) {
      settingsStore.toggleSidebar();
      yamlCollapsed = false;
    } else {
      yamlCollapsed = !yamlCollapsed;
    }
  }}
  onOpenPreview={() => { activeEditorTab = 'preview'; }}
  onOpenSettings={() => { showSettings = true; }}
/>
```

- [ ] **Step 3: Verify TypeScript and visual result**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -20
```

Open the app, confirm the timeline strip renders below the header. Confirm PREVIEW ↗ navigates to Preview tab. Confirm the YAML toggle icon switches between hollow and filled-right states.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/WorkflowTimeline.svelte src/App.svelte
git commit -m "feat: WorkflowTimeline strip with YAML panel toggle and PREVIEW link"
```

---

## Task 10: Promotion gate + action (write _final.md, switch to Final Draft mode)

**Files:**
- Modify: `src/lib/services/files.ts`
- Modify: `src/App.svelte`

- [ ] **Step 1: Add writeFilePath to files.ts**

Add to `src/lib/services/files.ts` (no dialog, no recent-files side-effect — used for `_final.md` writes):

```typescript
export async function writeFilePath(filePath: string, content: string): Promise<void> {
  await invoke('write_markdown_file', { filePath, content });
}
```

- [ ] **Step 2: Add promotion handler to App.svelte**

Add to the `<script>` block in `src/App.svelte`:

```typescript
import { checkPromotionGate, renderForPromotion } from '$lib/utils/manuscript';
import { writeFilePath } from '$lib/services/files';
import { serializeArticleFile } from '$lib/utils/frontmatter';

let promotionLoading = $state(false);

function getManuscriptFinalPath(): string | null {
  const path = documentStore.filePath;
  if (!path) return null;
  // A_slug/A_slug.md → A_slug/A_slug_final.md
  return path.replace(/\.md$/, '_final.md');
}

async function handlePromote() {
  if (promotionLoading) return;
  const fm = documentStore.frontmatter;
  const body = documentStore.body;
  if (!fm) return;

  const finalPath = getManuscriptFinalPath();
  if (!finalPath) {
    alert('Save the manuscript before promoting to Final Draft.');
    return;
  }

  const gate = checkPromotionGate(fm, body);
  if (!gate.canPromote) {
    alert('Cannot promote to Final Draft:\n\n' + gate.missing.join('\n'));
    return;
  }

  if (!window.confirm('Promote to Final Draft? The manuscript will be frozen.')) return;

  promotionLoading = true;
  try {
    // Run parser one final time
    const parsedFm = runBodyParser(fm, body);
    // Build clean prose
    const prose = renderForPromotion(body, parsedFm);
    // Write _final.md with SPINE frontmatter only
    const finalFm: ArticleFrontmatter = {
      ...parsedFm,
      SEO_TITLE: '', SEO_DESCRIPTION: '', SEO_SLUG: '', SEO_TAGS: [],
    };
    const content = serializeArticleFile(finalFm, FRONTMATTER_FIELD_ORDER.map(String), prose);
    await writeFilePath(finalPath, content);
    // Switch editor to _final.md
    documentStore.load(finalFm, prose, FRONTMATTER_FIELD_ORDER.map(String), null, finalPath);
    activeEditorTab = 'editor';
  } catch (e) {
    alert('Promotion failed: ' + (e instanceof Error ? e.message : e));
  } finally {
    promotionLoading = false;
  }
}
```

- [ ] **Step 3: Add [→ Final Draft] button to the header**

In the header buttons area in `src/App.svelte`, add after the Save As button:

```svelte
{#if documentStore.phase === 'draft' && documentStore.filePath}
  {@const gate = documentStore.frontmatter
    ? checkPromotionGate(documentStore.frontmatter, documentStore.body)
    : { canPromote: false, missing: ['No file open'] }}
  <button
    onclick={handlePromote}
    disabled={!gate.canPromote || promotionLoading}
    title={gate.canPromote ? 'Promote to Final Draft' : gate.missing.join('\n')}
    class="px-4 py-2.5 text-base border border-dark-600 rounded hover:bg-dark-700
      disabled:opacity-40 disabled:cursor-not-allowed"
  >
    {promotionLoading ? 'Promoting…' : '→ Final Draft'}
  </button>
{/if}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Manual test**

Open an article in the app. With SPINE incomplete, confirm the button is disabled and tooltip shows what's missing. Complete the SPINE fields in the editor body and Save. Confirm button enables. Click it, confirm `_final.md` is created in the same folder. Confirm the editor switches to `_final.md` and the timeline shows FINAL DRAFT.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/files.ts src/App.svelte
git commit -m "feat: promotion gate and action — writes _final.md and switches to Final Draft mode"
```

---

## Task 11: Final Draft mode — Restart action

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Add Restart Final Draft handler**

Add to `<script>` in `src/App.svelte`:

```typescript
async function handleRestartFinalDraft() {
  const finalPath = documentStore.filePath;
  if (!finalPath?.endsWith('_final.md')) return;

  if (!window.confirm(
    'Restart Final Draft?\n\nThis will discard all changes to the Final Draft. ' +
    'The manuscript is unchanged and will be re-opened.'
  )) return;

  const manuscriptPath = finalPath.replace(/_final\.md$/, '.md');

  try {
    // Delete _final.md
    await invoke('delete_file', { filePath: finalPath });
    // Re-open the manuscript
    const parsed = await openFilePath(manuscriptPath);
    documentStore.openInNewTab(parsed);
    activeEditorTab = 'editor';
  } catch (e) {
    alert('Restart failed: ' + (e instanceof Error ? e.message : e));
  }
}
```

- [ ] **Step 2: Add Restart button to Final Draft header**

In the header, add after the existing buttons:

```svelte
{#if documentStore.phase === 'final'}
  <button
    onclick={handleRestartFinalDraft}
    class="px-4 py-2.5 text-sm border border-amber-800 text-amber-500 rounded hover:bg-amber-900/20"
    title="Discard Final Draft and return to manuscript"
  >
    ↩ Restart
  </button>
{/if}
```

- [ ] **Step 3: Add delete_file Tauri command check**

The `delete_file` Tauri command must exist. Check:

```bash
grep -r "delete_file" /Users/chasnewport/Projects/StackEd2.0/src-tauri/src/
```

If it doesn't exist, add to `src-tauri/src/main.rs` (or `lib.rs`, wherever commands are registered):

```rust
#[tauri::command]
fn delete_file(file_path: String) -> Result<(), String> {
    std::fs::remove_file(&file_path).map_err(|e| e.to_string())
}
```

And register it in the builder. If the command already exists under a different name, use that name instead.

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src-tauri/src/
git commit -m "feat: Restart Final Draft action — deletes _final.md and re-opens manuscript"
```

---

## Task 12: SEO generation — Alt history in prompt, move to Publish step

**Files:**
- Modify: `src/lib/services/seo.ts`
- Modify: `src/lib/services/seo.test.ts`
- Modify: `src/App.svelte`

- [ ] **Step 1: Write failing test**

Add to `src/lib/services/seo.test.ts`:

```typescript
describe('buildSeoPrompt with Alt history', () => {
  it('includes Alt block evolution in the prompt', () => {
    const fm: ArticleFrontmatter = {
      ...BASE,
      TITLE: 'Partial Solution',
      TITLE_SELECTED: 'Lady Justice has Lost Her Blindfold',
    };
    const body = `## TITLE\nPartial Solution\n\n## Alt TITLE\n1. Lady Justice has Lost Her Blindfold [✓]\n2. Remove the Blindfold\n\n## HOOK\nThe oath changed.`;
    const prompt = buildSeoPrompt({
      frontmatter: fm,
      fieldOrder: ['TITLE', 'TITLE_SELECTED'],
      body,
      filePath: '/tmp/test.md',
    });
    expect(prompt).toContain('Lady Justice has Lost Her Blindfold');
    expect(prompt).toContain('Remove the Blindfold');
    expect(prompt).toContain('Alt TITLE');
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test -- --reporter=verbose 2>&1 | grep -A 3 "Alt history"
```

Expected: 1 failure (the test should fail because the prompt doesn't currently include Alt block content).

- [ ] **Step 3: Update buildSeoPrompt to include Alt history**

In `src/lib/services/seo.ts`, update `buildSeoPrompt` to extract and include Alt blocks from the body:

```typescript
function extractAltHistory(body: string): string {
  const altBlockRe = /^## Alt (TITLE|SUBTITLE|HOOK|LANDING)\s*$([\s\S]*?)(?=^##|\z)/gim;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = altBlockRe.exec(body)) !== null) {
    blocks.push(`Alt ${match[1]}:\n${match[2].trim()}`);
  }
  return blocks.join('\n\n');
}

export function buildSeoPrompt(context: ArticleContext): string {
  const frontmatter = context.frontmatter
    ? serializeMarkdownFile(context.frontmatter as unknown as Record<string, unknown>, context.fieldOrder, '').trim()
    : 'No YAML frontmatter loaded.';

  const body = context.body.trim()
    ? truncate(context.body, MAX_BODY_CONTEXT_CHARS)
    : 'No Markdown body loaded.';

  const altHistory = extractAltHistory(context.body);

  return `Create pre-posting SEO metadata for this StackEd/Substack article.

Return only valid JSON with this exact shape:
{
  "SEO_TITLE": "compelling but not clickbait title",
  "SEO_DESCRIPTION": "one concise search/social summary",
  "SEO_SLUG": "lowercase-hyphenated-url-slug",
  "SEO_TAGS": ["tag one", "tag two", "tag three"]
}

Rules:
- Preserve the article's actual angle and voice.
- Do not rewrite TITLE, SUBTITLE, HOOK, LANDING, or the manuscript body.
- SEO_TITLE should be compelling but not clickbait.
- SEO_DESCRIPTION should be one concise sentence.
- SEO_SLUG must be lowercase, hyphenated, and URL-safe.
- SEO_TAGS must contain 3-8 short topical tags.
- Use the Alt block evolution below as signal for the article's sharpest angle.

Current file: ${context.filePath ?? 'unsaved StackEd article'}

YAML frontmatter:
${frontmatter}

${altHistory ? `Title/Hook evolution (Alt blocks — use as SEO signal):\n${altHistory}\n\n` : ''}Markdown body:
${body}`;
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npm run test
```

Expected: all pass.

- [ ] **Step 5: Move SEO trigger to [PUBLISH] in Final Draft mode in App.svelte**

In `src/App.svelte`, rename `handlePrepareSeo` to `handlePublish` and gate it on `phase === 'final'`. Add a `[PUBLISH]` button in the Final Draft header area, and remove the old `Prepare SEO` button from the header (or hide it in Draft mode):

```typescript
async function handlePublish() {
  if (!documentStore.frontmatter) return;
  if (!settingsStore.hasValidKey) {
    alert('Add an AI API key in Settings before publishing.');
    return;
  }

  seoLoading = true;
  try {
    const frontmatter = documentStore.frontmatter;
    const adapter = createAdapter(settingsStore.provider, settingsStore.apiKey);
    const draft = await adapter.generateSeoDraft({
      frontmatter,
      fieldOrder: documentStore.fieldOrder,
      body: documentStore.body,
      filePath: documentStore.filePath,
    });
    const merged = mergeSeoDraft(frontmatter, draft);
    documentStore.replaceFrontmatter(merged);
    await handleSave();
    alert('SEO generated and saved. Review the SEO fields in the YAML panel, then confirm to post to Substack.');
  } catch (e) {
    alert('Publish failed: ' + (e instanceof Error ? e.message : e));
  } finally {
    seoLoading = false;
  }
}
```

Add to Final Draft header:

```svelte
{#if documentStore.phase === 'final'}
  <button
    onclick={handlePublish}
    disabled={seoLoading}
    class="px-4 py-2.5 text-base bg-amber-600 text-dark-900 rounded hover:bg-amber-500 disabled:opacity-50"
  >
    {seoLoading ? 'Generating SEO…' : '→ Publish'}
  </button>
{/if}
```

Remove or hide the old `Prepare SEO` button from the draft header.

- [ ] **Step 6: Verify TypeScript and run tests**

```bash
cd /Users/chasnewport/Projects/StackEd2.0 && npx tsc --noEmit 2>&1 | head -20 && npm run test
```

Expected: clean compile, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/seo.ts src/lib/services/seo.test.ts src/App.svelte
git commit -m "feat: SEO prompt includes Alt block evolution; SEO generation moves to Publish step in Final Draft mode"
```

---

## Self-Review

### Spec coverage check

| Spec section | Covered by |
|---|---|
| Body is source of truth | Task 3 (`runBodyParser`), Task 8 (parse on Save) |
| YAML is read-only mirror | Task 4 (YamlPanel + FieldFree `readonly`) |
| Parse on Save | Task 3, Task 8 (`getFrontmatterForSave` calls `runBodyParser`) |
| Parse on Preview | Task 7 (`PreviewPanel` calls `runBodyParser` reactively) |
| Alt block extraction | Task 2 |
| `[✓]` selection → `_SELECTED` YAML fields | Task 2, Task 3 (`runBodyParser`) |
| HOOK word count warning | Task 3, Task 4 (YamlPanel displays warning) |
| AI_GEN checkbox (display only) | Task 4 (YamlPanel) |
| Workflow phase state | Task 5 (`documentStore.phase`) |
| Preview: strip headings + scaffold | Task 6 (`renderForPreview`) |
| Preview: SPARK callout | Task 6, Task 7 |
| Preview: Alt blocks as radio buttons | Task 6, Task 7 |
| Preview: Alt radio → write-back to body | Task 7 (`selectAlt`) |
| Manuscript renderer for Promotion | Task 6 (`renderForPromotion`) |
| Promotion gate: SPINE + BODY≥100 words | Task 6 (`checkPromotionGate`), Task 10 |
| Promotion: writes `_final.md` | Task 10 |
| Promotion: switches to Final Draft mode | Task 10 |
| Final Draft: no tab bar | Task 8 (tab bar hidden when `phase === 'final'`) |
| Final Draft: Restart action | Task 11 |
| Workflow timeline strip | Task 9 |
| YAML panel toggle (Cursor-style icons) | Task 9 |
| SEO with Alt history | Task 12 |
| SEO triggers at Publish, not before | Task 12 |
| SEO fields shown as "pending" in Draft | Task 4 (YamlPanel) |

### Placeholder scan

No TBDs or incomplete steps found. The `delete_file` Tauri command check in Task 11 Step 3 gives explicit fallback instructions if the command doesn't exist.

### Type consistency

- `ArticleFrontmatter` with new fields defined in Task 1 — all subsequent tasks use these fields
- `runBodyParser` defined in Task 3 and imported in Tasks 8, 10
- `checkPromotionGate` / `renderForPromotion` defined in Task 6 and imported in Tasks 10, 12
- `writeFilePath` defined in Task 10 and not reused elsewhere
- `documentStore.phase`, `documentStore.setAltSelection`, `documentStore.hookWarning` defined in Tasks 4/5 and used in Tasks 7, 8, 9, 10, 11
