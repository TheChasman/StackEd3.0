# SEO Pre-Posting Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add StackEd-owned AI SEO metadata generation that fills YAML fields before export/posting.

**Architecture:** Extend the existing YAML-first article model with four SEO fields, then add a focused SEO service for completeness checks, prompt construction, JSON parsing, and merge behaviour. The current app has no export/post button, so this plan adds a `Prepare SEO` header action that uses the same pre-posting gate a future export flow will call.

**Tech Stack:** Svelte 5, TypeScript, Vitest, js-yaml, existing Claude/OpenAI browser adapters.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/lib/types/article.ts` | Add SEO fields to `ArticleFrontmatter`, defaults, and field order |
| Modify | `src/lib/services/files.ts` | Parse legacy/new SEO fields and normalise files missing SEO fields |
| Modify | `src/lib/utils/frontmatter.test.ts` | Cover YAML array serialisation for `SEO_TAGS` |
| Create | `src/lib/services/seo.ts` | SEO completeness, prompt, parser, merge helpers |
| Create | `src/lib/services/seo.test.ts` | TDD tests for SEO helpers |
| Modify | `src/lib/services/ai/adapter.ts` | Add `generateSeoDraft()` to the AI adapter contract |
| Modify | `src/lib/services/ai/claude.ts` | Implement Claude SEO JSON generation |
| Modify | `src/lib/services/ai/openai.ts` | Implement OpenAI SEO JSON generation |
| Create | `src/lib/components/yaml/FieldTags.svelte` | Comma-separated UI for array-backed YAML tags |
| Modify | `src/lib/components/yaml/YamlPanel.svelte` | Add editable SEO section |
| Modify | `src/App.svelte` | Add `Prepare SEO` pre-posting gate action |
| Modify | `src/lib/stores/document.test.ts` | Keep test fixtures aligned with expanded frontmatter |

---

## Task 1: Extend the YAML Schema

**Files:**
- Modify: `src/lib/types/article.ts`
- Modify: `src/lib/services/files.ts`
- Modify: `src/lib/utils/frontmatter.test.ts`
- Modify: `src/lib/stores/document.test.ts`

- [ ] **Step 1: Update the frontmatter type**

Replace `src/lib/types/article.ts` with:

```ts
// Simplified YAML frontmatter for Markdown articles (Substack structure + pre-posting SEO)
export interface ArticleFrontmatter {
  IMAGE: string;            // Hero image src (URL or data-URI)
  SPARK: string;            // Raw idea seed
  TITLE: string;            // Article title
  SUBTITLE: string;         // Hook promise
  HOOK: string;             // Refined opening
  LANDING: string;          // Closing thought
  SEO_TITLE: string;        // Search/social title
  SEO_DESCRIPTION: string;  // Search/social description
  SEO_SLUG: string;         // URL-safe slug
  SEO_TAGS: string[];       // Short topical tags
  created: string;          // ISO timestamp
  updated: string;          // ISO timestamp
}

export const FRONTMATTER_DEFAULTS: ArticleFrontmatter = {
  IMAGE: '',
  SPARK: '',
  TITLE: '',
  SUBTITLE: '',
  HOOK: '',
  LANDING: '',
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
  'SEO_TITLE',
  'SEO_DESCRIPTION',
  'SEO_SLUG',
  'SEO_TAGS',
  'created',
  'updated',
];

export type FieldOwner = 'author' | 'stackpipe' | 'ai';
export type FieldAccess = 'free' | 'padlocked' | 'readonly';

export interface FieldPermission {
  owner: FieldOwner;
  access: FieldAccess;
  content_field: boolean;
}

export interface PermissionsManifest {
  version: number;
  description: string;
  fields: Record<string, FieldPermission>;
}

export interface ParsedFile {
  frontmatter: ArticleFrontmatter;
  body: string;
  fieldOrder: string[];
  fileHandle: FileSystemFileHandle | null;
  filePath: string | null;
  dirty?: boolean;
}
```

- [ ] **Step 2: Add a failing frontmatter serialisation test**

Append this test inside the `describe('serializeMarkdownFile', ...)` block in `src/lib/utils/frontmatter.test.ts`:

```ts
  it('serializes SEO_TAGS as a YAML array', () => {
    const serialized = serializeMarkdownFile(
      {
        SEO_TAGS: ['policing', 'justice', 'civil liberties'],
      },
      ['SEO_TAGS'],
      '',
    );

    expect(serialized).toContain('SEO_TAGS:\n  - "policing"\n  - "justice"\n  - "civil liberties"');
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.SEO_TAGS).toEqual(['policing', 'justice', 'civil liberties']);
  });
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
npm run test -- src/lib/utils/frontmatter.test.ts
```

Expected: PASS. The serializer already supports arrays; this locks the behaviour before SEO fields depend on it.

- [ ] **Step 4: Teach file parsing about SEO fields**

In `src/lib/services/files.ts`, inside `parseContent()`, add this helper after `value`:

```ts
  const arrayValue = (key: string): string[] => {
    const field = raw[key];
    if (Array.isArray(field)) return field.filter((item): item is string => typeof item === 'string');
    if (typeof field === 'string') {
      return field
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
    }
    return [];
  };
