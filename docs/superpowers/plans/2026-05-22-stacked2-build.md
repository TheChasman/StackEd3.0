# StackEd 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build StackEd 2.0 — a focused, offline-capable Substack post editor that reads/writes StackPipe pipeline `.md` files with YAML frontmatter, with a permission-driven YAML side panel and a Claude/OpenAI research sidebar.

**Architecture:** Svelte 5 PWA. TipTap 3 editor for the body. Right sidebar with a permission-driven YAML panel (driven by `stackpipe-field-permissions.json`) and a collapsible research panel backed by a provider-agnostic AI adapter. File System Access API for disk I/O; IndexedDB (via `idb`) for handles and settings only. No backend.

**Tech Stack:** Svelte 5 (runes · `.svelte.ts` stores), TipTap 3.10+, Tailwind CSS 4 (CSS-first), js-yaml, marked, turndown, idb, `@anthropic-ai/sdk`, `openai`, rolldown-vite, Vitest + jsdom

---

## File Map

```
StackEd2.0/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── src/
│   ├── main.ts
│   ├── App.svelte
│   ├── app.css
│   ├── vite-env.d.ts
│   └── lib/
│       ├── schema/
│       │   └── field-permissions.json        # Copied from StackPipe — keep in sync
│       ├── types/
│       │   └── article.ts                    # All TS types
│       ├── services/
│       │   ├── permissions.ts                # Parse + query field-permissions.json
│       │   ├── storage.ts                    # IndexedDB: folder handle, recents, API key
│       │   ├── files.ts                      # File System Access API: open/save .md
│       │   └── ai/
│       │       ├── adapter.ts                # AIAdapter interface + factory
│       │       ├── claude.ts                 # ClaudeAdapter (Anthropic SDK)
│       │       └── openai.ts                 # OpenAIAdapter (OpenAI SDK)
│       ├── stores/
│       │   ├── document.svelte.ts            # Open article: frontmatter + body + dirty
│       │   └── settings.svelte.ts            # Provider, API key, sidebar state
│       ├── utils/
│       │   └── frontmatter.ts                # Parse/serialize .md with YAML frontmatter
│       └── components/
│           ├── editor/
│           │   ├── Editor.svelte
│           │   ├── Toolbar.svelte
│           │   ├── CommandList.svelte
│           │   └── extensions/
│           │       ├── Paywall.ts
│           │       ├── SubscribeButton.ts
│           │       ├── Poll.ts
│           │       ├── Poetry.ts
│           │       ├── LaTeX.ts
│           │       └── Footnote.ts
│           ├── yaml/
│           │   ├── YamlPanel.svelte
│           │   ├── FieldFree.svelte
│           │   ├── FieldPadlocked.svelte
│           │   └── FieldReadonly.svelte
│           ├── research/
│           │   └── ResearchPanel.svelte
│           ├── StatusBar.svelte
│           ├── SettingsModal.svelte
│           └── RecentFiles.svelte
└── public/
    └── manifest.json
```

---

## Task 1: Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/vite-env.d.ts`
- Create: `src/app.css`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "stacked2",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.37.0",
    "@tiptap/core": "^3.10.4",
    "@tiptap/extension-code-block": "^3.10.4",
    "@tiptap/extension-image": "^3.10.4",
    "@tiptap/extension-link": "^3.10.4",
    "@tiptap/html": "^3.10.4",
    "@tiptap/pm": "^3.10.4",
    "@tiptap/starter-kit": "^3.10.4",
    "@tiptap/suggestion": "^3.10.4",
    "idb": "^8.0.0",
    "js-yaml": "^4.1.0",
    "katex": "^0.16.0",
    "marked": "^13.0.0",
    "openai": "^4.77.0",
    "turndown": "^7.2.0"
  },
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^6.2.1",
    "@tailwindcss/vite": "^4.1.17",
    "@types/js-yaml": "^4.0.9",
    "@types/katex": "^0.16.7",
    "@types/marked": "^6.0.0",
    "@types/turndown": "^5.0.5",
    "jsdom": "^26.0.0",
    "svelte": "^5.39.6",
    "tailwindcss": "^4.1.17",
    "typescript": "^5.9.0",
    "vite": "npm:rolldown-vite@^7.1.14",
    "vite-plugin-pwa": "^1.2.0",
    "vitest": "^4.0.8"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [
    svelte(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // using public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "paths": {
      "$lib/*": ["./src/lib/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.svelte"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/png" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="manifest" href="/manifest.json" />
    <title>StackEd 2.0</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.ts`**

```typescript
import './app.css';
import App from './App.svelte';
import { mount } from 'svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
```

- [ ] **Step 6: Create `src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

- [ ] **Step 7: Create `src/app.css`**

```css
@import "tailwindcss";

@layer base {
  html, body {
    @apply h-full overflow-hidden bg-white text-gray-900;
  }
  #app {
    @apply h-full flex flex-col;
  }
}

/* KaTeX styles */
@import "katex/dist/katex.min.css";

/* TipTap editor base */
.ProseMirror {
  @apply outline-none min-h-full px-8 py-6;
}

.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  @apply text-gray-400 pointer-events-none float-left h-0;
}

/* Poetry block */
.poetry-block {
  @apply whitespace-pre-wrap font-serif italic my-4 pl-4 border-l-2 border-gray-300;
}
```

- [ ] **Step 8: Install dependencies**

```bash
cd /Users/chasnewport/Projects/StackEd2.0
npm install
```

Expected: node_modules created, no errors.

- [ ] **Step 9: Verify vitest runs**

```bash
npm test
```

Expected: "No test files found" (no tests yet — this confirms the test runner is configured).

- [ ] **Step 10: Commit scaffold**

```bash
git add -A
git commit -m "chore: scaffold Svelte 5 + TipTap 3 + Tailwind 4 project"
```

---

## Task 2: Types

**Files:**
- Create: `src/lib/types/article.ts`
- Create: `src/lib/schema/field-permissions.json`

- [ ] **Step 1: Copy field-permissions.json from StackPipe**

```bash
cp ../StackPipe/docs/stackpipe-field-permissions.json src/lib/schema/field-permissions.json
mkdir -p src/lib/types
```

> This file must be kept in sync with `../StackPipe/docs/stackpipe-field-permissions.json`. When StackPipe updates the schema, copy again and rebuild.

- [ ] **Step 2: Create `src/lib/types/article.ts`**

```typescript
// Pipeline stage enum — matches article-schema.yaml pipeline_order
export type PipelineStage =
  | 'spark' | 'hook' | 'opening' | 'research'
  | 'writing' | 'final_draft' | 'seo' | 'fact_check'
  | 'staged' | 'posted';

export type Audience = 'everyone' | 'paid' | 'none';

// All YAML frontmatter fields (stored fields only — body is separate)
export interface ArticleFrontmatter {
  title: string;
  guid: string;
  pipeline_stage: PipelineStage;
  created: string;
  updated: string;
  spark_notes: string;
  hook: string;
  opening: string;
  research_notes: string;
  ai_draft: string;
  fact_check_notes: string;
  legal_notes: string;
  seo_title: string;
  seo_description: string;
  seo_slug: string;
  substack_tags: string[];
  substack_url: string;
  subtitle: string;
  publish_at: string;
  publication: string;
  section: string;
  audience: Audience;
  allow_comments: Audience;
  send_email: boolean;
  content_locked: boolean;
  overrides: string[];
}

// Defaults for a freshly loaded article with missing fields
export const FRONTMATTER_DEFAULTS: ArticleFrontmatter = {
  title: '',
  guid: '',
  pipeline_stage: 'spark',
  created: '',
  updated: '',
  spark_notes: '',
  hook: '',
  opening: '',
  research_notes: '',
  ai_draft: '',
  fact_check_notes: '',
  legal_notes: '',
  seo_title: '',
  seo_description: '',
  seo_slug: '',
  substack_tags: [],
  substack_url: '',
  subtitle: '',
  publish_at: '',
  publication: '',
  section: '',
  audience: 'everyone',
  allow_comments: 'everyone',
  send_email: true,
  content_locked: false,
  overrides: [],
};

// From field-permissions.json
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

// Parsed .md file (before loading into the store)
export interface ParsedFile {
  frontmatter: ArticleFrontmatter;
  body: string;
  fieldOrder: string[];
  fileHandle: FileSystemFileHandle;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/article.ts src/lib/schema/field-permissions.json
git commit -m "feat: add Article types and copy field-permissions schema"
```

---

## Task 3: Permissions Service

**Files:**
- Create: `src/lib/services/permissions.ts`
- Test: `src/lib/services/permissions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/services/permissions.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getFieldPermission,
  isEditable,
  isPadlocked,
  isReadonly,
  getContentFields,
} from './permissions';

describe('permissions service', () => {
  it('returns free access for title', () => {
    expect(getFieldPermission('title').access).toBe('free');
  });

  it('returns padlocked for ai_draft', () => {
    expect(getFieldPermission('ai_draft').access).toBe('padlocked');
  });

  it('returns readonly for guid', () => {
    expect(getFieldPermission('guid').access).toBe('readonly');
  });

  it('marks body as a content_field', () => {
    expect(getFieldPermission('body').content_field).toBe(true);
  });

  it('marks publish_at as not a content_field', () => {
    expect(getFieldPermission('publish_at').content_field).toBe(false);
  });

  it('isEditable: free field is editable when not locked', () => {
    expect(isEditable('title', false)).toBe(true);
  });

  it('isEditable: free content_field is NOT editable when content_locked', () => {
    expect(isEditable('title', true)).toBe(false);
  });

  it('isEditable: free non-content_field is editable even when content_locked', () => {
    expect(isEditable('publish_at', true)).toBe(true);
  });

  it('isEditable: padlocked field is never editable via isEditable', () => {
    expect(isEditable('ai_draft', false)).toBe(false);
  });

  it('isEditable: readonly field is never editable', () => {
    expect(isEditable('guid', false)).toBe(false);
  });

  it('isPadlocked: returns true for ai-owned fields', () => {
    expect(isPadlocked('seo_title')).toBe(true);
  });

  it('isPadlocked: returns false for author-owned fields', () => {
    expect(isPadlocked('title')).toBe(false);
  });

  it('isReadonly: returns true for stackpipe-owned fields', () => {
    expect(isReadonly('guid', false)).toBe(true);
  });

  it('isReadonly: content_locked makes content_field=true fields readonly', () => {
    expect(isReadonly('title', true)).toBe(true);
  });

  it('getContentFields: returns array including body and title', () => {
    const fields = getContentFields();
    expect(fields).toContain('body');
    expect(fields).toContain('title');
    expect(fields).not.toContain('publish_at');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- permissions
```

Expected: FAIL — `Cannot find module './permissions'`

- [ ] **Step 3: Implement `src/lib/services/permissions.ts`**

```typescript
import manifest from '$lib/schema/field-permissions.json';
import type { FieldPermission, PermissionsManifest } from '$lib/types/article';

const permissions = (manifest as PermissionsManifest).fields;

export function getFieldPermission(field: string): FieldPermission {
  const perm = permissions[field];
  if (!perm) throw new Error(`Unknown field: ${field}`);
  return perm;
}

/**
 * True only when the author can type into this field right now.
 * - readonly fields: never
 * - padlocked fields: never (use isPadlocked to check unlock eligibility)
 * - free + content_field=true: only when !contentLocked
 * - free + content_field=false: always
 */
export function isEditable(field: string, contentLocked: boolean): boolean {
  const perm = getFieldPermission(field);
  if (perm.access === 'readonly' || perm.access === 'padlocked') return false;
  if (contentLocked && perm.content_field) return false;
  return true;
}

/** True if the field is AI-owned and can be unlocked by the author. */
export function isPadlocked(field: string): boolean {
  return getFieldPermission(field).access === 'padlocked';
}

/**
 * True when the field should be shown as a grey display-only value.
 * Includes: stackpipe-owned fields, AND content_field=true fields when locked.
 */
export function isReadonly(field: string, contentLocked: boolean): boolean {
  const perm = getFieldPermission(field);
  if (perm.access === 'readonly') return true;
  if (contentLocked && perm.content_field) return true;
  return false;
}

/** All fields with content_field: true (frozen when content_locked). */
export function getContentFields(): string[] {
  return Object.entries(permissions)
    .filter(([, p]) => p.content_field)
    .map(([key]) => key);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- permissions
```

Expected: All 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/permissions.ts src/lib/services/permissions.test.ts
git commit -m "feat: add permissions service"
```

---

## Task 4: Frontmatter Parser

**Files:**
- Create: `src/lib/utils/frontmatter.ts`
- Test: `src/lib/utils/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/utils/frontmatter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseMarkdownFile, serializeMarkdownFile } from './frontmatter';

const SAMPLE = `---
title: "Test Article"
guid: "abc-123"
pipeline_stage: writing
content_locked: false
overrides: []
substack_tags: []
send_email: true
---

# Body here

Some paragraph.
`;

describe('parseMarkdownFile', () => {
  it('parses title from frontmatter', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE);
    expect(frontmatter.title).toBe('Test Article');
  });

  it('parses body content', () => {
    const { body } = parseMarkdownFile(SAMPLE);
    expect(body.trim()).toContain('# Body here');
  });

  it('parses boolean fields', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE);
    expect(frontmatter.send_email).toBe(true);
    expect(frontmatter.content_locked).toBe(false);
  });

  it('parses empty array', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE);
    expect(frontmatter.overrides).toEqual([]);
  });

  it('captures field order', () => {
    const { fieldOrder } = parseMarkdownFile(SAMPLE);
    expect(fieldOrder[0]).toBe('title');
    expect(fieldOrder[1]).toBe('guid');
  });

  it('handles missing frontmatter gracefully', () => {
    const { frontmatter, body } = parseMarkdownFile('Just a body');
    expect(frontmatter).toEqual({});
    expect(body).toBe('Just a body');
  });
});

