<coding_guidelines>
# AGENTS.md

Agent-specific guidelines and reference for StackEd 3.0 development.

## Project Overview

**StackEd 3.0** is an offline-first writing studio for Substack. The manuscript
is the product; publishing is a deliberate final step, not permanent chrome.

- **Frontend**: Svelte 5 (runes) + TailwindCSS 4 + TypeScript
- **Backend**: Rust (Tauri 2)
- **Editor**: TipTap 3, ProseMirror JSON as the canonical body format
- **AI**: OpenRouter, keys resolved in Rust via SpockLock (never in the WebView)
- **Data**: `.stacked.json` files on disk; IndexedDB for recents + library index

Read [`docs/superpowers/specs/2026-09-19-stacked3-design.md`](./docs/superpowers/specs/2026-09-19-stacked3-design.md)
before changing structure. Read [`docs/CHERRIES.md`](./docs/CHERRIES.md) before
re-adding anything that looks missing — it was probably removed on purpose, and
the restore command is there.

## The three spaces

Navigation is an explicit state machine in `src/lib/stores/view.svelte.ts`, not
a router. Exactly one space renders at a time.

| Space | Component | Owns |
|---|---|---|
| Library | `lib/components/library/LibraryView.svelte` | Draft list, search, calendar, states |
| Write | `lib/components/write/WriteView.svelte` | Title, subtitle, body, tools drawer |
| Plan | `lib/components/plan/PlanView.svelte` | Workshop fields, target date |
| Finish | `lib/components/finish/FinishView.svelte` | SEO, destination, delivery, timing, publish |

**Do not add a permanent sidebar.** Research/Artwork/Generate belong in the
Write tools drawer, on request. That arrangement is the whole point of 3.0.

## Repository Structure

```
StackEd3.0/
├── src/
│   ├── App.svelte              # Shell: space switching, file lifecycle, autosave
│   ├── lib/
│   │   ├── components/
│   │   │   ├── library/        # Library space
│   │   │   ├── write/          # Write space + tools drawer
│   │   │   ├── plan/           # Plan space
│   │   │   ├── finish/         # Finish space
│   │   │   ├── editor/         # TipTap editor, toolbar, Substack extensions
│   │   │   ├── research/       # Research tool (drawer)
│   │   │   ├── artwork/        # Artwork tool (drawer)
│   │   │   └── image-generation/ # Generate tool (drawer)
│   │   ├── services/           # files, substack/*, seo, artwork, ai, storage
│   │   ├── stores/             # document, view, settings, theme, substackConnections
│   │   ├── themes/             # catppuccin.ts + catppuccin.css
│   │   └── utils/              # scaffold, frontmatter, zoom, pmText, documentState
├── src-tauri/                  # Rust backend
│   ├── src/
│   │   ├── lib.rs              # Tauri commands + native menu
│   │   ├── file_io.rs          # File + artwork I/O
│   │   ├── ai.rs               # SEO + research calls
│   │   ├── image_generation.rs # OpenRouter image generation
│   │   └── spocklock.rs        # Secret resolution
│   └── tauri.conf.json
├── docs/CHERRIES.md            # Everything removed from 2.0, with restore commands
└── docs/superpowers/           # Specs and plans
```

## Key Modules

**Stores** (`src/lib/stores/`)
- `view.svelte.ts` — which space is on screen; `openDocument()` / `goLibrary()`
- `document.svelte.ts` — tabs, active scaffold, `editTick` (drives autosave)
- `settings.svelte.ts` — tools-drawer visibility, library view mode
- `theme.svelte.ts` — Catppuccin flavour, chosen in Settings only
- `substackConnections.svelte.ts` — saved publication subdomains

**Services** (`src/lib/services/`)
- `files.ts` — open/save/new, Markdown mirror, library-index upkeep
- `library.ts` — IndexedDB library index read/write/prune
- `substack/` — `transport.ts`, `webviewTransport.ts`, `payloadBuilder.ts`, `publisher.ts`
- `seo.ts` — SEO prompt, parse, apply, tag canonicalisation
- `storage.ts` — IndexedDB (settings, recents, library)

**Utils** (`src/lib/utils/`)
- `scaffold.ts` — readiness, (de)serialisation, Markdown mirror
- `documentState.ts` — derives `draft | ready | scheduled | published`

## Development Workflow

```bash
npm run dev          # frontend only (Vite, http://localhost:5173)
npm run tauri:dev    # full desktop app
npm run tauri:build  # build + install StackEd3.app
```

### Verification

```bash
npm run format:check && npm run lint && npm run check && npm run test
```

Run all four before claiming work is done. CI runs the same on every PR and on
pushes to `main`.

## Common Agent Tasks

### Adding a Svelte component

1. Put it in the folder for its space (`library/`, `write/`, `plan/`, `finish/`).
2. Use runes: `let x = $state(0)`, `$derived`, `$effect`.
3. Run `npm run check`.

### Adding a Tauri command

1. Define in `src-tauri/src/lib.rs` with `#[tauri::command]`, register it in
   `invoke_handler!`.
2. Call it from the frontend with `invoke` from `@tauri-apps/api/core`.
3. Secrets stay in Rust — never return an API key to the WebView.

### Changing the document model

`.stacked.json` is the canonical format. New fields must load as `null`/default
from older files (see `deserializeScaffold` in `lib/utils/scaffold.ts`) so 2.0
documents keep opening.

## Important Patterns

- **Autosave**: `documentStore.editTick` increments on every mutation; a
  4-second debounce in `App.svelte` writes back to the existing path. Documents
  with no path are never autosaved.
- **Library index**: every successful save upserts a `LibraryEntry`. The index
  is a cache; missing files are pruned on read.
- **Cross-component events**: the editor listens for `stacked:insert` and
  `stacked:insert-image`. Prefer props and stores for anything new.
- **Styling**: Tailwind utilities; theme colours as CSS custom properties. The
  writing column width is `--stacked-measure`.

## Before Committing

1. `npm run check`
2. `npm run lint`
3. `npm run format:check`
4. `npm run test`
5. Manual check in `npm run tauri:dev`
6. `git status` and `git diff`
7. No secrets in the diff
8. If you removed a feature, add it to `docs/CHERRIES.md`

A Husky pre-commit hook runs `lint-staged` (ESLint + Prettier on staged files)
and then chains to the machine-global SpockLock doctrine hook.

## Testing Strategy

- **Unit**: Vitest (`src/**/*.test.ts`, `scripts/**/*.test.mjs`)
- **Manual**: the desktop app, across Library → Write → Plan → Finish

## Git Workflow

- Default branch `main`
- Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`)
- No force pushes

## Secrets Management

This project uses SpockLock. See [`SPOCKLOCK.md`](./SPOCKLOCK.md) for what to
touch and what not to touch.
</coding_guidelines>

## Canonical project context

Read the [design spec](./docs/superpowers/specs/2026-09-19-stacked3-design.md),
[removed-feature register](./docs/CHERRIES.md), and [project conventions](./AGENTS.md).
Entry points: [AGENTS.md](./AGENTS.md), [CLAUDE.md](./CLAUDE.md), [README.md](./README.md).

Link work: [approved link-health design](./docs/superpowers/specs/2026-10-30-link-health-design.md) and [implementation plan](./docs/superpowers/plans/2026-10-30-link-health.md).
