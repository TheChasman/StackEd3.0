# StackEd 3.0

An offline-first **writing studio** for Substack. You write in a calm, centred
canvas; publishing is a deliberate step at the end rather than a control panel
beside the manuscript.

StackEd 3.0 is a redesign of [StackEd 2.0](https://github.com/TheChasman/StackEd2.0).
It keeps the editor, research, artwork and Substack publishing that worked, and
removes the workflow chrome that had been promoted into permanent furniture.
Every removal is catalogued with a restore command in
[`docs/CHERRIES.md`](./docs/CHERRIES.md).

- **Frontend:** Svelte 5 (runes) + TypeScript + TailwindCSS 4
- **Backend:** Rust (Tauri 2)
- **Editor:** TipTap 3, ProseMirror JSON on the wire
- **AI:** OpenRouter via [SpockLock](./SPOCKLOCK.md) (keys never touch disk or the WebView)
- **Storage:** `.stacked.json` files on disk, IndexedDB for recents and the library index

## The three spaces

| Space | What it is for |
|---|---|
| **Library** | Every local draft: search, list, month calendar, state, target date |
| **Write** | The manuscript. Centred column, title and subtitle in the canvas, minimal toolbar |
| **Plan** | Spark, Hook, Landing, research notes, target date — never published |
| **Finish** | SEO, publication, audience, delivery, schedule, readiness, publish |

Research, Artwork and Generate live in an on-demand `Tools` drawer inside Write,
not a permanent sidebar.

See [`docs/superpowers/specs/2026-09-19-stacked3-design.md`](./docs/superpowers/specs/2026-09-19-stacked3-design.md)
for the full design.

## Prerequisites

- **Node.js** 20+ and npm
- **Rust** (stable) and Cargo — see https://rustup.rs
- Xcode Command Line Tools on macOS, or the
  [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your platform

## Quick start

```bash
git clone git@github.com:TheChasman/StackEd3.0.git
cd StackEd3.0
npm install          # installs dependencies and wires git hooks
npm run tauri:dev    # launch the desktop app
```

Frontend only, in a browser (no native file dialogs):

```bash
npm run dev          # Vite dev server at http://localhost:5173
```

## Common commands

| Command | What it does |
| --- | --- |
| `npm run tauri:dev` | Run the full desktop app (Vite + Tauri) in dev mode |
| `npm run dev` | Run the frontend only |
| `npm run build` | Build the frontend bundle |
| `npm run tauri:build` | Build and install `StackEd3.app` |
| `npm run check` | Type-check Svelte + TypeScript |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm run test` | Run the Vitest suite |

## Verification before committing

```bash
npm run format:check && npm run lint && npm run check && npm run test
```

The same checks run in CI on every pull request and push to `main`.

## Secrets

StackEd needs no `.env` file. Anthropic/OpenAI/OpenRouter keys are resolved at
call time from SpockLock and held in process memory only. See
[`SPOCKLOCK.md`](./SPOCKLOCK.md). Never add keys to this repository.

## Project layout

```
src/                     Svelte frontend
  lib/components/
    library/             Library space (list + calendar)
    write/               Write space (canvas, tools drawer)
    plan/                Plan space (workshop)
    finish/              Finish space (publish review)
    editor/              TipTap editor, toolbar, Substack extensions
  lib/services/          File I/O, Substack publishing, SEO, artwork, AI
  lib/stores/            Svelte rune stores (document, view, settings, theme)
src-tauri/               Rust backend (Tauri commands, file I/O)
docs/CHERRIES.md         Catalogue of everything removed from 2.0, with restore commands
docs/superpowers/        Specs and implementation plans
```

Also see [`AGENTS.md`](./AGENTS.md) for the contributor/agent guide and
[`CLAUDE.md`](./CLAUDE.md) for coding guidelines.

## Canonical project context

Read the [design spec](./docs/superpowers/specs/2026-09-19-stacked3-design.md),
[removed-feature register](./docs/CHERRIES.md), and [project conventions](./AGENTS.md).
Entry points: [AGENTS.md](./AGENTS.md), [CLAUDE.md](./CLAUDE.md), [README.md](./README.md).