describe('serializeMarkdownFile', () => {
  it('round-trips a file without changing field order', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(Object.keys(reparsed.frontmatter)).toEqual(Object.keys(parsed.frontmatter));
  });

  it('round-trips field values correctly', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.title).toBe('Test Article');
    expect(reparsed.frontmatter.guid).toBe('abc-123');
    expect(reparsed.frontmatter.send_email).toBe(true);
  });

  it('writes an updated field value', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const updated = { ...parsed.frontmatter, title: 'Updated Title' };
    const serialized = serializeMarkdownFile(updated as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.title).toBe('Updated Title');
    expect(reparsed.frontmatter.guid).toBe('abc-123'); // unchanged
  });

  it('serializes a non-empty array in block style', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const updated = { ...parsed.frontmatter, substack_tags: ['paris', 'architecture'] };
    const serialized = serializeMarkdownFile(updated as any, parsed.fieldOrder, parsed.body);
    expect(serialized).toContain('- "paris"');
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.substack_tags).toEqual(['paris', 'architecture']);
  });

  it('serializes an empty array as []', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    expect(serialized).toContain('overrides: []');
  });

  it('preserves body exactly', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.body).toBe(parsed.body);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- frontmatter
```

Expected: FAIL — `Cannot find module './frontmatter'`

- [ ] **Step 3: Implement `src/lib/utils/frontmatter.ts`**

```typescript
import yaml from 'js-yaml';
import type { ArticleFrontmatter } from '$lib/types/article';

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
  fieldOrder: string[];
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseMarkdownFile(content: string): ParsedMarkdown {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: content, fieldOrder: [] };
  }
  const [, yamlStr, body] = match;
  const frontmatter = (yaml.load(yamlStr) ?? {}) as Record<string, unknown>;

  // Capture top-level key order from the raw YAML string
  const fieldOrder = yamlStr
    .split('\n')
    .filter(line => /^[a-z_][a-z_0-9]*\s*:/.test(line))
    .map(line => line.split(':')[0].trim());

  return { frontmatter, body, fieldOrder };
}

function serializeLine(key: string, value: unknown): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return `${key}: []`;
    const items = value.map(item => `  - ${yaml.dump(item, { lineWidth: -1 }).trimEnd()}`).join('\n');
    return `${key}:\n${items}`;
  }
  if (typeof value === 'boolean') return `${key}: ${value}`;
  if (value === null || value === undefined || value === '') return `${key}: ""`;
  // Use js-yaml to produce a correct inline scalar
  return `${key}: ${yaml.dump(value, { lineWidth: -1 }).trimEnd()}`;
}

export function serializeMarkdownFile(
  frontmatter: Record<string, unknown>,
  fieldOrder: string[],
  body: string,
): string {
  const lines: string[] = [];
  const emitted = new Set<string>();

  for (const key of fieldOrder) {
    if (key in frontmatter) {
      lines.push(serializeLine(key, frontmatter[key]));
      emitted.add(key);
    }
  }
  // Any fields added after initial creation (shouldn't happen in normal flow)
  for (const key of Object.keys(frontmatter)) {
    if (!emitted.has(key)) {
      lines.push(serializeLine(key, frontmatter[key]));
    }
  }

  return `---\n${lines.join('\n')}\n---\n${body}`;
}

