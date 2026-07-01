# Protected Title H1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Line 1 of the manuscript is always an H1 — editable, live-mirrored in the YAML panel, and structurally impossible to delete or downgrade — replacing the tag-based `## TITLE` extraction.

**Architecture:** A ProseMirror `appendTransaction` plugin (wrapped as a TipTap extension) enforces "first top-level node is always heading level 1" after every transaction, with a dedicated Enter-key override so splitting the title produces a paragraph, not a second heading. `documentStore` gains a `titleFromBody` getter that reads line 1 straight out of the live markdown body, and the (already read-only) YAML panel TITLE field displays that getter instead of `frontmatter.TITLE`. Persisted `frontmatter.TITLE` is refreshed from line 1 only at save time, via the existing `runBodyParser` / `runBodyParserUpsertOnly` / `backfillArticleFrontmatter` call sites in `frontmatter.ts`.

**Tech Stack:** TipTap 3 (ProseMirror), Svelte 5 runes, Vitest + jsdom.

## Global Constraints

- Unit tests live alongside the module they test (e.g. `frontmatter.test.ts` next to `frontmatter.ts`).
- Run `npm test` (== `vitest run`) before considering any task done.
- `SPARK`/`SUBTITLE`/`HOOK`/`LANDING` tag-based extraction (`## SECTION` headings and inline `SECTION:` labels) must keep working exactly as before — only `TITLE`'s extraction source changes.
- Don't touch code outside what each task specifies.

---

### Task 1: `extractTitleFromBody` + rewire TITLE extraction in `frontmatter.ts`

**Files:**
- Modify: `src/lib/utils/frontmatter.ts`
- Test: `src/lib/utils/frontmatter.test.ts`

**Interfaces:**
- Produces: `extractTitleFromBody(body: string): string` — exported function. Takes the markdown body, returns the trimmed text of line 1 with any leading `#` markers stripped (e.g. `"# My Title\n\nBody"` → `"My Title"`; `"Plain text\n..."` → `"Plain text"`; `""` → `""`).

Currently `ARTICLE_SECTIONS = ['SPARK', 'TITLE', 'SUBTITLE', 'HOOK', 'LANDING']` is used for two different jobs: (a) which fields get tag-extracted via `extractSection`, and (b) which labels terminate an inline `SECTION: value` match in `extractInlineLabel`. We're removing `TITLE` from job (a) but must keep it in job (b) — otherwise `SPARK: ... TITLE: ...` inline text would no longer stop at `TITLE:` and would swallow it into the SPARK value. So the single list splits into two.

- [ ] **Step 1: Write the failing tests for `extractTitleFromBody`**

Add to `src/lib/utils/frontmatter.test.ts` (new `describe` block, place after the existing imports/fixtures, before `describe('parseMarkdownFile', ...)`):

```ts
describe('extractTitleFromBody', () => {
  it('strips a leading "# " marker from line 1', () => {
    expect(extractTitleFromBody('# My Title\n\nBody text.')).toBe('My Title');
  });

  it('returns line 1 as-is when there is no heading marker', () => {
    expect(extractTitleFromBody('Plain first line\n\nBody text.')).toBe('Plain first line');
  });

  it('strips multiple leading # characters', () => {
    expect(extractTitleFromBody('## Odd Heading\nRest')).toBe('Odd Heading');
  });

  it('trims surrounding whitespace', () => {
    expect(extractTitleFromBody('#   Spacey Title   \nRest')).toBe('Spacey Title');
  });

  it('returns an empty string for an empty body', () => {
    expect(extractTitleFromBody('')).toBe('');
  });
});
```

Add `extractTitleFromBody` to the existing import line at the top of the file:

```ts
import { backfillArticleFrontmatter, extractTitleFromBody, parseMarkdownFile, runBodyParser, runBodyParserUpsertOnly, serializeMarkdownFile } from './frontmatter';
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run src/lib/utils/frontmatter.test.ts -t "extractTitleFromBody"`
Expected: FAIL — `extractTitleFromBody` is not exported / not defined.

