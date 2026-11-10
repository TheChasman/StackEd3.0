# StackEd 3 security fixes — design spec

**Date:** 2026-11-10 · **Status:** approved by Chas for implementation ("(B) Yes, but push straight to main")
**Baseline:** `main` at `9edaf58` · **Plan:** [`docs/superpowers/plans/2026-11-10-security-fixes.md`](../plans/2026-11-10-security-fixes.md)
**Source:** the 2026-11-10 read-only security audit and a re-check of the code at `9edaf58`.

> This repository is **public**. This spec deliberately describes defects and required behaviour
> without step-by-step exploit material.

## 1. Problem

StackEd 3 is a Tauri 2 desktop editor. Its webview can call Rust commands that read, write,
list and delete **any path** the user can access, and run script in the Substack sign-in
window. The app ships with **no Content Security Policy** (`tauri.conf.json` `"csp": null`).
One editor node view builds HTML from document attributes without escaping, so a crafted
article (Markdown or scaffold JSON) opened in StackEd can execute script in the main webview,
and from there reach every IPC command. The file commands make that equivalent to full access
to the user's files.

Separately, the SpockLock client speaks plain HTTP to `localhost:9090`, but the documented
SpockLock install runs the daemon with **mTLS required**, so AI features cannot resolve their
key. The fix must keep mTLS on and give StackEd its own client certificate.

## 2. Threat model

- **Attacker:** anyone who can get Chas to open a `.md` / `.stacked.json` article (shared draft,
  downloaded file, synced folder) or who controls content returned by a Substack page loaded in
  the sign-in window.
- **Assets:** files in the user's home directory (SSH keys, dotfiles, LaunchAgents), the
  Substack session in the sign-in window, the OpenRouter key resolved via SpockLock.
- **Out of scope:** a local attacker with code execution as the user.

## 3. Findings and required behaviour

### H1 — Unescaped HTML in editor node views, no CSP (high)
`src/lib/components/editor/extensions/Poll.ts:57-60` interpolates `node.attrs.duration` into
`innerHTML`. Attributes come from parsed article HTML/JSON (`scaffoldMigration.ts:86`
`marked.parse` → `generateJSON`, `scaffold.ts:63` `deserializeScaffold`). Required:

1. **No attribute-derived `innerHTML` anywhere in `src/`.** Poll's header is built with
   `createElement` + `textContent`. `Paywall.ts:79` (static SVG) and `Recipe.ts:112` (already
   `escapeHtml`) may keep `innerHTML` only for constant markup / escaped values; add an ESLint
   rule (`no-restricted-properties` on `innerHTML`/`outerHTML`/`insertAdjacentHTML`) with an
   inline `eslint-disable-next-line` + justification for each remaining constant use.
2. **Strict CSP** in `src-tauri/tauri.conf.json` `app.security.csp` (Tauri injects nonces/hashes
   for its own scripts):
   ```
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
   img-src 'self' data: blob: asset: http://asset.localhost https:;
   font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost;
   frame-src https://www.youtube.com https://www.youtube-nocookie.com;
   media-src 'self' blob: data:; object-src 'none'; base-uri 'none'; form-action 'none'
   ```
   plus `"devCsp"` identical except `connect-src` also allows `ws://localhost:5173 http://localhost:5173`.
   No `'unsafe-eval'`, no inline script.
3. **Sanitised import path.** HTML produced by `marked.parse` is passed through a sanitiser that
   removes every `on*` attribute, `<script>`, `<iframe>` (except YouTube embed nodes rebuilt by
   the extension), `<object>`, `<embed>`, `<style>`, and `javascript:`/`vbscript:`/`data:`
   (except `data:image/*`) URLs, before `generateJSON`. Implement it with the browser's
   `DOMParser` + a small allowlist walker in `src/lib/utils/sanitizeHtml.ts` (**no new
   dependency**). Scaffold JSON attributes are rendered with `textContent` by (1), so they need
   no separate sanitiser.

### M1 — File IPC commands accept any path (medium; makes H1 critical)
`src-tauri/src/file_io.rs:45-75,443-447` (`read_file`, `file_exists`, `write_file`,
`delete_file`, `list_files`, `create_dir_recursive`) and `read_image_data_url`,
`read_markdown_file`, `write_markdown_file`. Required: one Rust guard,
`file_scope::check(path, Access) -> Result<PathBuf, String>`, called first by every one of
these commands:

- the path is absolute and is canonicalised (for writes/creates: the nearest existing ancestor
  is canonicalised and the remainder appended), so `..` and symlinks cannot escape;
- it lies **under the user's home directory**;
- **no path component below home starts with `.`** and the path is not under
  `~/Library` (blocks `~/.ssh`, `~/.config`, `~/.zshrc`, LaunchAgents, Keychains);
- **reads** (`read_file`, `read_markdown_file`) allow extensions `.md`, `.json`, `.txt`;
  `read_image_data_url` allows `.png .jpg .jpeg .gif .webp .svg`;
- **writes/deletes** allow `.md` and `.json` only (`write_file`, `write_markdown_file`,
  `delete_file`); `create_dir_recursive` and `list_files` take directories under the same rules;
- errors say `path not allowed: <reason>` and never include file contents.

### M2 — `eval_in_webview` runs arbitrary script in any window (medium)
`src-tauri/src/lib.rs:141-150`. Required: remove `eval_in_webview` from the invoke handler and
replace it with two commands that build the script in Rust:

- `substack_inject_bridge()` — evaluates the fixed bridge script (moved from
  `webviewTransport.ts` `INJECTED_SCRIPT` into `src-tauri/src/substack_bridge.js`, included with
  `include_str!`) in the window labelled exactly `substack-auth`;