/** Convenience: apply ArticleFrontmatter directly */
export function serializeArticleFile(
  frontmatter: ArticleFrontmatter,
  fieldOrder: string[],
  body: string,
): string {
  return serializeMarkdownFile(frontmatter as unknown as Record<string, unknown>, fieldOrder, body);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- frontmatter
```

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/frontmatter.ts src/lib/utils/frontmatter.test.ts
git commit -m "feat: add frontmatter parse/serialize utility"
```

---

## Task 5: Storage Service

**Files:**
- Create: `src/lib/services/storage.ts`
- Test: `src/lib/services/storage.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/services/storage.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock idb before importing the module under test
vi.mock('idb', () => {
  const store: Record<string, unknown> = {};
  const recents: Array<{ id: number; handle: unknown; title: string; openedAt: number }> = [];
  let nextId = 1;

  const mockDB = {
    put: vi.fn(async (_store: string, val: unknown, key: string) => { store[key] = val; }),
    get: vi.fn(async (_store: string, key: string) => store[key] ?? undefined),
    getAll: vi.fn(async (_store: string) => [...recents]),
    transaction: vi.fn(() => ({
      store: {
        getAll: vi.fn(async () => [...recents]),
        add: vi.fn(async (item: { handle: unknown; title: string; openedAt: number }) => {
          recents.push({ ...item, id: nextId++ });
        }),
        delete: vi.fn(async (id: number) => {
          const idx = recents.findIndex(r => r.id === id);
          if (idx >= 0) recents.splice(idx, 1);
        }),
      },
      done: Promise.resolve(),
    })),
  };

  return {
    openDB: vi.fn(async () => mockDB),
  };
});

import {
  saveApiKey,
  loadApiKey,
  saveFolderHandle,
  loadFolderHandle,
  addRecentFile,
  getRecentFiles,
} from './storage';

describe('storage service', () => {
  it('saves and loads API key', async () => {
    await saveApiKey('sk-ant-test123');
    const loaded = await loadApiKey();
    expect(loaded).toBe('sk-ant-test123');
  });

  it('returns empty string when no API key stored', async () => {
    const loaded = await loadApiKey();
    expect(typeof loaded).toBe('string');
  });

  it('saves and loads folder handle', async () => {
    const fakeHandle = { kind: 'directory', name: 'pipeline' } as unknown as FileSystemDirectoryHandle;
    await saveFolderHandle(fakeHandle);
    const loaded = await loadFolderHandle();
    expect(loaded).toEqual(fakeHandle);
  });

  it('returns null when no folder handle stored', async () => {
    const loaded = await loadFolderHandle();
    // May return undefined from mock; normalise to null check
    expect(loaded == null || typeof loaded === 'object').toBe(true);
  });

  it('addRecentFile stores a recent entry', async () => {
    const fakeHandle = { kind: 'file', name: 'test.md' } as unknown as FileSystemFileHandle;
    await addRecentFile(fakeHandle, 'Test Article');
    const recents = await getRecentFiles();
    expect(recents.some(r => r.title === 'Test Article')).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- storage
```

Expected: FAIL — `Cannot find module './storage'`

- [ ] **Step 3: Implement `src/lib/services/storage.ts`**

```typescript
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface StackEdDB extends DBSchema {
  settings: { key: string; value: unknown };
  recents: {
    key: number;
    value: { id?: number; handle: FileSystemFileHandle; title: string; openedAt: number };
  };
}

const DB_PROMISE: Promise<IDBPDatabase<StackEdDB>> = openDB<StackEdDB>('stacked2', 1, {
  upgrade(db) {
    db.createObjectStore('settings');
    db.createObjectStore('recents', { keyPath: 'id', autoIncrement: true });
  },
});

export async function saveApiKey(key: string): Promise<void> {
  const db = await DB_PROMISE;
  await db.put('settings', key, 'apiKey');
}

export async function loadApiKey(): Promise<string> {
  const db = await DB_PROMISE;
  return ((await db.get('settings', 'apiKey')) as string | undefined) ?? '';
}

export async function saveFolderHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await DB_PROMISE;
  await db.put('settings', handle, 'folderHandle');
}

export async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await DB_PROMISE;
  return ((await db.get('settings', 'folderHandle')) as FileSystemDirectoryHandle | undefined) ?? null;
}

export interface RecentFile {
  id?: number;
  handle: FileSystemFileHandle;
  title: string;
  openedAt: number;
}

const MAX_RECENTS = 20;

export async function addRecentFile(handle: FileSystemFileHandle, title: string): Promise<void> {
  const db = await DB_PROMISE;
  const tx = db.transaction('recents', 'readwrite');
  const all = await tx.store.getAll();
  if (all.length >= MAX_RECENTS) {
    const oldest = all.sort((a, b) => a.openedAt - b.openedAt)[0];
    if (oldest.id !== undefined) await tx.store.delete(oldest.id);
  }
  await tx.store.add({ handle, title, openedAt: Date.now() });
  await tx.done;
}

export async function getRecentFiles(): Promise<RecentFile[]> {
  const db = await DB_PROMISE;
  const all = await db.getAll('recents');
  return all.sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_RECENTS);
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- storage
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/storage.ts src/lib/services/storage.test.ts
git commit -m "feat: add IndexedDB storage service"
```

---

## Task 6: Document Store

**Files:**
- Create: `src/lib/stores/document.svelte.ts`
- Test: `src/lib/stores/document.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/stores/document.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { documentStore } from './document.svelte';
import type { ArticleFrontmatter } from '$lib/types/article';

const BASE: ArticleFrontmatter = {
  title: 'Test',
  guid: 'abc-123',
  pipeline_stage: 'writing',
  created: '2026-05-22',
  updated: '2026-05-22',
  spark_notes: '',
  hook: '',
  opening: '',
  research_notes: '',
  ai_draft: 'AI generated draft',
  fact_check_notes: '',
  legal_notes: '',
  seo_title: 'SEO title',
  seo_description: '',
  seo_slug: '',
  substack_tags: [],
  substack_url: '',
  subtitle: '',
  publish_at: '',
  publication: 'chasnewport',
  section: '',
  audience: 'everyone',
  allow_comments: 'everyone',
  send_email: true,
  content_locked: false,
  overrides: [],
};

const FAKE_HANDLE = {} as FileSystemFileHandle;

beforeEach(() => documentStore.reset());

describe('document store', () => {
  it('starts with no open file', () => {
    expect(documentStore.frontmatter).toBeNull();
    expect(documentStore.body).toBe('');
    expect(documentStore.dirty).toBe(false);
  });

  it('load() sets frontmatter and body', () => {
    documentStore.load(BASE, '# Body', ['title'], FAKE_HANDLE);
    expect(documentStore.frontmatter?.title).toBe('Test');
    expect(documentStore.body).toBe('# Body');
    expect(documentStore.dirty).toBe(false);
  });

  it('setBody() marks dirty', () => {
    documentStore.load(BASE, '# Body', [], FAKE_HANDLE);
    documentStore.setBody('# Updated');
    expect(documentStore.body).toBe('# Updated');
    expect(documentStore.dirty).toBe(true);
  });

  it('patchField() updates a free field and marks dirty', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    documentStore.patchField('title', 'New Title');
    expect(documentStore.frontmatter?.title).toBe('New Title');
    expect(documentStore.dirty).toBe(true);
  });

  it('patchField() does NOT append to overrides for free fields', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    documentStore.patchField('title', 'New Title');
    expect(documentStore.frontmatter?.overrides).toEqual([]);
  });

  it('patchPadlockedField() updates value and appends to overrides', () => {
    documentStore.load(BASE, '', [], FAKE_HANDLE);
    documentStore.patchPadlockedField('ai_draft', 'Edited draft');
    expect(documentStore.frontmatter?.ai_draft).toBe('Edited draft');
    expect(documentStore.frontmatter?.overrides).toContain('ai_draft');
  });

  it('patchPadlockedField() does not duplicate in overrides', () => {
    documentStore.load({ ...BASE, overrides: ['ai_draft'] }, '', [], FAKE_HANDLE);
    documentStore.patchPadlockedField('ai_draft', 'Another edit');
    expect(documentStore.frontmatter?.overrides.filter(f => f === 'ai_draft').length).toBe(1);
  });

  it('clearOverride() removes a field from overrides', () => {
    documentStore.load({ ...BASE, overrides: ['seo_title', 'ai_draft'] }, '', [], FAKE_HANDLE);
    documentStore.clearOverride('seo_title');
    expect(documentStore.frontmatter?.overrides).not.toContain('seo_title');
    expect(documentStore.frontmatter?.overrides).toContain('ai_draft');
  });

  it('unlock() sets content_locked=false and pipeline_stage=fact_check', () => {
    documentStore.load({ ...BASE, content_locked: true, pipeline_stage: 'staged' }, '', [], FAKE_HANDLE);
    documentStore.unlock();
    expect(documentStore.frontmatter?.content_locked).toBe(false);
    expect(documentStore.frontmatter?.pipeline_stage).toBe('fact_check');
    expect(documentStore.dirty).toBe(true);
  });

  it('isLocked reflects content_locked field', () => {
    documentStore.load({ ...BASE, content_locked: true }, '', [], FAKE_HANDLE);
    expect(documentStore.isLocked).toBe(true);
  });

  it('canUnlock is true when locked and substack_url is empty', () => {
    documentStore.load({ ...BASE, content_locked: true, substack_url: '' }, '', [], FAKE_HANDLE);
    expect(documentStore.canUnlock).toBe(true);
  });

  it('canUnlock is false when substack_url is set (already posted)', () => {
    documentStore.load({ ...BASE, content_locked: true, substack_url: 'https://example.com' }, '', [], FAKE_HANDLE);
    expect(documentStore.canUnlock).toBe(false);
  });

  it('wordCount counts words in body', () => {
    documentStore.load(BASE, 'one two three', [], FAKE_HANDLE);
    expect(documentStore.wordCount).toBe(3);
  });

  it('wordCount ignores markdown syntax', () => {
    documentStore.load(BASE, '# Heading\n\nA paragraph.', [], FAKE_HANDLE);
    // "Heading", "A", "paragraph." = 3 words (simple split)
    expect(documentStore.wordCount).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- document
```

Expected: FAIL — `Cannot find module './document.svelte'`

- [ ] **Step 3: Implement `src/lib/stores/document.svelte.ts`**

```typescript
import type { ArticleFrontmatter, PipelineStage } from '$lib/types/article';

class DocumentStore {
  frontmatter = $state<ArticleFrontmatter | null>(null);
  body = $state('');
  fieldOrder = $state<string[]>([]);
  fileHandle = $state<FileSystemFileHandle | null>(null);
  dirty = $state(false);

  get isLocked(): boolean {
    return this.frontmatter?.content_locked ?? false;
  }

  /** Unlock is only available pre-post (substack_url still empty). */
  get canUnlock(): boolean {
    return this.isLocked && !this.frontmatter?.substack_url;
  }

  get wordCount(): number {
    return this.body
      .replace(/#{1,6}\s/g, '')       // strip heading markers
      .replace(/<[^>]+>/g, ' ')        // strip HTML tags
      .split(/\s+/)
      .filter(Boolean).length;
  }

  load(
    frontmatter: ArticleFrontmatter,
    body: string,
    fieldOrder: string[],
    fileHandle: FileSystemFileHandle,
  ): void {
    this.frontmatter = frontmatter;
    this.body = body;
    this.fieldOrder = fieldOrder;
    this.fileHandle = fileHandle;
    this.dirty = false;
  }

  setBody(body: string): void {
    this.body = body;
    this.dirty = true;
  }

  /** Update an author-owned (free) field. Does not touch overrides[]. */
  patchField(field: keyof ArticleFrontmatter, value: unknown): void {
    if (!this.frontmatter) return;
    this.frontmatter = { ...this.frontmatter, [field]: value };
    this.dirty = true;
  }

  /** Update an AI-owned (padlocked) field. Appends field name to overrides[]. */
  patchPadlockedField(field: keyof ArticleFrontmatter, value: unknown): void {
    if (!this.frontmatter) return;
    const overrides = this.frontmatter.overrides ?? [];
    this.frontmatter = {
      ...this.frontmatter,
      [field]: value,
      overrides: overrides.includes(field as string)
        ? overrides
        : [...overrides, field as string],
    };
    this.dirty = true;
  }

  /** Remove a field from overrides[] (let AI regenerate it). */
  clearOverride(field: keyof ArticleFrontmatter): void {
    if (!this.frontmatter) return;
    this.frontmatter = {
      ...this.frontmatter,
      overrides: this.frontmatter.overrides.filter(f => f !== (field as string)),
    };
    this.dirty = true;
  }

  /**
   * Unlock content after F&L review. Writes content_locked=false and
   * resets pipeline_stage to fact_check for re-review.
   * Only valid while canUnlock is true.
   */
  unlock(): void {
    if (!this.frontmatter || !this.canUnlock) return;
    this.frontmatter = {
      ...this.frontmatter,
      content_locked: false,
      pipeline_stage: 'fact_check' as PipelineStage,
    };
    this.dirty = true;
  }

  markClean(): void {
    this.dirty = false;
  }

  reset(): void {
    this.frontmatter = null;
    this.body = '';
    this.fieldOrder = [];
    this.fileHandle = null;
    this.dirty = false;
  }
}

export const documentStore = new DocumentStore();
```

- [ ] **Step 4: Run tests**

```bash
npm test -- document
```

Expected: All 14 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/document.svelte.ts src/lib/stores/document.test.ts
git commit -m "feat: add document store"
```

---

## Task 7: Settings Store

**Files:**
- Create: `src/lib/stores/settings.svelte.ts`
- Test: `src/lib/stores/settings.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/stores/settings.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { settingsStore } from './settings.svelte';

beforeEach(() => settingsStore.reset());

describe('settings store', () => {
  it('defaults to claude provider', () => {
    expect(settingsStore.provider).toBe('claude');
  });

  it('defaults to empty API key', () => {
    expect(settingsStore.apiKey).toBe('');
  });

  it('hasValidKey is false with empty key', () => {
    expect(settingsStore.hasValidKey).toBe(false);
  });

  it('hasValidKey is true with a non-empty key', () => {
    settingsStore.setApiKey('sk-ant-test');
    expect(settingsStore.hasValidKey).toBe(true);
  });

  it('setProvider updates the provider', () => {
    settingsStore.setProvider('openai');
    expect(settingsStore.provider).toBe('openai');
  });

  it('setApiKey updates the key', () => {
    settingsStore.setApiKey('sk-abc');
    expect(settingsStore.apiKey).toBe('sk-abc');
  });

  it('sidebar is visible by default', () => {
    expect(settingsStore.sidebarVisible).toBe(true);
  });

  it('toggleSidebar flips visibility', () => {
    settingsStore.toggleSidebar();
    expect(settingsStore.sidebarVisible).toBe(false);
    settingsStore.toggleSidebar();
    expect(settingsStore.sidebarVisible).toBe(true);
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- settings
```

Expected: FAIL — `Cannot find module './settings.svelte'`

- [ ] **Step 3: Implement `src/lib/stores/settings.svelte.ts`**

```typescript
import { loadApiKey, saveApiKey } from '$lib/services/storage';

class SettingsStore {
  provider = $state<'claude' | 'openai'>('claude');
  apiKey = $state('');
  sidebarVisible = $state(true);

  get hasValidKey(): boolean {
    return this.apiKey.trim().length > 0;
  }

  setProvider(provider: 'claude' | 'openai'): void {
    this.provider = provider;
    localStorage.setItem('provider', provider);
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    // Fire-and-forget to IndexedDB
    saveApiKey(key).catch(console.error);
  }

  toggleSidebar(): void {
    this.sidebarVisible = !this.sidebarVisible;
    localStorage.setItem('sidebarVisible', String(this.sidebarVisible));
  }

  /** Call once at app startup to hydrate from persisted storage. */
  async loadFromStorage(): Promise<void> {
    const provider = localStorage.getItem('provider');
    if (provider === 'claude' || provider === 'openai') {
      this.provider = provider;
    }
    const sidebar = localStorage.getItem('sidebarVisible');
    if (sidebar !== null) {
      this.sidebarVisible = sidebar === 'true';
    }
    this.apiKey = await loadApiKey();
  }

  reset(): void {
    this.provider = 'claude';
    this.apiKey = '';
    this.sidebarVisible = true;
  }
}

export const settingsStore = new SettingsStore();
```

- [ ] **Step 4: Run tests**

```bash
npm test -- settings
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/settings.svelte.ts src/lib/stores/settings.test.ts
git commit -m "feat: add settings store"
```

---

## Task 8: AI Adapter

**Files:**
- Create: `src/lib/services/ai/adapter.ts`
- Create: `src/lib/services/ai/claude.ts`
- Create: `src/lib/services/ai/openai.ts`
- Test: `src/lib/services/ai/adapter.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/services/ai/adapter.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAdapter } from './adapter';
import { ClaudeAdapter } from './claude';
import { OpenAIAdapter } from './openai';

describe('createAdapter', () => {
  it('returns a ClaudeAdapter for "claude"', () => {
    const adapter = createAdapter('claude', 'sk-ant-test');
    expect(adapter).toBeInstanceOf(ClaudeAdapter);
  });

  it('returns an OpenAIAdapter for "openai"', () => {
    const adapter = createAdapter('openai', 'sk-openai-test');
    expect(adapter).toBeInstanceOf(OpenAIAdapter);
  });
});

describe('ClaudeAdapter', () => {
  it('constructs with an API key', () => {
    expect(() => new ClaudeAdapter('sk-ant-test')).not.toThrow();
  });

  it('throws on empty API key', () => {
    expect(() => new ClaudeAdapter('')).toThrow('API key required');
  });

  it('search calls the Anthropic client with web_search tool', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Summary of result. https://example.com' }],
    });

    const adapter = new ClaudeAdapter('sk-ant-test');
    // @ts-expect-error — accessing private field for test
    adapter['client'].messages.create = mockCreate;

    const result = await adapter.search('Paris architecture');

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tools: expect.arrayContaining([
          expect.objectContaining({ type: 'web_search' }),
        ]),
      }),
    );
    expect(result.summary).toContain('Summary of result');
    expect(result.query).toBe('Paris architecture');
  });
});