- [ ] **Step 3: Implement `extractTitleFromBody` and split the section-list constant**

In `src/lib/utils/frontmatter.ts`, replace:

```ts
const ARTICLE_SECTIONS = ['SPARK', 'TITLE', 'SUBTITLE', 'HOOK', 'LANDING'] as const;
```

with:

```ts
const ARTICLE_SECTIONS = ['SPARK', 'SUBTITLE', 'HOOK', 'LANDING'] as const;
const INLINE_LABEL_BOUNDARIES = ['SPARK', 'TITLE', 'SUBTITLE', 'HOOK', 'LANDING'] as const;
```

Update `extractInlineLabel` to use the new boundary constant instead of `ARTICLE_SECTIONS`:

```ts
function extractInlineLabel(body: string, sectionName: string): string {
  const labelPattern = new RegExp(`(?:^|\\s)${sectionName}\\s*:\\s*`);
  const nextLabelPattern = new RegExp(`\\s(?:${INLINE_LABEL_BOUNDARIES.join('|')})\\s*:\\s*`);
  // ...unchanged below this line
```

Add the new exported function (place it near `extractSection`, after `extractInlineLabel`):

```ts
export function extractTitleFromBody(body: string): string {
  const firstLine = body.split('\n', 1)[0] ?? '';
  return firstLine.replace(/^#+\s*/, '').trim();
}
```

- [ ] **Step 4: Run the new tests to verify they pass**

Run: `npx vitest run src/lib/utils/frontmatter.test.ts -t "extractTitleFromBody"`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire `extractTitleFromBody` into `backfillArticleFrontmatter`, `runBodyParser`, `runBodyParserUpsertOnly`**

In `backfillArticleFrontmatter`, after the existing `for (const section of ARTICLE_SECTIONS)` loop, add:

```ts
export function backfillArticleFrontmatter(
  frontmatter: ArticleFrontmatter,
  body: string,
): ArticleFrontmatter {
  const backfilled = { ...frontmatter };

  for (const section of ARTICLE_SECTIONS) {
    if (!backfilled[section]) {
      const extracted = extractSection(body, section);
      if (extracted) backfilled[section] = extracted;
    }
  }

  if (!backfilled.TITLE) {
    const extractedTitle = extractTitleFromBody(body);
    if (extractedTitle) backfilled.TITLE = extractedTitle;
  }

  return backfilled;
}
```

In `runBodyParser`, after the existing `for (const section of ARTICLE_SECTIONS)` loop, add:

```ts
export function runBodyParser(
  frontmatter: ArticleFrontmatter,
  body: string,
): ArticleFrontmatter {
  const now = new Date().toISOString();
  const updated = { ...frontmatter, updated: now };

  for (const section of ARTICLE_SECTIONS) {
    const extracted = extractSection(body, section);
    if (extracted) {
      (updated as Record<string, unknown>)[section] = extracted;
    }
  }

  const extractedTitle = extractTitleFromBody(body);
  if (extractedTitle) {
    updated.TITLE = extractedTitle;
  }

  // ...Alt selections logic below is unchanged
```

In `runBodyParserUpsertOnly`, same addition, after its `for (const section of ARTICLE_SECTIONS)` loop:

```ts
export function runBodyParserUpsertOnly(
  frontmatter: ArticleFrontmatter,
  body: string,
): ArticleFrontmatter {
  const now = new Date().toISOString();
  const updated = { ...frontmatter, updated: now };

  for (const section of ARTICLE_SECTIONS) {
    const extracted = extractSection(body, section);
    if (extracted) {
      (updated as Record<string, unknown>)[section] = extracted;
    }
  }

  const extractedTitle = extractTitleFromBody(body);
  if (extractedTitle) {
    updated.TITLE = extractedTitle;
  }

  // ...Alt selections logic below is unchanged
```

- [ ] **Step 6: Update stale assertions in existing tests**

