# StackEd 2.0

A desktop application for managing, editing, and publishing Markdown/YAML documents to Substack, with built-in LLM assistance.

- **Frontend:** Svelte 5 + TypeScript + TailwindCSS
- **Backend:** Rust (Tauri 2) for native system integration
- **Editors:** TipTap 3 (rich text) and native YAML editing
- **LLM integration:** Anthropic Claude and OpenAI
- **Storage:** IndexedDB (browser storage) + file I/O via Tauri

## Prerequisites

- **Node.js** 20+ and npm
- **Rust** (stable toolchain) and Cargo — see https://rustup.rs
- Platform toolchain for Tauri 2 (Xcode Command Line Tools on macOS). See the
  [Tauri prerequisites](https://tauri.app/start/prerequisites/).

## Quick start

```bash
git clone git@github.com:TheChasman/StackEd2.0.git
cd StackEd2.0
npm install          # install frontend dependencies (also wires git hooks)
npm run tauri:dev    # launch the desktop app in development
```

To run only the frontend in a browser (no native shell):

```bash
npm run dev          # Vite dev server at http://localhost:5173
```

## Common commands

| Command | What it does |
| --- | --- |
| `npm run tauri:dev` | Run the full desktop app (Vite + Tauri) in dev mode |
| `npm run dev` | Run the frontend only (Vite dev server) |
| `npm run build` | Build the frontend bundle |
| `npm run tauri:build` | Build and install the native macOS app |
| `npm run check` | Type-check Svelte + TypeScript (`svelte-check`) |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format the codebase with Prettier |
| `npm run format:check` | Verify formatting without writing |
| `npm run test` | Run the unit test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |

## Environment variables & secrets

StackEd requires **no `.env` file** to run. There are no user-configurable
runtime environment variables; the only environment value read by the app is
Vite's built-in `import.meta.env.DEV` flag, which Vite sets automatically.

**Secrets (Anthropic / OpenAI API keys) are never stored on disk or in `.env`
files.** They are resolved at call time from [SpockLock](./SPOCKLOCK.md), a
1Password-backed secrets manager that keeps resolved values in process memory
only. See [`SPOCKLOCK.md`](./SPOCKLOCK.md) for how to provision and manage them.
Do not add API keys to this repository in any form.

## Project structure

```
src/            Svelte frontend (components, stores, services, themes, utils)
src-tauri/      Rust backend (Tauri commands, file I/O, capabilities)
docs/           Design specs and plans
scripts/        Build/deploy/versioning helper scripts
public/         Static assets
```

## Development notes

- **State:** Svelte 5 runes (`$state`, `$derived`, `$effect`).
- **Tauri commands:** defined in `src-tauri/src/lib.rs`, invoked from the
  frontend via `@tauri-apps/api/core`.
- **Git hooks:** `npm install` runs Husky, which registers a pre-commit hook
  that runs `lint-staged` (ESLint + Prettier on staged files) and then chains
  to the machine-global SpockLock doctrine hook if present.
- See [`AGENTS.md`](./AGENTS.md) for the full contributor/agent guide and
  [`CLAUDE.md`](./CLAUDE.md) for coding guidelines.

## Verification before committing

```bash
npm run check && npm run lint && npm run format:check && npm run test
```

These same checks run in CI on every pull request and push to `main`.