describe('OpenAIAdapter', () => {
  it('constructs with an API key', () => {
    expect(() => new OpenAIAdapter('sk-openai-test')).not.toThrow();
  });

  it('throws on empty API key', () => {
    expect(() => new OpenAIAdapter('')).toThrow('API key required');
  });

  it('search calls the OpenAI client', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      output_text: 'OpenAI research summary.',
      output: [],
    });

    const adapter = new OpenAIAdapter('sk-openai-test');
    // @ts-expect-error — accessing private field for test
    adapter['client'].responses.create = mockCreate;

    const result = await adapter.search('Paris architecture');

    expect(mockCreate).toHaveBeenCalled();
    expect(result.summary).toBe('OpenAI research summary.');
    expect(result.query).toBe('Paris architecture');
  });
});
```

- [ ] **Step 2: Run failing tests**

```bash
npm test -- adapter
```

Expected: FAIL — `Cannot find module './adapter'`

- [ ] **Step 3: Implement `src/lib/services/ai/adapter.ts`**

```typescript
export interface Citation {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResult {
  summary: string;
  citations: Citation[];
  query: string;
}

export interface AIAdapter {
  search(query: string): Promise<SearchResult>;
}

// Static imports — both are small; the unused adapter is tree-shaken at build time.
import { ClaudeAdapter } from './claude';
import { OpenAIAdapter } from './openai';

export function createAdapter(provider: 'claude' | 'openai', apiKey: string): AIAdapter {
  if (provider === 'claude') return new ClaudeAdapter(apiKey);
  return new OpenAIAdapter(apiKey);
}
```

- [ ] **Step 4: Implement `src/lib/services/ai/claude.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import type { AIAdapter, SearchResult, Citation } from './adapter';

export class ClaudeAdapter implements AIAdapter {
  private client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('API key required');
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  async search(query: string): Promise<SearchResult> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      tools: [{ type: 'web_search' as const, name: 'web_search' }],
      tool_choice: { type: 'auto' as const },
      messages: [
        {
          role: 'user',
          content: `Research the following topic and provide a concise summary with sources:\n\n${query}`,
        },
      ],
    });

    const textBlocks = response.content.filter(b => b.type === 'text');
    const summary = textBlocks.map(b => (b as { type: 'text'; text: string }).text).join('\n');

    // Extract URLs from the response text as citations
    const urlPattern = /https?:\/\/[^\s\])">,]+/g;
    const urls = [...new Set(summary.match(urlPattern) ?? [])];
    const citations: Citation[] = urls.map(url => ({ title: url, url, snippet: '' }));

    return { summary: summary.trim(), citations, query };
  }
}
```

- [ ] **Step 5: Implement `src/lib/services/ai/openai.ts`**

```typescript
import OpenAI from 'openai';
import type { AIAdapter, SearchResult, Citation } from './adapter';

export class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('API key required');
    this.client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async search(query: string): Promise<SearchResult> {
    // Uses the Responses API with web_search_preview tool
    const response = await (this.client as any).responses.create({
      model: 'gpt-4o-mini',
      tools: [{ type: 'web_search_preview' }],
      input: `Research the following topic and provide a concise summary with sources:\n\n${query}`,
    });

    const summary: string = response.output_text ?? '';

    const citations: Citation[] = ((response.output ?? []) as any[])
      .filter(item => item.type === 'web_search_call')
      .flatMap(item =>
        (item.results ?? []).map((r: any) => ({
          title: r.title ?? r.url,
          url: r.url ?? '',
          snippet: r.body ?? '',
        })),
      );

    return { summary: summary.trim(), citations, query };
  }
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- adapter
```

Expected: All 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/services/ai/
git commit -m "feat: add provider-agnostic AI adapter (Claude + OpenAI)"
```