These tests currently assert `TITLE` gets extracted from `## TITLE` / `# TITLE` / inline `TITLE:` tags — that's no longer how `TITLE` is populated by these functions, so their `TITLE` assertions are now wrong and must be removed or rewritten. Apply each edit exactly:

1. `'extracts all sections from body when YAML is empty'` — remove the TITLE line:

```ts
  it('extracts all sections from body when YAML is empty', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_NO_FRONTMATTER_WITH_SECTIONS);
    expect(String(frontmatter.SPARK)).toContain('Initial idea here');
    expect(String(frontmatter.SUBTITLE)).toContain('The subtitle or hook promise');
    expect(String(frontmatter.HOOK)).toContain('Refined opening for reader attention');
    expect(String(frontmatter.LANDING)).toContain('Closing thoughts');
  });
```

2. `'extracts StackEd fields from inline body labels when YAML is empty'` — remove the TITLE line:

```ts
  it('extracts StackEd fields from inline body labels when YAML is empty', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_NO_FRONTMATTER_WITH_INLINE_LABELS);
    expect(frontmatter.SPARK).toBe('Initial idea here.');
    expect(frontmatter.SUBTITLE).toBe('The subtitle or hook promise.');
    expect(frontmatter.HOOK).toBe('Refined opening for reader attention.');
  });
```

3. `'extracts StackEd fields from flattened inline body labels when YAML is empty'` — remove the TITLE line:

```ts
  it('extracts StackEd fields from flattened inline body labels when YAML is empty', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_FLATTENED_INLINE_LABELS);
    expect(frontmatter.SPARK).toBe('Partial Solution Partiality is easier to see than impartiality. Partiality is easy to spot: Two-Tier Policing by the bucket.');
    expect(frontmatter.SUBTITLE).toBe('What does impartiality look like?');
    expect(frontmatter.HOOK).toBe('The oath taken by Police Officers in England & Wales was changed in 2002: Originally "without favour or affection, malice or ill will" Now: "with fairness"');
  });
```

4. In `describe('backfillArticleFrontmatter', ...)`, remove the `TITLE` assertion line from these three tests (leave everything else in each test unchanged): `'fills blank StackEd fields from body sections on save'`, `'fills blank StackEd fields from inline body labels on save'`, `'fills blank StackEd fields from flattened inline body labels on save'`. In each, delete the line that reads `expect(backfilled.TITLE).toBe('My Article Title');` (appears in the first two) and `expect(backfilled.TITLE).toBe('Partial Solution');` (third).

5. Add a new test to `describe('backfillArticleFrontmatter', ...)`, after `'does not overwrite populated StackEd fields on save'`:

```ts
  it('fills blank TITLE from body line 1 on save', () => {
    const frontmatter = {
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
      created: '2026-06-04T00:00:00.000Z',
      updated: '2026-06-04T00:00:00.000Z',
    };

    const backfilled = backfillArticleFrontmatter(frontmatter, '# Article headline\n\nBody text.');

    expect(backfilled.TITLE).toBe('Article headline');
  });
```

6. In `describe('runBodyParser', ...)`, test `'returns updated frontmatter with Alt selections applied'` — change the body fixture so line 1 is a real H1 instead of a `## TITLE` tag:

```ts
  it('returns updated frontmatter with Alt selections applied', () => {
    const fm: ArticleFrontmatter = {
      IMAGE: '', SPARK: '', TITLE: '', SUBTITLE: '', HOOK: '',
      LANDING: '', TITLE_SELECTED: '', SUBTITLE_SELECTED: '',
      HOOK_SELECTED: '', LANDING_SELECTED: '', AI_GEN: false,
      SEO_TITLE: '', SEO_DESCRIPTION: '', SEO_SLUG: '', SEO_TAGS: [],
      created: '2026-06-13', updated: '2026-06-13',
    };
    const body = `# My Title\n\n## Alt TITLE\n1. Better Title [✓]\n2. Other`;
    const result = runBodyParser(fm, body);
    expect(result.TITLE).toBe('My Title');
    expect(result.TITLE_SELECTED).toBe('Better Title');
  });