```

Then add the SEO fields to the `frontmatter` object between `LANDING` and `created`:

```ts
    SEO_TITLE: value('SEO_TITLE') || value('seo_title') || FRONTMATTER_DEFAULTS.SEO_TITLE,
    SEO_DESCRIPTION: value('SEO_DESCRIPTION') || value('seo_description') || FRONTMATTER_DEFAULTS.SEO_DESCRIPTION,
    SEO_SLUG: value('SEO_SLUG') || value('seo_slug') || FRONTMATTER_DEFAULTS.SEO_SLUG,
    SEO_TAGS: arrayValue('SEO_TAGS').length
      ? arrayValue('SEO_TAGS')
      : arrayValue('substack_tags').length
        ? arrayValue('substack_tags')
        : FRONTMATTER_DEFAULTS.SEO_TAGS,
```

- [ ] **Step 5: Update test fixtures that build complete frontmatter**

In `src/lib/utils/frontmatter.test.ts` and `src/lib/stores/document.test.ts`, every manually constructed complete `ArticleFrontmatter` object must include:

```ts
      SEO_TITLE: '',
      SEO_DESCRIPTION: '',
      SEO_SLUG: '',
      SEO_TAGS: [],
```

Place those fields after `LANDING`.

- [ ] **Step 6: Verify schema changes**

Run:

```bash
npm run test -- src/lib/utils/frontmatter.test.ts src/lib/stores/document.test.ts
npm run check
```

Expected: both commands pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/article.ts src/lib/services/files.ts src/lib/utils/frontmatter.test.ts src/lib/stores/document.test.ts
git commit -m "feat: add SEO frontmatter fields"
```

---

## Task 2: Add SEO Helper Service

**Files:**
- Create: `src/lib/services/seo.ts`
- Create: `src/lib/services/seo.test.ts`

- [ ] **Step 1: Write failing SEO helper tests**

