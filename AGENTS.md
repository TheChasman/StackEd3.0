# AGENTS.md

Agent-specific guidelines and reference for StackEd 2.0 development.

## Project Overview

**StackEd 2.0** is a desktop application for managing and editing Markdown/YAML documents with LLM integration. Built with:
- **Frontend**: Svelte 5 + TailwindCSS + TypeScript
- **Backend**: Rust (Tauri 2) for native system integration
- **Editors**: TipTap 3 for rich text, native YAML editing
- **LLM Integration**: Anthropic Claude and OpenAI APIs
- **Data**: IndexedDB (browser storage), file I/O via Tauri

## Repository Structure

```
StackEd2.0/
├── src/                    # Svelte frontend
│   ├── App.svelte         # Root component
│   ├── lib/
│   │   ├── components/    # Reusable UI components
│   │   ├── services/      # API and file operations
│   │   ├── stores/        # Svelte rune stores (state)
│   │   ├── themes/        # Theme definitions (Catppuccin)
│   │   └── utils/         # Helpers (zoom, markdown, etc.)
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs         # Command definitions
│   │   ├── file_io.rs     # File operations
│   │   └── zoom.rs        # [DELETED] zoom functionality
│   └── tauri.conf.json    # Tauri configuration
├── public/                # Static assets
├── dist/                  # Build output
├── CLAUDE.md              # LLM coding guidelines
├── package.json           # Frontend dependencies
└── vite.config.ts         # Vite build config
```

## Key Modules

### Frontend (Svelte)

**Stores** (src/lib/stores/):
- `theme.svelte.ts`: Theme switching (Catppuccin flavors)
- `settings.svelte.ts`: User preferences
- Other state management via Svelte 5 runes

**Components** (src/lib/components/):
- `ThemeSwitcher.svelte`: Theme toggle UI
- `ThemeEditor.svelte`: Edit theme colors
- `ThemeBrowser.svelte`: Browse available themes
- `yaml/YamlPanel.svelte`: YAML editor
- `yaml/FieldFree.svelte`: Generic YAML field component
- TipTap-based rich text editor

**Services** (src/lib/services/):
- `files.ts`: File I/O via Tauri commands
- LLM API clients (Claude, OpenAI)

**Utils** (src/lib/utils/):
- `zoom.ts`: UI zoom handling

**Themes** (src/lib/themes/):
- `catppuccin.ts`: Catppuccin color palette

### Backend (Rust)

**Commands** (src-tauri/src/):
- `lib.rs`: Tauri command invocations (file operations, CLI args)
- `file_io.rs`: Read/write files, manage document state
- `zoom.rs`: [DELETED] zoom window handling

**Configuration**:
- `tauri.conf.json`: Window setup, menu, permissions
- `capabilities/default.json`: Security permissions

## Development Workflow

### Starting the Dev Environment

```bash
# Terminal 1: Frontend dev server
npm run dev

# Terminal 2: Tauri desktop app
npm run dev:app

# Or combined (single terminal):
npm run tauri:dev
```

### Building for Release

```bash
npm run build          # Vite bundle frontend
npm run tauri:build    # Build native app
```

### Verification

- **Type Check**: `npm run check` (svelte-check)
- **Tests**: `npm run test` (vitest)
- **Watch Tests**: `npm run test:watch`

## Common Agent Tasks

### Adding a New Svelte Component

1. Create in `src/lib/components/`
2. Use Svelte 5 runes for state: `let count = $state(0)`
3. Run `npm run check` to verify types
4. Import and use in parent component

### Modifying Theme System

1. Update `src/lib/themes/catppuccin.ts` for color definitions
2. Modify `src/lib/stores/theme.svelte.ts` for theme logic
3. Update `ThemeEditor.svelte` and `ThemeSwitcher.svelte` if UI changes needed
4. Run checks: `npm run check`

### Adding Tauri Commands

1. Define in `src-tauri/src/lib.rs` using `#[tauri::command]`
2. Rebuild: backend recompiles on changes in `dev:app`
3. Call from frontend using `@tauri-apps/api` invoke

### Working with Files

- **Frontend**: Use `src/lib/services/files.ts` to invoke Tauri commands
- **Backend**: Use `src-tauri/src/file_io.rs` for file operations
- **Data Persistence**: IndexedDB for browser storage, file system for saved documents

## Important Patterns

### Svelte 5 State Management

```svelte
<script>
  let count = $state(0);           // Reactive state
  let derived = $derived(count * 2); // Computed value
</script>
```

### Tauri File Operations

- Commands run in the Tauri backend
- Use `@tauri-apps/api/core` to invoke from frontend
- File I/O is sandboxed by Tauri security

### Styling

- **Tailwind CSS** for utilities
- **CSS-in-JS** via component `<style>` blocks
- **Theme colors** injected via CSS custom properties

## Before Committing

1. **Type Safety**: `npm run check`
2. **Tests**: `npm run test`
3. **Manual Testing**: Verify in `npm run tauri:dev`
4. **Git Check**: `git status` and `git diff` before staging
5. **No Secrets**: Verify no API keys, tokens, or credentials in diffs

## Testing Strategy

- **Unit Tests**: Vitest (src/*.test.ts, src/lib/**/*.test.ts)
- **Integration**: Test Tauri commands with real file I/O
- **Manual**: Test in dev app with multiple themes and document types

## Debugging

**Frontend**:
- Browser DevTools (right-click → Inspect in dev app)
- Console logs visible in browser

**Backend**:
- Rust logs via `println!` or `dbg!`
- Tauri logs in console

**File Issues**:
- Check `src-tauri/tauri.conf.json` for file scope permissions
- Verify `capabilities/default.json` has required permissions

## Dependency Management

- **Frontend**: npm (package.json)
- **Backend**: Cargo (Cargo.toml in src-tauri/)
- **Before adding**: Check if already installed (npm list, cargo tree)
- **Update carefully**: Test after dependency updates

## Known Issues & Workarounds

- **Zoom functionality**: Previously in `src-tauri/src/zoom.rs` (deleted) — now handled in `src/lib/utils/zoom.ts`
- **TipTap v3**: Using latest API, ensure extensions match version
- **SVG imports**: May need special handling in Vite

## Useful References

- **Tauri Docs**: https://tauri.app/
- **Svelte 5**: https://svelte.dev/
- **TipTap 3**: https://tiptap.dev/
- **Catppuccin**: https://catppuccin.com/

## Git Workflow

- **Default branch**: `main`
- **Changes tracked**: Use `git status` and `git diff` before commits
- **Message style**: Follow Conventional Commits (feat:, fix:, refactor:, etc.)
- **No force pushes** unless coordinating with team