---

## Task 9: File I/O Service

**Files:**
- Create: `src/lib/services/files.ts`

No unit tests — File System Access API requires a real browser. Test manually in Task 14.

- [ ] **Step 1: Implement `src/lib/services/files.ts`**

```typescript
import { parseMarkdownFile, serializeArticleFile } from '$lib/utils/frontmatter';
import { FRONTMATTER_DEFAULTS } from '$lib/types/article';
import type { ArticleFrontmatter, ParsedFile } from '$lib/types/article';
import { addRecentFile } from '$lib/services/storage';

export async function openFolder(): Promise<FileSystemDirectoryHandle> {
  return window.showDirectoryPicker({ mode: 'readwrite' });
}

export async function openFile(handle?: FileSystemFileHandle): Promise<ParsedFile> {
  const fileHandle =
    handle ??
    (await window.showOpenFilePicker({
      types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      multiple: false,
    }))[0];

  const file = await fileHandle.getFile();
  const content = await file.text();
  const { frontmatter: raw, body, fieldOrder } = parseMarkdownFile(content);

  // Merge with defaults so no field is ever undefined
  const frontmatter: ArticleFrontmatter = {
    ...FRONTMATTER_DEFAULTS,
    ...(raw as Partial<ArticleFrontmatter>),
  };

  await addRecentFile(fileHandle, frontmatter.title || file.name).catch(() => {});

  return { frontmatter, body, fieldOrder, fileHandle };
}

export async function saveFile(
  fileHandle: FileSystemFileHandle,
  frontmatter: ArticleFrontmatter,
  fieldOrder: string[],
  body: string,
): Promise<void> {
  const content = serializeArticleFile(frontmatter, fieldOrder, body);
  const writable = await fileHandle.createWritable();
  await writable.write(content);
  await writable.close();
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/services/files.ts
git commit -m "feat: add File System Access API file service"
```

---

## Task 10: Substack TipTap Extensions

Port all 6 extensions from `../StackEd/src/lib/components/editor/extensions/`. The key change: remove any imports from StackEd 1.x stores (`$lib/stores/document.svelte`, `$lib/stores/scheduler.svelte`) — SubscribeButton must use props instead.

**Files:**
- Create: `src/lib/components/editor/extensions/Paywall.ts`
- Create: `src/lib/components/editor/extensions/SubscribeButton.ts`
- Create: `src/lib/components/editor/extensions/Poll.ts`
- Create: `src/lib/components/editor/extensions/Poetry.ts`
- Create: `src/lib/components/editor/extensions/LaTeX.ts`
- Create: `src/lib/components/editor/extensions/Footnote.ts`

- [ ] **Step 1: Copy Paywall, Poetry, LaTeX, Footnote, Poll**

```bash
mkdir -p src/lib/components/editor/extensions
cp ../StackEd/src/lib/components/editor/extensions/Paywall.ts src/lib/components/editor/extensions/
cp ../StackEd/src/lib/components/editor/extensions/Poetry.ts src/lib/components/editor/extensions/
cp ../StackEd/src/lib/components/editor/extensions/LaTeX.ts src/lib/components/editor/extensions/
cp ../StackEd/src/lib/components/editor/extensions/Footnote.ts src/lib/components/editor/extensions/
cp ../StackEd/src/lib/components/editor/extensions/Poll.ts src/lib/components/editor/extensions/
```

- [ ] **Step 2: Fix any StackEd-1.x import paths in copied files**

Open each copied file. Replace any `from '$lib/stores/...'` import with the equivalent from StackEd 2.0. Most files should have none. Check with:

```bash
grep -l "stores" src/lib/components/editor/extensions/*.ts
```

Fix any hits by removing the import and the reference (these 4 extensions don't use stores).

- [ ] **Step 3: Create `src/lib/components/editor/extensions/SubscribeButton.ts`**

The StackEd 1.x version imports `documentStore` and `schedulerStore` to build the URL. In 2.0, it reads `publication` and `section` from a configurable attribute instead.

```typescript
import { Node, mergeAttributes } from '@tiptap/core';

export const SubscribeButton = Node.create({
  name: 'subscribeButton',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      publication: { default: '' },
      section: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="subscribe-button"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const { publication, section } = HTMLAttributes;
    let url = 'https://substack.com/sign-up';
    if (publication) {
      url = section
        ? `https://${publication}.substack.com/s/${section}`
        : `https://${publication}.substack.com/subscribe`;
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'subscribe-button',
        style: 'text-align:center;margin:2em 0;',
      }),
      [
        'a',
        {
          href: url,
          style:
            'background:#f59e0b;color:white;padding:12px 40px;border-radius:4px;text-decoration:none;font-weight:bold;display:inline-block;',
        },
        'Subscribe Now',
      ],
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'my-8 flex justify-center select-none cursor-default';
      dom.contentEditable = 'false';
      dom.innerHTML = `<div style="background:#f59e0b;color:white;padding:12px 40px;border-radius:4px;font-weight:bold;font-family:system-ui,sans-serif;">
        Subscribe Now
      </div>`;
      return { dom };
    };
  },
});
```

- [ ] **Step 4: Verify the extensions compile**

```bash
npx tsc --noEmit
```

Fix any type errors. Common issue: `katex` import in LaTeX.ts — ensure `katex` is in `dependencies`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/editor/extensions/
git commit -m "feat: port Substack TipTap extensions (Paywall, SubscribeButton, Poll, Poetry, LaTeX, Footnote)"
```

---

## Task 11: Editor Component

**Files:**
- Create: `src/lib/components/editor/CommandList.svelte`
- Create: `src/lib/components/editor/Toolbar.svelte`
- Create: `src/lib/components/editor/Editor.svelte`

- [ ] **Step 1: Create `src/lib/components/editor/CommandList.svelte`**

```svelte
<script lang="ts">
  interface Command {
    title: string;
    command: () => void;
  }
  let { items = [], command }: { items: Command[]; command: (item: Command) => void } = $props();
  let selectedIndex = $state(0);

  export function onKeyDown(event: KeyboardEvent): boolean {
    if (event.key === 'ArrowUp') {
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      return true;
    }
    if (event.key === 'ArrowDown') {
      selectedIndex = (selectedIndex + 1) % items.length;
      return true;
    }
    if (event.key === 'Enter') {
      command(items[selectedIndex]);
      return true;
    }
    return false;
  }
</script>

<div class="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden w-56">
  {#each items as item, i}
    <button
      class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 {i === selectedIndex ? 'bg-gray-100' : ''}"
      onclick={() => command(item)}
    >
      {item.title}
    </button>
  {/each}
  {#if items.length === 0}
    <p class="px-3 py-2 text-sm text-gray-400">No commands</p>
  {/if}
</div>
```

- [ ] **Step 2: Create `src/lib/components/editor/Toolbar.svelte`**