```

(Leave the other `runBodyParser` test, `'clears _SELECTED when the [✓] marker is removed from the body'`, unchanged — it doesn't assert on `TITLE`.)

7. In `describe('runBodyParserUpsertOnly', ...)`, test `'upserts primary sections and Alt selections from the body'` — same fixture change:

```ts
  it('upserts primary sections and Alt selections from the body', () => {
    const fm: ArticleFrontmatter = {
      IMAGE: '', SPARK: '', TITLE: 'Old Title', SUBTITLE: '', HOOK: '',
      LANDING: '', TITLE_SELECTED: '', SUBTITLE_SELECTED: '',
      HOOK_SELECTED: '', LANDING_SELECTED: '', AI_GEN: false,
      SEO_TITLE: '', SEO_DESCRIPTION: '', SEO_SLUG: '', SEO_TAGS: [],
      created: '2026-06-13', updated: '2026-06-13',
    };
    const body = `# New Title\n\n## Alt TITLE\n1. Better Title [✓]\n2. Other`;

    const result = runBodyParserUpsertOnly(fm, body);

    expect(result.TITLE).toBe('New Title');
    expect(result.TITLE_SELECTED).toBe('Better Title');
  });
```

8. In the same `describe`, test `'does not clear existing fields when body tags or checkmarks are absent'` — remove the now-incorrect TITLE assertion (TITLE is no longer "preserved when absent"; it's always derived from line 1, and this fixture's line 1 isn't a title at all):

```ts
  it('does not clear existing fields when body tags or checkmarks are absent', () => {
    const fm: ArticleFrontmatter = {
      IMAGE: '', SPARK: 'Kept Spark', TITLE: 'Kept Title', SUBTITLE: '',
      HOOK: '', LANDING: '', TITLE_SELECTED: 'Previously Selected',
      SUBTITLE_SELECTED: '', HOOK_SELECTED: '', LANDING_SELECTED: '',
      AI_GEN: false, SEO_TITLE: '', SEO_DESCRIPTION: '', SEO_SLUG: '',
      SEO_TAGS: [], created: '2026-06-13', updated: '2026-06-13',
    };
    const body = `## Alt TITLE\n1. Option A\n2. Option B`;

    const result = runBodyParserUpsertOnly(fm, body);

    expect(result.SPARK).toBe('Kept Spark');
    expect(result.TITLE_SELECTED).toBe('Previously Selected');
  });
```

- [ ] **Step 7: Run the full frontmatter test file and confirm everything is green**

Run: `npx vitest run src/lib/utils/frontmatter.test.ts`
Expected: PASS — all tests, including the new `extractTitleFromBody` describe block.

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils/frontmatter.ts src/lib/utils/frontmatter.test.ts
git commit -m "feat: derive TITLE from body line 1 instead of tagged section"
```

---

### Task 2: `documentStore.titleFromBody` getter and body-derived tab titles

**Files:**
- Modify: `src/lib/stores/document.svelte.ts`
- Test: `src/lib/stores/document.test.ts`

**Interfaces:**
- Consumes: `extractTitleFromBody(body: string): string` from `src/lib/utils/frontmatter.ts` (Task 1).
- Produces: `documentStore.titleFromBody: string` (getter, active tab). `tabTitle()` (internal helper, already exists, signature unchanged) now derives from body instead of `frontmatter.TITLE`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/stores/document.test.ts`, inside the `describe('document store', ...)` block (add near the other `load()`/getter tests):

```ts
  it('titleFromBody reads line 1 of the active tab body', () => {
    documentStore.load(BASE, '# Live Title\n\nBody text.', ['TITLE'], FAKE_HANDLE);
    expect(documentStore.titleFromBody).toBe('Live Title');
  });

  it('titleFromBody updates as body changes', () => {
    documentStore.load(BASE, '# First\n\nBody.', ['TITLE'], FAKE_HANDLE);
    documentStore.setBody('# Second\n\nBody.');
    expect(documentStore.titleFromBody).toBe('Second');
  });