- `substack_navigate(publication: String)` — `publication` must match
  `^[a-z0-9][a-z0-9-]{0,62}$`; evaluates `window.location.href = "https://<publication>.substack.com"`.

`webviewTransport.ts` calls these instead of `eval_in_webview`. Any other label/publication →
`Err`.

### M3 — SpockLock client cannot reach the mTLS daemon (medium; functional + security)
`src-tauri/src/spocklock.rs:12` uses `http://localhost:9090/v1/resolve`. Required:

- URL `https://localhost:9090/v1/resolve`; **no plaintext fallback**.
- Trust **only** the SpockLock CA (`ca.pem`) — `tls_built_in_root_certs(false)` +
  `add_root_certificate` — and present the client identity `stacked3.pem` +
  `stacked3-key.pem` (`reqwest::Identity::from_pem` on the concatenated PEMs; `rustls-tls` is
  already enabled).
- Cert directory resolution: `STACKED_SPOCKLOCK_CERT_DIR`, else `SPOCKLOCK_CERT_DIR`, else the
  daemon's default (`directories::ProjectDirs::from("", "", "spocklock")` config dir +
  `/certs`; on macOS `~/Library/Application Support/spocklock/certs`). Compute it without adding a
  crate (`$HOME` + platform path).
- Missing files → `Err("SpockLock client certificate not found in <dir>; ask Chas to run: spocklock-daemon cert-generate client --name stacked3")`.
  Never log the resolved secret; keep the existing "value lives in a local variable for one call"
  doctrine.
- `file_scope` (M1) does not apply to this Rust-internal read.

### L1 — Link checker reaches private addresses (low)
`src-tauri/src/link_health.rs:26-80`. Required: after URL parsing and on every redirect, resolve
the host and return `Unknown` / `"Private or local addresses are not checked"` if any resolved
address is loopback, private (RFC 1918, `fc00::/7`), link-local (`169.254/16`, `fe80::/10`),
CGNAT `100.64/10`, unspecified or multicast. Hostname `localhost` and IP literals are checked
without DNS.

### L2 — Substack window can emit app events (low)
`src-tauri/capabilities/substack-auth.json` grants `core:event:default` to
`https://*.substack.com`. Required: `webviewTransport.ts` accepts a `substack:response` only if
its `id` matches a pending request (already true) **and** the payload has the exact shape
`{id: string, ok: boolean, status: number, body: unknown}`; anything else is ignored.
Capability unchanged (the bridge needs it).

### L3 — Committed tool output (low)
`.playwright-mcp/*.yml` (page dumps). Required: `git rm --cached -r .playwright-mcp` and add
`.playwright-mcp/` to `.gitignore`. Do not rewrite history.

### K1 — No secrets in the tree (guard)
Add `scripts/check-no-secrets.mjs` (Node, no deps) run by `npm test` via a Vitest test: fails on
`sk-or-v1-[0-9a-f]{20,}`, `sk-ant-[A-Za-z0-9_-]{20,}`, `ghp_[A-Za-z0-9]{30,}`,
`-----BEGIN [A-Z ]*PRIVATE KEY-----`, `AIza[0-9A-Za-z_-]{35}` in tracked files (excluding
`node_modules`, `package-lock.json`). Prints `file:line` only.

## 4. SpockLock / credential changes

| Name | Kind | Read by | Exists? | Value | Order relative to rotation |
|---|---|---|---|---|---|
| `spock-openrouter` / `credential` | secret, SpockLock item | `ai.rs`, `image_generation.rs` via `spocklock::resolve` | exists | unchanged | Rotate any time; picked up on next call. |
| SpockLock client certificate `stacked3.pem` + `stacked3-key.pem` | mTLS identity (file, 0600 key) in the SpockLock cert dir | `spocklock.rs` | **NEW** | Chas generates on the Mac that runs StackEd: `spocklock-daemon cert-generate client --name stacked3` (or the equivalent in SpockLock's hardened CLI) | Any time; before Chas next uses AI features. Not a rotation of an existing value. |
| `ca.pem` (SpockLock local CA cert) | public cert | `spocklock.rs` | exists | unchanged | If the SpockLock CA is ever regenerated, `stacked3` must be re-issued. |
| `STACKED_SPOCKLOCK_CERT_DIR` | env, not secret, optional | `spocklock.rs` | **NEW** (optional) | unset by default | n/a |

The user's own BYOK `apiKey` in browser storage (`storage.ts:45`) is not Chas's credential and is
unchanged.

## 5. Out of scope

Release builds (`npm run tauri:build`, `install:app`), notarisation, version bumps, GitHub
settings, the SpockLock daemon itself.

## 6. Open questions (Droid: take the recommended default)

1. **Use DOMPurify instead of a hand-written sanitiser?** Default: **no** — no new dependency;
   the allowlist walker plus `textContent` node views plus CSP are three independent layers.
2. **Allow writes of image files?** Default: **no** for `write_file`; images are written only by
   `save_generated_image_to_artwork`, which must also call `file_scope::check` with an image
   extension allowlist.
3. **Paths outside home** (external drives, `/Volumes/...`)? Default: **deny**; add an explicit
   `STACKED_EXTRA_ROOTS` later if Chas needs it.

## 7. Definition of done

All plan tasks pushed to `main`; `npm run format:check && npm run lint && npm run check && npm run test`
and `cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check`
green; no attribute-derived `innerHTML`; CSP set; every file command guarded; mTLS client works
against a test server.