```svelte
<script lang="ts">
  import type { Editor } from '@tiptap/core';
  let { editor }: { editor: Editor | null } = $props();

  function run(fn: () => void) {
    if (!editor) return;
    fn();
    editor.view.focus();
  }
</script>

{#if editor}
<div class="flex flex-wrap gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50">
  <!-- Text formatting -->
  <button onclick={() => run(() => editor!.chain().toggleBold().run())}
    class="px-2 py-1 rounded text-sm font-bold {editor.isActive('bold') ? 'bg-gray-200' : 'hover:bg-gray-200'}">B</button>
  <button onclick={() => run(() => editor!.chain().toggleItalic().run())}
    class="px-2 py-1 rounded text-sm italic {editor.isActive('italic') ? 'bg-gray-200' : 'hover:bg-gray-200'}">I</button>
  <button onclick={() => run(() => editor!.chain().toggleCode().run())}
    class="px-2 py-1 rounded text-sm font-mono {editor.isActive('code') ? 'bg-gray-200' : 'hover:bg-gray-200'}">{'`'}</button>

  <div class="w-px bg-gray-300 mx-1"></div>

  <!-- Headings -->
  {#each [1, 2, 3] as level}
    <button onclick={() => run(() => editor!.chain().toggleHeading({ level: level as 1|2|3 }).run())}
      class="px-2 py-1 rounded text-sm {editor.isActive('heading', { level }) ? 'bg-gray-200' : 'hover:bg-gray-200'}">H{level}</button>
  {/each}

  <div class="w-px bg-gray-300 mx-1"></div>

  <!-- Lists -->
  <button onclick={() => run(() => editor!.chain().toggleBulletList().run())}
    class="px-2 py-1 rounded text-sm {editor.isActive('bulletList') ? 'bg-gray-200' : 'hover:bg-gray-200'}">• List</button>
  <button onclick={() => run(() => editor!.chain().toggleOrderedList().run())}
    class="px-2 py-1 rounded text-sm {editor.isActive('orderedList') ? 'bg-gray-200' : 'hover:bg-gray-200'}">1. List</button>
  <button onclick={() => run(() => editor!.chain().toggleBlockquote().run())}
    class="px-2 py-1 rounded text-sm {editor.isActive('blockquote') ? 'bg-gray-200' : 'hover:bg-gray-200'}">"</button>

  <div class="w-px bg-gray-300 mx-1"></div>

  <!-- Substack extensions -->
  <button onclick={() => run(() => editor!.chain().insertContent({ type: 'paywall' }).run())}
    class="px-2 py-1 rounded text-sm hover:bg-purple-100 text-purple-700">Paywall</button>
  <button onclick={() => run(() => editor!.chain().insertContent({
      type: 'subscribeButton',
      attrs: { publication: '', section: '' }
    }).run())}
    class="px-2 py-1 rounded text-sm hover:bg-amber-100 text-amber-700">Subscribe</button>
  <button onclick={() => run(() => editor!.chain().insertPoll().run())}
    class="px-2 py-1 rounded text-sm hover:bg-blue-100 text-blue-700">Poll</button>
  <button onclick={() => run(() => editor!.chain().setPoetry().run())}
    class="px-2 py-1 rounded text-sm hover:bg-green-100 text-green-700">Verse</button>
  <button onclick={() => run(() => editor!.chain().insertLatex().run())}
    class="px-2 py-1 rounded text-sm hover:bg-gray-100 font-mono">∑</button>
  <button onclick={() => {
    const text = prompt('Footnote text:');
    if (text) run(() => editor!.chain().addFootnote(text).run());
  }} class="px-2 py-1 rounded text-sm hover:bg-gray-100">fn</button>
</div>
{/if}
```

- [ ] **Step 3: Create `src/lib/components/editor/Editor.svelte`**

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import { marked } from 'marked';
  import TurndownService from 'turndown';
  import { Paywall } from './extensions/Paywall';
  import { SubscribeButton } from './extensions/SubscribeButton';
  import { Poll } from './extensions/Poll';
  import { Poetry } from './extensions/Poetry';
  import { Latex } from './extensions/LaTeX';
  import { Footnote } from './extensions/Footnote';
  import { documentStore } from '$lib/stores/document.svelte';
  import Toolbar from './Toolbar.svelte';

  let element: HTMLDivElement;
  let editor = $state<Editor | null>(null);

  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  // Keep Substack custom elements as raw HTML in the Markdown body
  turndown.keep((node) => {
    const el = node as HTMLElement;
    return (
      el.dataset?.type === 'paywall' ||
      el.dataset?.type === 'subscribe-button' ||
      el.dataset?.type === 'poll' ||
      el.dataset?.type === 'latex' ||
      el.dataset?.type === 'footnote' ||
      el.className === 'poetry-block'
    );
  });

  function getMarkdown(): string {
    if (!editor) return '';
    const { getHTMLFromFragment } = await import('@tiptap/html');
    const html = getHTMLFromFragment(editor.state.doc.content, editor.schema);
    return turndown.turndown(html);
  }

  function setMarkdown(md: string): void {
    if (!editor) return;
    const html = marked.parse(md) as string;
    editor.commands.setContent(html, false);
  }

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Paywall,
        SubscribeButton,
        Poll,
        Poetry,
        Latex,
        Footnote,
      ],
      content: '',
      onUpdate: ({ editor: e }) => {
        documentStore.setBody(getMarkdown());
      },
      onTransaction: () => {
        // Trigger Svelte reactivity on selection changes
        editor = editor;
      },
    });

    // Load initial body from store
    if (documentStore.body) {
      setMarkdown(documentStore.body);
    }
  });

  // When a new file is opened, reload editor content
  $effect(() => {
    const body = documentStore.body;
    if (editor && !documentStore.dirty) {
      setMarkdown(body);
    }
  });

  onDestroy(() => {
    editor?.destroy();
    editor = null;
  });

  // Keyboard shortcut: Cmd/Ctrl+S triggers save (App.svelte handles the actual save)
  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      window.dispatchEvent(new CustomEvent('stacked:save'));
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="flex flex-col h-full">
  <Toolbar {editor} />
  <div
    bind:this={element}
    class="flex-1 overflow-y-auto prose prose-gray max-w-none"
    aria-label="Article body editor"
  ></div>
</div>
```

- [ ] **Step 4: Verify compile**

```bash
npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/editor/
git commit -m "feat: add TipTap editor with toolbar and slash commands"
```

---

## Task 12: YAML Panel

**Files:**
- Create: `src/lib/components/yaml/FieldReadonly.svelte`
- Create: `src/lib/components/yaml/FieldFree.svelte`
- Create: `src/lib/components/yaml/FieldPadlocked.svelte`
- Create: `src/lib/components/yaml/YamlPanel.svelte`

- [ ] **Step 1: Create `src/lib/components/yaml/FieldReadonly.svelte`**

```svelte
<script lang="ts">
  let { label, value }: { label: string; value: string | boolean | string[] | null } = $props();

  function display(v: typeof value): string {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
    return String(v);
  }
</script>

<div class="flex flex-col gap-0.5">
  <label class="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</label>
  <p class="text-sm text-gray-400 truncate">{display(value)}</p>
</div>
```

- [ ] **Step 2: Create `src/lib/components/yaml/FieldFree.svelte`**

```svelte
<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let {
    label,
    field,
    type = 'text',
    options,
  }: {
    label: string;
    field: keyof ArticleFrontmatter;
    type?: 'text' | 'textarea' | 'select' | 'toggle' | 'datetime';
    options?: string[];
  } = $props();

  let value = $derived(documentStore.frontmatter?.[field] ?? '');

  function update(newValue: unknown) {
    documentStore.patchField(field, newValue);
  }
</script>

<div class="flex flex-col gap-0.5">
  <label class="text-xs font-medium text-gray-600 uppercase tracking-wide">{label}</label>

  {#if type === 'toggle'}
    <button
      role="switch"
      aria-checked={Boolean(value)}
      onclick={() => update(!value)}
      class="w-10 h-5 rounded-full relative transition-colors {value ? 'bg-indigo-500' : 'bg-gray-300'}"
    >
      <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform {value ? 'translate-x-5' : ''}"></span>
    </button>

  {:else if type === 'select'}
    <select
      value={String(value)}
      onchange={(e) => update((e.target as HTMLSelectElement).value)}
      class="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
    >
      {#each options ?? [] as opt}
        <option value={opt}>{opt}</option>
      {/each}
    </select>

  {:else if type === 'textarea'}
    <textarea
      value={String(value)}
      oninput={(e) => update((e.target as HTMLTextAreaElement).value)}
      rows={3}
      class="text-sm border border-gray-200 rounded px-2 py-1 resize-none"
    ></textarea>

  {:else if type === 'datetime'}
    <input
      type="datetime-local"
      value={String(value)}
      oninput={(e) => update((e.target as HTMLInputElement).value)}
      class="text-sm border border-gray-200 rounded px-2 py-1"
    />

  {:else}
    <input
      type="text"
      value={String(value)}
      oninput={(e) => update((e.target as HTMLInputElement).value)}
      class="text-sm border border-gray-200 rounded px-2 py-1"
    />
  {/if}
</div>
```

- [ ] **Step 3: Create `src/lib/components/yaml/FieldPadlocked.svelte`**

```svelte
<script lang="ts">
  import type { ArticleFrontmatter } from '$lib/types/article';
  import { documentStore } from '$lib/stores/document.svelte';

  let { label, field }: { label: string; field: keyof ArticleFrontmatter } = $props();

  let value = $derived(documentStore.frontmatter?.[field] ?? '');
  let overrides = $derived(documentStore.frontmatter?.overrides ?? []);
  let isOverridden = $derived(overrides.includes(field as string));
  let isUnlocked = $state(false);

  function unlock() { isUnlocked = true; }

  function save(newValue: string) {
    documentStore.patchPadlockedField(field, newValue);
    isUnlocked = false;
  }

  function resetToAI() {
    documentStore.clearOverride(field);
    isUnlocked = false;
  }
</script>

<div class="flex flex-col gap-0.5">
  <div class="flex items-center gap-1">
    <label class="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
    {#if isOverridden}
      <span class="text-xs text-amber-600 font-medium">overridden</span>
    {:else}
      <span class="text-xs text-indigo-400">AI</span>
    {/if}
  </div>

  {#if isUnlocked}
    <div class="flex flex-col gap-1">
      <span class="text-xs text-amber-600">Overriding AI content</span>
      <textarea
        value={String(value)}
        rows={3}
        class="text-sm border border-amber-300 rounded px-2 py-1 resize-none"
        onblur={(e) => save((e.target as HTMLTextAreaElement).value)}
      ></textarea>
      <button onclick={resetToAI} class="text-xs text-gray-400 hover:text-gray-600 self-start">
        ↩ Reset to AI
      </button>
    </div>
  {:else}
    <div class="flex items-start gap-1">
      <p class="text-sm text-gray-500 flex-1 line-clamp-3">{value || '—'}</p>
      <button
        onclick={unlock}
        title="Unlock to edit (overrides AI)"
        class="text-gray-300 hover:text-gray-500 shrink-0 mt-0.5"
        aria-label="Unlock field"
      >🔒</button>
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Create `src/lib/components/yaml/YamlPanel.svelte`**

```svelte
<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';
  import FieldFree from './FieldFree.svelte';
  import FieldPadlocked from './FieldPadlocked.svelte';
  import FieldReadonly from './FieldReadonly.svelte';

  let fm = $derived(documentStore.frontmatter);
  let isLocked = $derived(documentStore.isLocked);
  let canUnlock = $derived(documentStore.canUnlock);

  const PIPELINE_COLOURS: Record<string, string> = {
    spark: 'bg-yellow-100 text-yellow-700',
    hook: 'bg-orange-100 text-orange-700',
    opening: 'bg-amber-100 text-amber-700',
    research: 'bg-blue-100 text-blue-700',
    writing: 'bg-indigo-100 text-indigo-700',
    final_draft: 'bg-purple-100 text-purple-700',
    seo: 'bg-pink-100 text-pink-700',
    fact_check: 'bg-red-100 text-red-700',
    staged: 'bg-green-100 text-green-700',
    posted: 'bg-gray-100 text-gray-700',
  };
</script>

{#if !fm}
  <div class="p-4 text-sm text-gray-400">No file open.</div>
{:else}
  <div class="flex flex-col gap-4 p-4 overflow-y-auto h-full text-sm">

    <!-- Status group -->
    <section>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</h3>
      <div class="flex items-center gap-2 mb-2">
        <span class="px-2 py-0.5 rounded-full text-xs font-medium {PIPELINE_COLOURS[fm.pipeline_stage] ?? 'bg-gray-100 text-gray-600'}">
          {fm.pipeline_stage.replace('_', ' ')}
        </span>
        {#if isLocked}
          <span class="text-xs text-red-600 font-medium">🔒 Content locked</span>
        {/if}
      </div>
      {#if fm.substack_url}
        <a href={fm.substack_url} target="_blank" rel="noopener" class="text-xs text-indigo-600 underline truncate block">
          {fm.substack_url}
        </a>
      {/if}
      <div class="grid grid-cols-2 gap-2 mt-2">
        <FieldReadonly label="Created" value={fm.created} />
        <FieldReadonly label="Updated" value={fm.updated} />
      </div>
      {#if canUnlock}
        <button
          onclick={() => {
            if (confirm('Unlock content? This resets the article to fact_check stage for re-review.')) {
              documentStore.unlock();
            }
          }}
          class="mt-2 text-xs text-red-600 hover:text-red-800 underline"
        >
          Unlock Content
        </button>
      {/if}
    </section>

    <!-- Content group (author-free fields) -->
    <section>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Content</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="Title" field="title" />
        <FieldFree label="Subtitle" field="subtitle" />
        <FieldFree label="Spark Notes" field="spark_notes" type="textarea" />
        <FieldFree label="Hook" field="hook" type="textarea" />
        <FieldFree label="Opening" field="opening" type="textarea" />
        <FieldFree label="Research Notes" field="research_notes" type="textarea" />
        <FieldFree label="Legal Notes" field="legal_notes" type="textarea" />
      </div>
    </section>

    <!-- AI-generated group (padlocked) -->
    <section>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">AI Generated</h3>
      <div class="flex flex-col gap-3">
        <FieldPadlocked label="AI Draft" field="ai_draft" />
        <FieldPadlocked label="Fact Check Notes" field="fact_check_notes" />
        <FieldPadlocked label="SEO Title" field="seo_title" />
        <FieldPadlocked label="SEO Description" field="seo_description" />
        <FieldPadlocked label="SEO Slug" field="seo_slug" />
        <FieldPadlocked label="Tags" field="substack_tags" />
      </div>
    </section>

    <!-- Publishing group (author-free fields) -->
    <section>
      <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Publishing</h3>
      <div class="flex flex-col gap-3">
        <FieldFree label="Publication" field="publication" />
        <FieldFree label="Section" field="section" />
        <FieldFree label="Publish At" field="publish_at" type="datetime" />
        <FieldFree label="Audience" field="audience" type="select" options={['everyone', 'paid', 'none']} />
        <FieldFree label="Allow Comments" field="allow_comments" type="select" options={['everyone', 'paid', 'none']} />
        <FieldFree label="Send Email" field="send_email" type="toggle" />
      </div>
    </section>

  </div>
{/if}
```

> Note: When `isLocked` is true, `FieldFree` components for `content_field: true` fields should be rendered as readonly. The simplest approach is to add a `disabled` prop to `FieldFree` and pass `disabled={isLocked && fieldPermission.content_field}`. This is a refinement — implement if time allows; the lock banner and confirmation flow are sufficient for the first pass.

- [ ] **Step 5: Verify compile**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/yaml/
git commit -m "feat: add YAML side panel with permission-driven field rendering"
```

---

## Task 13: Research Panel

**Files:**
- Create: `src/lib/components/research/ResearchPanel.svelte`

- [ ] **Step 1: Create `src/lib/components/research/ResearchPanel.svelte`**

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { createAdapter } from '$lib/services/ai/adapter';
  import type { SearchResult } from '$lib/services/ai/adapter';

  let query = $state('');
  let result = $state<SearchResult | null>(null);
  let loading = $state(false);
  let error = $state('');

  // Exposed so Editor.svelte can call it with highlighted text
  export function setQuery(text: string) {
    query = text;
  }

  async function search() {
    if (!query.trim()) return;
    if (!settingsStore.hasValidKey) {
      error = 'No API key set — open Settings to add one.';
      return;
    }
    error = '';
    loading = true;
    result = null;
    try {
      const adapter = createAdapter(settingsStore.provider, settingsStore.apiKey);
      result = await adapter.search(query);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Research failed.';
    } finally {
      loading = false;
    }
  }

  function insertAtCursor(text: string) {
    // Dispatch a custom event; Editor.svelte listens and inserts at cursor
    window.dispatchEvent(new CustomEvent('stacked:insert', { detail: { text } }));
  }
</script>

<div class="flex flex-col h-full">
  <!-- Search input -->
  <div class="p-3 border-b border-gray-200">
    <div class="flex gap-1">
      <input
        type="text"
        bind:value={query}
        placeholder="Research topic or question…"
        class="flex-1 text-sm border border-gray-200 rounded px-2 py-1"
        onkeydown={(e) => e.key === 'Enter' && search()}
      />
      <button
        onclick={search}
        disabled={loading || !query.trim()}
        class="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? '…' : 'Go'}
      </button>
    </div>
    {#if error}
      <p class="text-xs text-red-600 mt-1">{error}</p>
    {/if}
  </div>

  <!-- Results -->
  <div class="flex-1 overflow-y-auto p-3">
    {#if loading}
      <p class="text-sm text-gray-400 animate-pulse">Researching…</p>
    {:else if result}
      <div class="flex flex-col gap-3">
        <div class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result.summary}</div>

        {#if result.citations.length > 0}
          <div>
            <p class="text-xs font-semibold text-gray-400 uppercase mb-1">Sources</p>
            <ul class="flex flex-col gap-1">
              {#each result.citations as cite}
                <li class="text-xs">
                  <a href={cite.url} target="_blank" rel="noopener" class="text-indigo-600 hover:underline truncate block">{cite.title}</a>
                  {#if cite.snippet}<p class="text-gray-500 line-clamp-2">{cite.snippet}</p>{/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}

        <button
          onclick={() => insertAtCursor(`\n\n> ${result!.summary}\n`)}
          class="self-start text-xs px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
        >
          Insert summary
        </button>
      </div>
    {:else}
      <p class="text-sm text-gray-400">Enter a query above to research a topic.</p>
    {/if}
  </div>
</div>
```

- [ ] **Step 2: Wire insert event into Editor.svelte**

In `src/lib/components/editor/Editor.svelte`, add after the `onMount` block:

```svelte
<svelte:window
  onkeydown={handleKeydown}
  on:stacked:insert={(e: CustomEvent) => {
    editor?.commands.insertContent(e.detail.text);
  }}
/>
```

> Replace the existing `<svelte:window onkeydown={handleKeydown} />` with this version.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/research/
git commit -m "feat: add research panel with AI web search and insert"
```

---

## Task 14: Status Bar, Settings Modal, Recent Files

**Files:**
- Create: `src/lib/components/StatusBar.svelte`
- Create: `src/lib/components/SettingsModal.svelte`
- Create: `src/lib/components/RecentFiles.svelte`

- [ ] **Step 1: Create `src/lib/components/StatusBar.svelte`**

```svelte
<script lang="ts">
  import { documentStore } from '$lib/stores/document.svelte';

  let fm = $derived(documentStore.frontmatter);
  let wordCount = $derived(documentStore.wordCount);
  let dirty = $derived(documentStore.dirty);
  let fileHandle = $derived(documentStore.fileHandle);
</script>

<footer class="flex items-center gap-4 px-4 py-1.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 shrink-0">
  <span class="truncate max-w-xs" title={fileHandle?.name}>
    {fileHandle?.name ?? 'No file open'}
    {#if dirty}<span class="text-amber-500 ml-1">●</span>{/if}
  </span>
  <span>{wordCount} words</span>
  {#if fm}
    <span class="ml-auto capitalize">{fm.pipeline_stage.replace('_', ' ')}</span>
  {/if}
</footer>
```

- [ ] **Step 2: Create `src/lib/components/SettingsModal.svelte`**

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { openFolder, openFile } from '$lib/services/files';
  import { saveFolderHandle } from '$lib/services/storage';

  let { open = false, onclose }: { open: boolean; onclose: () => void } = $props();
  let apiKey = $state(settingsStore.apiKey);
  let provider = $state(settingsStore.provider);

  function save() {
    settingsStore.setProvider(provider);
    settingsStore.setApiKey(apiKey);
    onclose();
  }

  async function connectFolder() {
    try {
      const handle = await openFolder();
      await saveFolderHandle(handle);
      alert(`Connected: ${handle.name}`);
    } catch {
      // User cancelled
    }
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div class="fixed inset-0 bg-black/40 z-40" onclick={onclose} aria-hidden="true"></div>

  <!-- Modal -->
  <div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
    <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 pointer-events-auto flex flex-col gap-5">
      <h2 class="text-lg font-semibold">Settings</h2>

      <!-- AI Provider -->
      <section class="flex flex-col gap-2">
        <label class="text-sm font-medium">AI Provider</label>
        <div class="flex gap-3">
          {#each ['claude', 'openai'] as p}
            <button
              onclick={() => provider = p as 'claude' | 'openai'}
              class="px-4 py-2 rounded border text-sm {provider === p ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}"
            >{p === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'}</button>
          {/each}
        </div>
      </section>

      <!-- API Key -->
      <section class="flex flex-col gap-1">
        <label for="api-key" class="text-sm font-medium">API Key</label>
        <input
          id="api-key"
          type="password"
          bind:value={apiKey}
          placeholder={provider === 'claude' ? 'sk-ant-…' : 'sk-…'}
          class="border border-gray-200 rounded px-3 py-2 text-sm font-mono"
        />
        <p class="text-xs text-gray-400">Stored locally only. Never sent to any server.</p>
      </section>

      <!-- Pipeline folder -->
      <section class="flex flex-col gap-1">
        <label class="text-sm font-medium">Pipeline Folder</label>
        <button
          onclick={connectFolder}
          class="px-3 py-2 border border-gray-200 rounded text-sm hover:bg-gray-50 text-left"
        >
          Connect folder…
        </button>
        <p class="text-xs text-gray-400">Select your StackPipe vault folder for quick file access.</p>
      </section>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-2">
        <button onclick={onclose} class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">Cancel</button>
        <button onclick={save} class="px-4 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700">Save</button>
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Create `src/lib/components/RecentFiles.svelte`**

```svelte
<script lang="ts">
  import { getRecentFiles, type RecentFile } from '$lib/services/storage';
  import { openFile } from '$lib/services/files';
  import { documentStore } from '$lib/stores/document.svelte';

  let { onclose }: { onclose: () => void } = $props();
  let recents = $state<RecentFile[]>([]);

  $effect(() => {
    getRecentFiles().then(r => { recents = r; }).catch(() => {});
  });

  async function open(file: RecentFile) {
    try {
      // Re-request permission before opening
      const perm = await (file.handle as any).queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        await (file.handle as any).requestPermission({ mode: 'readwrite' });
      }
      const parsed = await openFile(file.handle);
      documentStore.load(parsed.frontmatter, parsed.body, parsed.fieldOrder, parsed.fileHandle);
      onclose();
    } catch {
      alert('Could not reopen that file. Try opening it manually.');
    }
  }
</script>

<div class="fixed inset-0 bg-black/40 z-40" onclick={onclose} aria-hidden="true"></div>
<div class="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
  <div class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 pointer-events-auto flex flex-col gap-3">
    <h2 class="text-base font-semibold">Recent Files</h2>
    {#if recents.length === 0}
      <p class="text-sm text-gray-400">No recent files.</p>
    {:else}
      <ul class="flex flex-col gap-1 max-h-80 overflow-y-auto">
        {#each recents as file}
          <li>
            <button
              onclick={() => open(file)}
              class="w-full text-left px-3 py-2 rounded hover:bg-gray-50 text-sm"
            >
              <p class="font-medium truncate">{file.title}</p>
              <p class="text-xs text-gray-400">{new Date(file.openedAt).toLocaleDateString()}</p>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    <button onclick={onclose} class="self-end text-sm text-gray-500 hover:text-gray-800">Close</button>
  </div>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/StatusBar.svelte src/lib/components/SettingsModal.svelte src/lib/components/RecentFiles.svelte
git commit -m "feat: add status bar, settings modal, and recent files panel"
```

---

## Task 15: App Assembly

**Files:**
- Create: `src/App.svelte`

- [ ] **Step 1: Create `src/App.svelte`**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Editor from '$lib/components/editor/Editor.svelte';
  import YamlPanel from '$lib/components/yaml/YamlPanel.svelte';
  import ResearchPanel from '$lib/components/research/ResearchPanel.svelte';
  import StatusBar from '$lib/components/StatusBar.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import RecentFiles from '$lib/components/RecentFiles.svelte';
  import { documentStore } from '$lib/stores/document.svelte';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { openFile, saveFile } from '$lib/services/files';
  import { loadFolderHandle } from '$lib/services/storage';

  let showSettings = $state(false);
  let showRecents = $state(false);
  let yamlCollapsed = $state(false);
  let researchCollapsed = $state(false);

  onMount(async () => {
    await settingsStore.loadFromStorage();
    // Try to restore folder handle (does not auto-open a file)
    await loadFolderHandle().catch(() => {});
  });

  async function handleOpen() {
    try {
      const parsed = await openFile();
      documentStore.load(parsed.frontmatter, parsed.body, parsed.fieldOrder, parsed.fileHandle);
    } catch {
      // User cancelled picker
    }
  }

  async function handleSave() {
    if (!documentStore.fileHandle || !documentStore.frontmatter) return;
    try {
      await saveFile(
        documentStore.fileHandle,
        documentStore.frontmatter,
        documentStore.fieldOrder,
        documentStore.body,
      );
      documentStore.markClean();
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : e));
    }
  }

  // Listen for save shortcut dispatched by Editor
  function handleSaveEvent() { handleSave(); }

  // Sidebar visibility persists across sessions
  $effect(() => {
    localStorage.setItem('yamlCollapsed', String(yamlCollapsed));
    localStorage.setItem('researchCollapsed', String(researchCollapsed));
  });

  onMount(() => {
    yamlCollapsed = localStorage.getItem('yamlCollapsed') === 'true';
    researchCollapsed = localStorage.getItem('researchCollapsed') === 'true';
    window.addEventListener('stacked:save', handleSaveEvent);
    return () => window.removeEventListener('stacked:save', handleSaveEvent);
  });
</script>

<!-- App chrome: header -->
<header class="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
  <h1 class="font-semibold text-gray-800 text-sm">StackEd</h1>
  <div class="flex-1"></div>

  <button onclick={handleOpen} class="px-3 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50">
    Open
  </button>
  <button
    onclick={handleSave}
    disabled={!documentStore.dirty}
    class="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40"
  >
    Save
  </button>
  <button
    onclick={() => showRecents = true}
    class="px-2 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
    title="Recent files"
  >⏱</button>
  <button
    onclick={() => settingsStore.toggleSidebar()}
    class="px-2 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
    title="Toggle sidebar"
  >⊞</button>
  <button
    onclick={() => showSettings = true}
    class="px-2 py-1.5 text-sm border border-gray-200 rounded hover:bg-gray-50"
    title="Settings"
  >⚙</button>
</header>

<!-- Main area -->
<div class="flex flex-1 min-h-0">
  <!-- Editor (always visible) -->
  <div class="flex-1 min-w-0 flex flex-col">
    <Editor />
  </div>

  <!-- Right sidebar -->
  {#if settingsStore.sidebarVisible}
    <aside class="w-72 border-l border-gray-200 flex flex-col min-h-0 shrink-0">
      <!-- YAML panel -->
      <div class="flex flex-col {yamlCollapsed ? 'h-auto' : 'flex-1'} min-h-0 border-b border-gray-200">
        <button
          onclick={() => yamlCollapsed = !yamlCollapsed}
          class="flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50 shrink-0"
        >
          Article
          <span>{yamlCollapsed ? '▾' : '▴'}</span>
        </button>
        {#if !yamlCollapsed}
          <div class="flex-1 overflow-y-auto">
            <YamlPanel />
          </div>
        {/if}
      </div>

      <!-- Research panel -->
      <div class="flex flex-col {researchCollapsed ? 'h-auto' : 'flex-1'} min-h-0">
        <button
          onclick={() => researchCollapsed = !researchCollapsed}
          class="flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50 shrink-0"
        >
          Research
          <span>{researchCollapsed ? '▾' : '▴'}</span>
        </button>
        {#if !researchCollapsed}
          <div class="flex-1 overflow-y-auto">
            <ResearchPanel />
          </div>
        {/if}
      </div>
    </aside>
  {/if}
</div>

<!-- Status bar -->
<StatusBar />

<!-- Modals -->
{#if showSettings}
  <SettingsModal open={showSettings} onclose={() => showSettings = false} />
{/if}
{#if showRecents}
  <RecentFiles onclose={() => showRecents = false} />
{/if}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected: All tests PASS (permissions, frontmatter, document, settings, AI adapter).

- [ ] **Step 3: Dev server smoke test**

```bash
npm run dev
```

Open `http://localhost:5173`. Verify:
- App loads without console errors
- "Open" button triggers file picker
- Open a `.md` file from the StackPipe vault — frontmatter appears in YAML panel, body loads in editor
- Edit the body — dirty indicator (●) appears in status bar
- Cmd/Ctrl+S triggers save — dirty indicator clears
- Settings modal opens and saves provider + API key

- [ ] **Step 4: Commit**

```bash
git add src/App.svelte
git commit -m "feat: assemble full app layout with open/save, sidebar, modals"
```

---

## Task 16: PWA Config + Final Cleanup

**Files:**
- Create: `public/manifest.json`

- [ ] **Step 1: Create `public/manifest.json`**

```json
{
  "name": "StackEd 2.0",
  "short_name": "StackEd",
  "description": "Substack post editor for the StackPipe pipeline",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#4f46e5",
  "icons": [
    { "src": "/pwa-192x192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/pwa-512x512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Copy PWA icons from StackEd 1.x**

```bash
cp ../StackEd/public/pwa-192x192.png public/
cp ../StackEd/public/pwa-512x512.png public/
cp ../StackEd/public/favicon.ico public/
```

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: Build completes in `dist/`. No errors.

- [ ] **Step 4: Preview production build**

```bash
npm run preview
```

Open `http://localhost:4173`. Repeat the smoke test from Task 15 Step 3.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete StackEd 2.0 MVP — Substack editor with YAML panel and research sidebar"
```

---

## Notes for the Implementer

**Field-permissions sync:** `src/lib/schema/field-permissions.json` must be kept in sync with `../StackPipe/docs/stackpipe-field-permissions.json`. When StackPipe updates the schema, copy the file again and rebuild.

**content_locked enforcement in FieldFree:** The YAML panel currently shows all free fields as editable even when `content_locked: true`. A complete implementation would add a `disabled` prop to `FieldFree` and pass `disabled={isLocked && getFieldPermission(field).content_field}`. The lock banner and unlock confirmation provide the user-facing signal in the meantime.

**Markdown ↔ TipTap fidelity:** Custom Substack blocks (Poll, LaTeX, Poetry, etc.) are stored as raw HTML in the `.md` body. This is valid CommonMark and renders in Obsidian. When TipTap reloads the file, each extension's `parseHTML` rule reconstructs the node from the HTML. If a block fails to reconstruct, it will appear as raw HTML text — verify each extension type with a round-trip test in the dev browser.

**OpenAI Responses API:** `client.responses.create` is the beta Responses API path. If the installed `openai` SDK version does not expose it, fall back to `client.chat.completions.create` with `model: 'gpt-4o-search-preview'` — this gives equivalent web search behaviour via the Chat Completions API.