Create `src/lib/services/seo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ArticleFrontmatter } from '$lib/types/article';
import {
  buildSeoPrompt,
  isSeoComplete,
  mergeSeoDraft,
  parseSeoDraftJson,
} from './seo';

const BASE: ArticleFrontmatter = {
  IMAGE: '',
  SPARK: 'Raw idea',
  TITLE: 'Partial Solution',
  SUBTITLE: 'What does impartiality look like?',
  HOOK: 'The oath changed in 2002.',
  LANDING: '',
  SEO_TITLE: '',
  SEO_DESCRIPTION: '',
  SEO_SLUG: '',
  SEO_TAGS: [],
  created: '2026-06-09T00:00:00.000Z',
  updated: '2026-06-09T00:00:00.000Z',
};

describe('isSeoComplete', () => {
  it('returns false when any SEO field is blank', () => {
    expect(isSeoComplete(BASE)).toBe(false);
  });

  it('returns true when all SEO fields are populated', () => {
    expect(isSeoComplete({
      ...BASE,
      SEO_TITLE: 'Partial Solution',
      SEO_DESCRIPTION: 'A short description.',
      SEO_SLUG: 'partial-solution',
      SEO_TAGS: ['justice'],
    })).toBe(true);
  });
});

describe('parseSeoDraftJson', () => {
  it('parses valid JSON SEO output', () => {
    expect(parseSeoDraftJson(`{
      "SEO_TITLE": "Partial Solution",
      "SEO_DESCRIPTION": "What impartial policing really means.",
      "SEO_SLUG": "partial-solution",
      "SEO_TAGS": ["policing", "justice"]
    }`)).toEqual({
      SEO_TITLE: 'Partial Solution',
      SEO_DESCRIPTION: 'What impartial policing really means.',
      SEO_SLUG: 'partial-solution',
      SEO_TAGS: ['policing', 'justice'],
    });
  });

  it('rejects incomplete JSON SEO output', () => {
    expect(() => parseSeoDraftJson('{"SEO_TITLE":"Only title"}')).toThrow('SEO draft missing SEO_DESCRIPTION');
  });

  it('normalises slug and tags', () => {
    const draft = parseSeoDraftJson(`{
      "SEO_TITLE": "Title",
      "SEO_DESCRIPTION": "Description",
      "SEO_SLUG": "Partial Solution!",
      "SEO_TAGS": [" Policing ", "", "Justice Reform"]
    }`);

    expect(draft.SEO_SLUG).toBe('partial-solution');
    expect(draft.SEO_TAGS).toEqual(['Policing', 'Justice Reform']);
  });
});

describe('mergeSeoDraft', () => {
  it('fills blanks without replacing author-edited SEO fields', () => {
    const merged = mergeSeoDraft(
      { ...BASE, SEO_TITLE: 'Manual SEO title' },
      {
        SEO_TITLE: 'AI title',
        SEO_DESCRIPTION: 'AI description',
        SEO_SLUG: 'ai-slug',
        SEO_TAGS: ['ai'],
      },
    );

    expect(merged.SEO_TITLE).toBe('Manual SEO title');
    expect(merged.SEO_DESCRIPTION).toBe('AI description');
    expect(merged.SEO_SLUG).toBe('ai-slug');
    expect(merged.SEO_TAGS).toEqual(['ai']);
  });
});

describe('buildSeoPrompt', () => {
  it('includes frontmatter and body context', () => {
    const prompt = buildSeoPrompt({
      frontmatter: BASE,
      fieldOrder: ['TITLE'],
      body: '# Draft\n\nBody copy.',
      filePath: '/tmp/Partial Solution.md',
    });

    expect(prompt).toContain('Return only valid JSON');
    expect(prompt).toContain('Partial Solution');
    expect(prompt).toContain('Body copy.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm run test -- src/lib/services/seo.test.ts
```

Expected: FAIL with `Cannot find module './seo'`.

- [ ] **Step 3: Implement SEO helper service**

Create `src/lib/services/seo.ts`:

```ts
import type { ArticleContext } from '$lib/services/ai/adapter';
import type { ArticleFrontmatter } from '$lib/types/article';
import { serializeMarkdownFile } from '$lib/utils/frontmatter';

const MAX_BODY_CONTEXT_CHARS = 12000;

export interface SeoDraft {
  SEO_TITLE: string;
  SEO_DESCRIPTION: string;
  SEO_SLUG: string;
  SEO_TAGS: string[];
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}\n\n[Truncated ${value.length - maxLength} characters]`;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function isSeoComplete(frontmatter: ArticleFrontmatter | null): boolean {
  if (!frontmatter) return false;
  return Boolean(
    frontmatter.SEO_TITLE.trim() &&
    frontmatter.SEO_DESCRIPTION.trim() &&
    frontmatter.SEO_SLUG.trim() &&
    frontmatter.SEO_TAGS.length > 0,
  );
}

export function parseSeoDraftJson(raw: string): SeoDraft {
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');
  if (jsonStart < 0 || jsonEnd < jsonStart) throw new Error('SEO draft was not valid JSON.');

  const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)) as Partial<SeoDraft>;
  for (const field of ['SEO_TITLE', 'SEO_DESCRIPTION', 'SEO_SLUG', 'SEO_TAGS'] as const) {
    if (!(field in parsed)) throw new Error(`SEO draft missing ${field}.`);
  }

  if (typeof parsed.SEO_TITLE !== 'string') throw new Error('SEO_TITLE must be text.');
  if (typeof parsed.SEO_DESCRIPTION !== 'string') throw new Error('SEO_DESCRIPTION must be text.');
  if (typeof parsed.SEO_SLUG !== 'string') throw new Error('SEO_SLUG must be text.');

  const tags = cleanTags(parsed.SEO_TAGS);
  if (tags.length === 0) throw new Error('SEO_TAGS must contain at least one tag.');

  return {
    SEO_TITLE: parsed.SEO_TITLE.trim(),
    SEO_DESCRIPTION: parsed.SEO_DESCRIPTION.trim(),
    SEO_SLUG: slugify(parsed.SEO_SLUG),
    SEO_TAGS: tags,
  };
}