```

Add a new `describe` block for `tabTitle` behavior (`tabMetas` is the public surface for it), placed after the existing `describe('document store', ...)` block closes:

```ts
describe('documentStore.tabMetas title', () => {
  it('derives the tab title from body line 1, not frontmatter.TITLE', () => {
    documentStore.load({ ...BASE, TITLE: 'Stale Frontmatter Title' }, '# Body Title\n\nText.', ['TITLE'], FAKE_HANDLE);
    expect(documentStore.tabMetas[documentStore.activeIndex].title).toBe('Body Title');
  });

  it('falls back to the file name when body has no usable title', () => {
    documentStore.load({ ...BASE, TITLE: '' }, '', ['TITLE'], FAKE_HANDLE, '/path/to/my-draft.md');
    expect(documentStore.tabMetas[documentStore.activeIndex].title).toBe('my-draft');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/stores/document.test.ts -t "titleFromBody"`
Expected: FAIL — `documentStore.titleFromBody` is not a function/getter.

Run: `npx vitest run src/lib/stores/document.test.ts -t "tabMetas title"`
Expected: FAIL — first test fails because `tabTitle` still reads `frontmatter.TITLE` ('Stale Frontmatter Title' instead of 'Body Title').

- [ ] **Step 3: Implement**

Add the import at the top of `src/lib/stores/document.svelte.ts`:

```ts
import type { ArticleFrontmatter } from '$lib/types/article';
import type { ParsedFile } from '$lib/types/article';
import { extractTitleFromBody } from '$lib/utils/frontmatter';
```

Replace the `tabTitle` function:

```ts
function tabTitle(tab: TabState): string {
  const bodyTitle = extractTitleFromBody(tab.body);
  if (bodyTitle) return bodyTitle;
  if (tab.filePath) return tab.filePath.split('/').pop()?.replace(/\.md$/i, '') ?? 'Untitled';
  return 'Untitled';
}
```

Add the `titleFromBody` getter to the `DocumentStore` class, next to the other active-tab proxy getters (near `get body()`):

```ts
  get titleFromBody(): string {
    return extractTitleFromBody(this._tabs[this._activeIndex].body);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/stores/document.test.ts`
Expected: PASS — all tests in the file, including the 4 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/document.svelte.ts src/lib/stores/document.test.ts
git commit -m "feat: derive tab titles and titleFromBody getter from body line 1"
```

---

### Task 3: Live-mirror TITLE in the YAML panel

**Files:**
- Modify: `src/lib/components/yaml/FieldFree.svelte`
- Modify: `src/lib/components/yaml/YamlPanel.svelte`

**Interfaces:**
- Consumes: `documentStore.titleFromBody` (Task 2).
- Produces: `FieldFree` gains an optional `overrideValue?: string` prop — when provided, it's displayed instead of the value looked up from `documentStore.frontmatter[field]`. No other `FieldFree` usage in the codebase passes this prop, so their behavior is unchanged.

This component isn't covered by an automated test harness (no Svelte component-testing library is set up in this repo — confirmed by grepping for `@testing-library/svelte` and finding no matches, and no other `.svelte` file has a sibling test). Verification is manual, via the dev server, per CLAUDE.md's UI-testing guidance. That happens in Task 6 once the full feature (including the protection extension) is wired up — testing the live-mirror in isolation before line 1 is actually an H1 wouldn't exercise the real flow.

- [ ] **Step 1: Add `overrideValue` to `FieldFree.svelte`**

In `src/lib/components/yaml/FieldFree.svelte`, change the props block:

```ts
  let {
    label,
    field,
    type = 'text',
    options,
    rows = 3,
    readonly = false,
    overrideValue,
  }: {
    label: string;
    field: keyof ArticleFrontmatter;
    type?: 'text' | 'textarea' | 'select' | 'toggle' | 'datetime';
    options?: string[];
    rows?: number;
    readonly?: boolean;
    overrideValue?: string;
  } = $props();

  let value = $derived(overrideValue !== undefined ? overrideValue : (documentStore.frontmatter?.[field] ?? ''));
```

(The rest of the file — markup, `update()`, `inputId` — is unchanged.)

- [ ] **Step 2: Bind the TITLE field to `documentStore.titleFromBody`**

In `src/lib/components/yaml/YamlPanel.svelte`, change:

```svelte
        <FieldFree label="Title" field="TITLE" type="textarea" rows={2} readonly={true} />
```

to:

```svelte
        <FieldFree label="Title" field="TITLE" type="textarea" rows={2} readonly={true} overrideValue={documentStore.titleFromBody} />
```

- [ ] **Step 3: Type-check**

Run: `npm run check` (runs `svelte-check --tsconfig ./tsconfig.json`)
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/yaml/FieldFree.svelte src/lib/components/yaml/YamlPanel.svelte
git commit -m "feat: mirror YAML panel TITLE field from live body line 1"
```

---

### Task 4: `ProtectedTitle` TipTap extension

**Files:**
- Create: `src/lib/components/editor/extensions/ProtectedTitle.ts`
- Test: `src/lib/components/editor/extensions/ProtectedTitle.test.ts`

**Interfaces:**
- Produces: `export const ProtectedTitle: Extension` (TipTap `Extension`, not a `Node` — it adds a ProseMirror plugin and a keymap on top of the existing `heading`/`paragraph` nodes from StarterKit, it doesn't define new node types).

Uses the same test pattern as `src/lib/components/editor/extensions/heroImage.test.ts`: construct a real `@tiptap/core` `Editor` with `StarterKit` (which provides `heading` and `paragraph`) plus `ProtectedTitle`, drive it via `editor.commands` / `editor.state.tr`, and assert on `editor.state.doc`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/components/editor/extensions/ProtectedTitle.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { ProtectedTitle } from './ProtectedTitle';

function createEditor(content = ''): Editor {
  const element = document.createElement('div');
  return new Editor({
    element,
    extensions: [StarterKit, ProtectedTitle],
    content,
  });
}

function firstNodeInfo(editor: Editor): { type: string; level?: number; text: string } {
  const node = editor.state.doc.firstChild;
  if (!node) return { type: 'none', text: '' };
  return { type: node.type.name, level: node.attrs.level, text: node.textContent };
}

describe('ProtectedTitle', () => {
  it('converts a non-heading first paragraph into an H1 on load', () => {
    const editor = createEditor('<p>Not a title yet</p>');
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    expect(info.text).toBe('Not a title yet');
    editor.destroy();
  });

  it('inserts an empty H1 when the document is empty', () => {
    const editor = createEditor('');
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    editor.destroy();
  });

  it('restores the H1 after select-all + delete', () => {
    const editor = createEditor('<h1>My Title</h1><p>Body paragraph.</p>');
    editor.chain().focus().selectAll().deleteSelection().run();
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    editor.destroy();
  });

  it('keeps the first node as H1 after a Backspace-merge from line 2', () => {
    const editor = createEditor('<h1>Title</h1><p>Second line</p>');
    // Place the cursor at the very start of the second block, then merge it backward.
    const secondBlockStart = editor.state.doc.firstChild!.nodeSize + 1;
    editor.chain().focus().setTextSelection(secondBlockStart).run();
    editor.commands.keyboardShortcut('Backspace');
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    expect(info.text).toBe('TitleSecond line');
    editor.destroy();
  });

  it('reverts an attempt to change line 1 to H2', () => {
    const editor = createEditor('<h1>Title</h1><p>Body</p>');
    editor.chain().focus().setTextSelection(1).setNode('heading', { level: 2 }).run();
    const info = firstNodeInfo(editor);
    expect(info.type).toBe('heading');
    expect(info.level).toBe(1);
    editor.destroy();
  });

  it('splits Enter inside the title into a new paragraph below', () => {
    const editor = createEditor('<h1>Title text</h1>');
    // Cursor between "Title " and "text" (position 7 inside the heading).
    editor.chain().focus().setTextSelection(7).run();
    editor.commands.keyboardShortcut('Enter');
    const doc = editor.state.doc;
    expect(doc.firstChild?.type.name).toBe('heading');
    expect(doc.firstChild?.attrs.level).toBe(1);
    expect(doc.firstChild?.textContent).toBe('Title ');
    const secondNode = doc.maybeChild(1);
    expect(secondNode?.type.name).toBe('paragraph');
    expect(secondNode?.textContent).toBe('text');
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/components/editor/extensions/ProtectedTitle.test.ts`
Expected: FAIL — `./ProtectedTitle` does not exist.

- [ ] **Step 3: Implement `ProtectedTitle.ts`**

Create `src/lib/components/editor/extensions/ProtectedTitle.ts`:

```ts
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { Transaction } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

const pluginKey = new PluginKey('protectedTitle');

function enforceFirstNodeIsH1(tr: Transaction): Transaction | null {
  const { doc, schema } = tr;
  const headingType = schema.nodes.heading;
  const paragraphType = schema.nodes.paragraph;
  if (!headingType) return null;

  const first: ProseMirrorNode | null = doc.firstChild;

  if (!first) {
    const heading = headingType.create({ level: 1 });
    return tr.insert(0, heading);
  }

  if (first.type === headingType && first.attrs.level === 1) {
    return null;
  }

  if (first.type === headingType) {
    return tr.setNodeMarkup(0, undefined, { ...first.attrs, level: 1 });
  }

  if (first.type === paragraphType) {
    return tr.setNodeMarkup(0, headingType, { level: 1 });
  }

  // First node can't hold heading content directly (e.g. an image block) —
  // insert an empty H1 above it instead of trying to convert it.
  const heading = headingType.create({ level: 1 });
  return tr.insert(0, heading);
}

export const ProtectedTitle = Extension.create({
  name: 'protectedTitle',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        appendTransaction(transactions, oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          const fixed = enforceFirstNodeIsH1(tr);
          return fixed;
        },
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { state, view } = this.editor;
        const { $from } = state.selection;
        const headingType = state.schema.nodes.heading;
        const paragraphType = state.schema.nodes.paragraph;
        const firstNode = state.doc.firstChild;

        const insideFirstNode = firstNode && $from.pos > 0 && $from.pos < firstNode.nodeSize + 1 && $from.before(1) === 0;
        if (!insideFirstNode || firstNode?.type !== headingType) {
          return false;
        }

        const tr = state.tr.deleteSelection();
        const splitPos = tr.selection.from;
        tr.split(splitPos, 1, [{ type: paragraphType }]);
        tr.setSelection(TextSelection.near(tr.doc.resolve(splitPos + 2)));
        view.dispatch(tr);
        return true;
      },
    };
  },
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/components/editor/extensions/ProtectedTitle.test.ts`
Expected: PASS — all 6 tests.

If the Enter-split test fails on the exact split position (off-by-one is easy here since `setTextSelection(7)` depends on exact ProseMirror position counting for `<h1>Title text</h1>`), adjust the `setTextSelection` argument in the test to match the position between "Title " and "text" — verify by logging `editor.state.doc.textBetween(0, editor.state.doc.content.size)` alongside position numbers if needed, then hard-code the correct offset. The important assertions are the *outcome* (first node text, second node type/text), not the specific input position.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/editor/extensions/ProtectedTitle.ts src/lib/components/editor/extensions/ProtectedTitle.test.ts
git commit -m "feat: add ProtectedTitle extension enforcing an undeletable H1 at line 1"
```

---

### Task 5: Register `ProtectedTitle` in the editor

**Files:**
- Modify: `src/lib/components/editor/Editor.svelte`

**Interfaces:**
- Consumes: `ProtectedTitle` extension from `./extensions/ProtectedTitle` (Task 4).

- [ ] **Step 1: Import and register the extension**

In `src/lib/components/editor/Editor.svelte`, add the import near the other extension imports (after `Recipe`):

```ts
  import { Recipe } from './extensions/Recipe';
  import { ProtectedTitle } from './extensions/ProtectedTitle';
```

Add it to the `extensions` array passed to `new Editor({ ... })` (order doesn't matter relative to the node extensions, but keep it grouped with the other custom ones for readability):

```ts
      extensions: [
        TextStyle,
        FontFamily,
        FontSize,
        StarterKit,
        CaptionedImage,
        Image2,
        Caption,
        Paywall,
        SubscribeButton,
        ShareButton,
        Poll,
        Poetry,
        Latex,
        Footnote,
        FinancialChart,
        PredictionMarket,
        Recipe,
        ProtectedTitle,
      ],
```

- [ ] **Step 2: Run the full unit test suite**

Run: `npm test`
Expected: PASS — no regressions in any existing suite (in particular `heroImage.test.ts`, which also builds an `Editor` with `StarterKit` and is unaffected since it doesn't import `ProtectedTitle`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/editor/Editor.svelte
git commit -m "feat: wire ProtectedTitle into the manuscript editor"
```

---

### Task 6: Manual verification in the browser

**Files:** none (verification only).

Per CLAUDE.md: UI changes must be exercised in a running browser before being called done, not just covered by unit tests. Use the project's `/run` skill (or `npm run dev` / `npm run tauri dev`, whichever the project's normal dev-loop command is) to launch the app, then walk through every scenario from the spec's Testing section:

- [ ] **Step 1: Launch the dev server / app**

Prefer the `run` skill if available. Otherwise run `npm run dev` (Vite web build, open the printed localhost URL in a browser) or `npm run dev:app` (Tauri desktop shell) — either exercises the same `Editor.svelte`/`YamlPanel.svelte` code.

- [ ] **Step 2: New/blank document**

Open a new tab (blank document). Confirm line 1 renders as an H1 immediately (even though empty), and the YAML panel's TITLE field is present and empty.

- [ ] **Step 3: Typing syncs live**

Click into line 1 and type a title. Confirm the YAML panel's TITLE field updates on every keystroke, and the tab label updates to match.

- [ ] **Step 4: Select-all + Delete**

With some body content below the title, select the entire document (Cmd/Ctrl+A) and press Delete. Confirm an empty H1 remains at the top (doc isn't left completely blank / without a title node).

- [ ] **Step 5: Backspace-merge from line 2**

Place the cursor at the very start of line 2 and press Backspace. Confirm line 1 stays an H1 (doesn't get merged down to a plain paragraph or disappear).

- [ ] **Step 6: Toolbar level change**

Click into line 1 and try setting it to Heading 2 via the toolbar's style dropdown. Confirm it reverts to Heading 1 (visually — larger H1 styling should remain).

- [ ] **Step 7: Markdown shortcut downgrade attempt**

On a fresh line 1, type `## ` at the very start. Confirm it doesn't downgrade line 1 to H2 (should stay H1, or the input rule should visibly get reverted).

- [ ] **Step 8: Enter mid-title**

Click partway through the title text and press Enter. Confirm the text after the cursor moves to a new paragraph below, and line 1 remains a single H1 line with the text before the cursor.

- [ ] **Step 9: Legacy file migration**

Open (or paste in / load) a markdown file whose body does not start with a `#` heading. Confirm line 1 auto-converts to an H1 the moment the file loads, using the first line's original text as the H1 content.

- [ ] **Step 10: Save round-trip**

Save the file (Cmd/Ctrl+S or the app's save action). Confirm the saved file's frontmatter `TITLE` field matches line 1's text exactly.

- [ ] **Step 11: Final full test run**

Run: `npm test`
Expected: PASS — full suite green.

No commit for this task (verification only, no code changes).