export function mergeSeoDraft(frontmatter: ArticleFrontmatter, draft: SeoDraft): ArticleFrontmatter {
  return {
    ...frontmatter,
    SEO_TITLE: frontmatter.SEO_TITLE.trim() ? frontmatter.SEO_TITLE : draft.SEO_TITLE,
    SEO_DESCRIPTION: frontmatter.SEO_DESCRIPTION.trim() ? frontmatter.SEO_DESCRIPTION : draft.SEO_DESCRIPTION,
    SEO_SLUG: frontmatter.SEO_SLUG.trim() ? frontmatter.SEO_SLUG : draft.SEO_SLUG,
    SEO_TAGS: frontmatter.SEO_TAGS.length > 0 ? frontmatter.SEO_TAGS : draft.SEO_TAGS,
  };
}

export function buildSeoPrompt(context: ArticleContext): string {
  const frontmatter = context.frontmatter
    ? serializeMarkdownFile(context.frontmatter as unknown as Record<string, unknown>, context.fieldOrder, '').trim()
    : 'No YAML frontmatter loaded.';

  const body = context.body.trim()
    ? truncate(context.body, MAX_BODY_CONTEXT_CHARS)
    : 'No Markdown body loaded.';

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

Current file: ${context.filePath ?? 'unsaved StackEd article'}

YAML frontmatter:
${frontmatter}

Markdown body:
${body}`;
}
```

- [ ] **Step 4: Run SEO helper tests**

Run:

```bash
npm run test -- src/lib/services/seo.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/seo.ts src/lib/services/seo.test.ts
git commit -m "feat: add SEO metadata helpers"
```

---

## Task 3: Extend AI Adapters for SEO Drafts

**Files:**
- Modify: `src/lib/services/ai/adapter.ts`
- Modify: `src/lib/services/ai/claude.ts`
- Modify: `src/lib/services/ai/openai.ts`

- [ ] **Step 1: Extend the AI adapter contract**

In `src/lib/services/ai/adapter.ts`, import `SeoDraft`:

```ts
import type { SeoDraft } from '$lib/services/seo';
```

Then change `AIAdapter` to:

```ts
export interface AIAdapter {
  search(query: string, context?: ArticleContext): Promise<SearchResult>;
  generateSeoDraft(context: ArticleContext): Promise<SeoDraft>;
}
```

- [ ] **Step 2: Implement Claude SEO draft generation**

In `src/lib/services/ai/claude.ts`, update imports:

```ts
import { buildSeoPrompt, parseSeoDraftJson } from '$lib/services/seo';
```

Add this method inside `ClaudeAdapter` after `search()`:

```ts
  async generateSeoDraft(context: ArticleContext) {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: buildSeoPrompt(context),
        },
      ],
    });

    const textBlocks = response.content.filter(b => b.type === 'text');
    const raw = textBlocks.map(b => (b as { type: 'text'; text: string }).text).join('\n');
    return parseSeoDraftJson(raw);
  }
```

- [ ] **Step 3: Implement OpenAI SEO draft generation**

In `src/lib/services/ai/openai.ts`, update imports:

```ts
import { buildSeoPrompt, parseSeoDraftJson } from '$lib/services/seo';
```

Add this method inside `OpenAIAdapter` after `search()`:

```ts
  async generateSeoDraft(context: ArticleContext) {
    const response = await (this.client as any).responses.create({
      model: 'gpt-4o-mini',
      input: buildSeoPrompt(context),
    });

    return parseSeoDraftJson(response.output_text ?? '');
  }
```

- [ ] **Step 4: Verify adapter types**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/ai/adapter.ts src/lib/services/ai/claude.ts src/lib/services/ai/openai.ts
git commit -m "feat: generate SEO drafts with AI adapters"
```

---

## Task 4: Add SEO Fields to the YAML Panel

**Files:**
- Create: `src/lib/components/yaml/FieldTags.svelte`
- Modify: `src/lib/components/yaml/YamlPanel.svelte`

- [ ] **Step 1: Create an array-backed tag field component**

Create `src/lib/components/yaml/FieldTags.svelte`:

```svelte
<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let {
    label,
    field,
  }: {
    label: string;
    field: keyof ArticleFrontmatter;
  } = $props();

  let rawValue = $derived.by(() => {
    const value = documentStore.frontmatter?.[field];
    return Array.isArray(value) ? value.join(', ') : String(value ?? '');
  });

  function update(value: string) {
    documentStore.patchField(
      field,
      value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
    );
  }
</script>

<div class="flex flex-col gap-0.5">
  <label class="text-xs font-medium text-dark-300 uppercase tracking-wide">{label}</label>
  <input
    type="text"
    value={rawValue}
    placeholder="tag one, tag two, tag three"
    oninput={(e) => update((e.target as HTMLInputElement).value)}
    class="text-sm border border-dark-600 rounded px-2 py-1"
  />
</div>
```

- [ ] **Step 2: Render SEO fields in `YamlPanel.svelte`**

Add this import:

```ts
  import FieldTags from './FieldTags.svelte';
```

Add this section after the **Article Structure** section:

```svelte
    <!-- SEO group -->
    <section>
      <h3 class="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2">SEO</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="SEO Title" field="SEO_TITLE" type="textarea" rows={2} />
        <FieldFree label="SEO Description" field="SEO_DESCRIPTION" type="textarea" rows={3} />
        <FieldFree label="SEO Slug" field="SEO_SLUG" type="text" />
        <FieldTags label="SEO Tags" field="SEO_TAGS" />
      </div>
    </section>
```

- [ ] **Step 3: Verify Svelte types**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/yaml/FieldTags.svelte src/lib/components/yaml/YamlPanel.svelte
git commit -m "feat: show SEO fields in YAML panel"
```

---

## Task 5: Add the Pre-Posting SEO Gate Action

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Import SEO helpers**

In `src/App.svelte`, add these imports:

```ts
  import { createAdapter } from '$lib/services/ai/adapter';
  import { isSeoComplete, mergeSeoDraft } from '$lib/services/seo';
```

- [ ] **Step 2: Add SEO gate state**

Near the existing `$state` declarations, add:

```ts
  let seoLoading = $state(false);
```

- [ ] **Step 3: Add the SEO preparation handler**

Add this function after `getFrontmatterForSave()`:

```ts
  async function handlePrepareSeo() {
    if (!documentStore.frontmatter) return;
    if (isSeoComplete(documentStore.frontmatter)) {
      alert('SEO fields are already complete.');
      return;
    }
    if (!settingsStore.hasValidKey) {
      alert('Add an AI API key in Settings before generating SEO.');
      return;
    }

    seoLoading = true;
    try {
      const frontmatter = getFrontmatterForSave();
      const adapter = createAdapter(settingsStore.provider, settingsStore.apiKey);
      const draft = await adapter.generateSeoDraft({
        frontmatter,
        fieldOrder: documentStore.fieldOrder,
        body: documentStore.body,
        filePath: documentStore.filePath,
      });
      const merged = mergeSeoDraft(frontmatter, draft);
      documentStore.replaceFrontmatter(merged);
      documentStore.patchField('SEO_TAGS', merged.SEO_TAGS);
      alert('SEO draft generated. Review the SEO fields in the YAML panel, then save before export/posting.');
    } catch (e) {
      alert('SEO generation failed: ' + (e instanceof Error ? e.message : e));
    } finally {
      seoLoading = false;
    }
  }
```

The final `patchField('SEO_TAGS', merged.SEO_TAGS)` call deliberately writes the same merged value back so the document is marked dirty without changing the merged frontmatter.

- [ ] **Step 4: Add the header button**

In the header button group, after `Save as...`, add:

```svelte
    <button
      onclick={handlePrepareSeo}
      disabled={!documentStore.frontmatter || seoLoading}
      class="px-4 py-2.5 text-base border border-dark-600 rounded hover:bg-dark-700 disabled:opacity-50 disabled:cursor-default"
      title="Generate SEO metadata before export/posting"
    >
      {seoLoading ? 'SEO…' : 'Prepare SEO'}
    </button>
```

- [ ] **Step 5: Verify app compiles**

Run:

```bash
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.svelte
git commit -m "feat: add pre-posting SEO gate action"
```

---

## Task 6: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run full validators**

Run:

```bash
npm run test
npm run check
```

Expected: both commands pass.

- [ ] **Step 2: Manual smoke test in StackEd**

Run:

```bash
npm run dev
```

Open the app and verify:

1. Open an article.
2. Confirm the YAML panel has an **SEO** section.
3. Leave SEO fields blank.
4. Click **Prepare SEO**.
5. Confirm SEO fields populate.
6. Edit `SEO_TAGS` as comma-separated text.
7. Save.
8. Reopen the Markdown file and confirm `SEO_TAGS` is stored as a YAML array.

- [ ] **Step 3: Confirm no uncommitted implementation changes remain**

Run:

```bash
git status --short
```

Expected: no modified files from the SEO implementation tasks. If files are listed, inspect them with `git diff` and either commit them with the task they belong to or revert accidental changes before finishing.
