# StackEd 3 Security Fixes Implementation Plan

> **For the implementing agent (Factory AI Droid or any other):** this plan is self-contained and
> is meant to run start to finish **unattended**. You need no memory of earlier conversations and
> no human input. Read the spec first:
> [`docs/superpowers/specs/2026-11-10-security-fixes-design.md`](../specs/2026-11-10-security-fixes-design.md).
> Finding IDs (H1, M1–M3, L1–L3, K1) refer to that spec. Work test-first: write the failing
> test, run it and **see it fail**, implement, see it pass, run the full suite, commit, push.
> Steps use checkbox (`- [ ]`) syntax. If you use superpowers, REQUIRED SUB-SKILL:
> superpowers:executing-plans (or subagent-driven-development).
>
> **This repo is public.** Commit messages and comments describe fixes, not exploit steps. Test
> fixtures use inert markers (e.g. an attribute value `<b>x</b>` asserted to render as text), not
> working payloads.

**Goal:** stop article content from executing script in the webview, confine file IPC to safe
paths, remove arbitrary `eval`, and make the SpockLock client use mTLS.

**Architecture:** frontend — `textContent` node views, an import-time HTML sanitiser and an
ESLint guard; Tauri — strict CSP, a `file_scope` guard module used by every file command, two
fixed-purpose Substack commands replacing `eval_in_webview`, an mTLS `reqwest` client for
SpockLock, and private-address blocking in the link checker.

**Tech stack:** Svelte 5 + TypeScript + TipTap 3, Vitest (jsdom), ESLint, Prettier; Rust (Tauri 2,
reqwest 0.12 with `rustls-tls`, tokio).

**Spec:** `docs/superpowers/specs/2026-11-10-security-fixes-design.md`

## Hard rules (read before anything else)

1. **Work directly on `main`** (Chas chose "push straight to main"). `git pull --ff-only`
   before each task. **Push after each completed task** (`git push origin main`).
2. **TDD per task**, and the **full test suite green before every push**. The repo's husky
   `pre-push` runs `npm run check && npm run test`; never bypass it (`--no-verify` is forbidden).
   Never weaken, skip or delete a test to get green.
3. **No force-push**, no rebase/amend of pushed commits, no `reset --hard` of pushed history,
   no history rewriting.
4. **No deploys, releases or distribution builds.** No `npm run tauri:build`, `install:app`,
   `scripts/build-apk.sh`, `deploy-guard`, signing, notarisation, tags, GitHub releases. Do not
   bump versions yourself (if SpockLock's global pre-commit hook auto-bumps a patch version,
   leave its change in place).
5. **Do not touch running services on Kirk.** No `launchctl`, no SpockLock daemon restarts, no
   `spocklock-daemon cert-generate` (Chas does that — spec §4), no reads of the real SpockLock
   cert dir. Tests use temp dirs and generated throwaway certs.
6. **No secrets work.** No rotation, no 1Password item changes, no `op`, no Keychain.
7. **Secrets are only read through SpockLock or platform env; never hard-code one.** Task 8's
   guard must pass before every push from Task 8 on.
8. **No new npm or crate dependencies** (dev or runtime). `openssl` CLI may be used *inside tests*
   to make throwaway certs; skip those tests with a clear message if `openssl` is missing.
9. Conventional commits, one commit per task. If the global SpockLock hook adds lines to files
   you did not touch (e.g. `CLAUDE.md`), unstage and discard them.
10. If a step cannot be completed within its task, record it in
    `docs/superpowers/plans/2026-11-10-security-fixes-PROGRESS.md` ("Open issues"), commit, and
    continue with the next independent task.

## Commands

```bash
npm ci
npm run format:check && npm run lint && npm run check && npm run test      # frontend
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings && cargo fmt --check
```

**Full suite** = both lines.

## Before you start

```bash
git checkout main && git pull --ff-only && npm ci
npm run test && (cd src-tauri && cargo test)      # record baseline counts
```

## Global Constraints

- No attribute-derived `innerHTML`/`outerHTML`/`insertAdjacentHTML` in `src/`.
- CSP and devCsp exactly as spec H1.2.
- `file_scope`: under `$HOME`, canonicalised, no dot-component below home, not under
  `~/Library`; read ext `.md .json .txt`; image ext `.png .jpg .jpeg .gif .webp .svg`;
  write/delete ext `.md .json`. Error prefix `path not allowed: `.
- Substack window label `substack-auth`; publication regex `^[a-z0-9][a-z0-9-]{0,62}$`.
- SpockLock URL `https://localhost:9090/v1/resolve`; client cert name `stacked3`; cert dir order
  `STACKED_SPOCKLOCK_CERT_DIR` → `SPOCKLOCK_CERT_DIR` → platform default.

## Review Focus

1. An article whose Poll `duration` (or any other node attribute) contains markup must render it
   as literal text after both Markdown import and scaffold-JSON load. *(Task 1,
   `poll duration renders as text from markdown and json`)*
2. `write_file` to `~/notes/../.zshrc`, or through a symlink inside home pointing at `~/.ssh`,
   must be refused. *(Task 3, `rejects traversal and symlink escape`)*
3. A brand-new file path whose parent directory does not exist yet (new article folder) must
   still be allowed for `create_dir_recursive` + `write_file`. *(Task 3, `allows new article
   folder under home`)*
4. If `stacked3.pem` is missing, AI actions show the actionable error, and never silently try
   plain HTTP. *(Task 5, `missing client cert gives actionable error`)*
5. A Substack publication slug like `x.evil.com/` or `a'b` is rejected before any script runs.
   *(Task 4, `rejects bad publication slug`)*

---

### Task 1: Escape node-view rendering and guard `innerHTML` (H1.1)

**Files:**
- Modify: `src/lib/components/editor/extensions/Poll.ts:55-60` (and `:113` `&times;` → `textContent = "×"`)
- Modify: `eslint.config.js` (add `no-restricted-properties` for `innerHTML`, `outerHTML`, and `no-restricted-syntax` for `insertAdjacentHTML` calls in `src/**`)
- Modify: `src/lib/components/editor/extensions/Paywall.ts:79`, `Recipe.ts:112`, `src/lib/services/substackClipboard.ts:91` (add `// eslint-disable-next-line no-restricted-properties -- constant markup` / `-- values escaped with escapeHtml` / `-- read-only serialisation`)
- Create: `src/lib/components/editor/extensions/Poll.test.ts`

**Interfaces:** none new.

- [ ] **Step 1: Failing test** (`// @vitest-environment jsdom`): build a TipTap `Editor` with
  StarterKit + `Poll`; `poll duration renders as text from markdown and json` — (a) load JSON
  doc with a poll node `attrs.duration = '<b data-x="1">x</b>'`, (b) load HTML
  `<div data-type="poll" duration="<b data-x=&quot;1&quot;>x</b>"></div>`; assert the rendered
  header `textContent` contains `Duration: <b data-x="1">x</b>` and
  `editor.view.dom.querySelector('[data-x]') === null`.
- [ ] **Step 2:** `npx vitest run src/lib/components/editor/extensions/Poll.test.ts` → FAIL.
- [ ] **Step 3:** rebuild the header with two `span`s via `createElement`/`textContent`; add the
  ESLint rule and the three justified disables.
- [ ] **Step 4:** full frontend suite → PASS (`npm run lint` must show no new violations).
- [ ] **Step 5:** commit + push `fix(editor): render node-view attributes as text`

### Task 2: Sanitise imported HTML and set a strict CSP (H1.2, H1.3)

**Files:**
- Create: `src/lib/utils/sanitizeHtml.ts`, `src/lib/utils/sanitizeHtml.test.ts`
- Modify: `src/lib/utils/scaffoldMigration.ts:85-89` (`markdownToPMDoc` sanitises before `generateJSON`)
- Modify: `src-tauri/tauri.conf.json` (`app.security.csp`, `app.security.devCsp`)
- Create: `src/lib/utils/csp.test.ts`

**Interfaces:**
- Produces: `export function sanitizeHtml(html: string): string` — DOMParser
  (`text/html`), walk all elements: drop `script, iframe, object, embed, style, link, meta,
  base, form`; remove every attribute whose name starts with `on`; for `href`, `src`,
  `xlink:href`, `action`, `formaction`, `poster` remove values whose trimmed, lower-cased scheme is
  `javascript:`, `vbscript:` or `data:` (keep `data:image/` on `img[src]`); return
  `body.innerHTML`.
- [ ] **Step 1: Failing tests:** `strips event handler attributes`; `drops script and iframe
  elements`; `removes javascript and vbscript urls` (also with leading spaces/mixed case);
  `keeps data image src on img only`; `keeps normal formatting` (`<p><strong>a</strong> <a href="https://x.test">b</a></p>` unchanged);
  `markdownToPMDoc sanitises raw html in markdown` (raw `<img onerror=…>` in md → resulting
  JSON has no `onerror`). `csp.test.ts`: reads `src-tauri/tauri.conf.json`, asserts `csp` is a
  string containing `script-src 'self'`, `object-src 'none'`, no `unsafe-eval`, and that
  `script-src` has no `'unsafe-inline'`.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement; set CSP strings exactly as spec H1.2.
- [ ] **Step 4:** full suite → PASS. Then run `npm run build` (Vite build only, no Tauri
  bundle) to confirm the app still builds.
- [ ] **Step 5:** commit + push `fix: sanitise imported HTML and set a strict CSP`

### Task 3: `file_scope` guard on every file command (M1)

**Files:**
- Create: `src-tauri/src/file_scope.rs` (with `#[cfg(test)] mod tests`)
- Modify: `src-tauri/src/lib.rs` (`mod file_scope;`), `src-tauri/src/file_io.rs` — every
  `#[tauri::command]` that takes a path: `read_file`, `file_exists`, `write_file`,
  `delete_file`, `list_files`, `create_dir_recursive`, `read_image_data_url`,
  `read_markdown_file`, `write_markdown_file`, `save_generated_image_to_artwork`,
  `list_artwork_images`, `load_artwork_metadata`, `save_artwork_metadata`,
  `organize_pipeline_article`

**Interfaces:**
- Produces:
  - `pub enum Access { ReadText, ReadImage, Write, WriteImage, Delete, Dir }`
  - `pub fn check(path: &str, access: Access) -> Result<PathBuf, String>` (uses `$HOME` from
    `std::env::var("HOME")`)
  - `pub fn check_in(home: &Path, path: &str, access: Access) -> Result<PathBuf, String>` (pure,
    for tests)
  - Image writes (`save_generated_image_to_artwork`) use `Access::WriteImage` (image exts).
  - `file_exists` returns `false` (not an error) for disallowed paths.
- [ ] **Step 1: Failing tests** (temp dir as `home`): `allows markdown under home`;
  `allows new article folder under home` (non-existent `home/A/B/c.md` → `Ok` for `Dir` on
  `home/A/B` and `Write` on the file); `rejects outside home` (`/etc/hosts`);
  `rejects dot components and library` (`home/.ssh/id_ed25519`, `home/.zshrc`,
  `home/Library/LaunchAgents/x.plist`); `rejects traversal and symlink escape`
  (`home/notes/../.zshrc`; symlink `home/link -> home/.ssh`, then `home/link/x.md`);
  `rejects wrong extension` (`Write` on `.sh`, `.plist`; `ReadText` on `.pem`);
  `rejects relative path`.
- [ ] **Step 2:** `cd src-tauri && cargo test file_scope` → FAIL.
- [ ] **Step 3:** implement; call `file_scope::check` first in each listed command and use
  the returned `PathBuf`. Update existing `file_io.rs` tests that used `/tmp` paths to set
  `HOME` to their temp dir (serialise with a `Mutex` if tests mutate env).
- [ ] **Step 4:** full suite → PASS.
- [ ] **Step 5:** commit + push `fix(tauri): confine file commands to safe paths under home`

### Task 4: Replace `eval_in_webview` with fixed Substack commands (M2, L2)

**Files:**
- Create: `src-tauri/src/substack_bridge.rs`, `src-tauri/src/substack_bridge.js`
- Modify: `src-tauri/src/lib.rs` (remove `eval_in_webview`; register `substack_inject_bridge`, `substack_navigate`)
- Modify: `src/lib/services/substack/webviewTransport.ts` (remove `INJECTED_SCRIPT`; call the new commands; validate response shape)
- Modify/Create: `src/lib/services/substack/webviewTransport.test.ts`

**Interfaces:**
- Produces (Rust):
  - `pub const SUBSTACK_LABEL: &str = "substack-auth";`
  - `pub fn validate_publication(p: &str) -> Result<(), String>` (regex in Global Constraints,
    implemented without the `regex` crate)
  - `pub fn navigate_script(p: &str) -> Result<String, String>` →
    `window.location.href = "https://<p>.substack.com";`
  - `#[tauri::command] pub fn substack_inject_bridge(app: tauri::AppHandle) -> Result<(), String>`
  - `#[tauri::command] pub fn substack_navigate(app: tauri::AppHandle, publication: String) -> Result<(), String>`
- Produces (TS): `export function isSubstackResponse(v: unknown): v is { id: string; ok: boolean; status: number; body: unknown }`
- [ ] **Step 1: Failing tests:** Rust `rejects bad publication slug` (`x.evil.com/`, `a'b`,
  `""`, 64-char) and `accepts normal slug` (`chasnewport`); `navigate_script` output equals the
  exact string; `bridge script is the former INJECTED_SCRIPT` (contains `substack:request` and
  `substack:response`). TS: `ignores malformed responses` (`isSubstackResponse({id:1})` false;
  well-formed true); `transport never invokes eval_in_webview` (mock `invoke`, run init, assert
  only `substack_inject_bridge`/`substack_navigate` are called).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement (move the script text verbatim into
  `substack_bridge.js` with the event names inlined; `include_str!` it).
- [ ] **Step 4:** full suite → PASS.
- [ ] **Step 5:** commit + push `fix(tauri): replace eval_in_webview with fixed Substack commands`

### Task 5: mTLS SpockLock client (M3)

**Files:**
- Modify: `src-tauri/src/spocklock.rs`
- Modify: `AGENTS.md` (AI keys section: one paragraph on the `stacked3` client cert and how Chas creates it)

**Interfaces:**
- Produces:
  - `const DAEMON_URL: &str = "https://localhost:9090/v1/resolve";`
  - `pub const CLIENT_CERT_NAME: &str = "stacked3";`
  - `pub fn cert_dir_from(env: impl Fn(&str) -> Option<String>, home: &Path) -> PathBuf`
  - `pub fn build_client(cert_dir: &Path) -> Result<reqwest::Client, String>` — reads
    `ca.pem`, `stacked3.pem`, `stacked3-key.pem`; `tls_built_in_root_certs(false)`,
    `add_root_certificate`, `identity(Identity::from_pem(cert + key))`, 5 s timeout.
  - `resolve(item, field)` uses `build_client(&cert_dir_from(...))`; signature unchanged.
- [ ] **Step 1: Failing tests:** replace `daemon_url_is_loopback_only` with
  `daemon_url_is_https_loopback` (`starts_with("https://localhost:")`); `cert dir precedence`
  (STACKED_ → SPOCKLOCK_ → macOS default `home/Library/Application Support/spocklock/certs`,
  Linux `home/.config/spocklock/certs`); `missing client cert gives actionable error` (empty temp
  dir → error contains `cert-generate client --name stacked3` and the dir); `builds client with
  throwaway certs` (generate CA + client with `openssl` into a temp dir; skip if `openssl`
  missing) → `Ok`.
- [ ] **Step 2:** `cargo test spocklock` → FAIL. **Step 3:** implement. **Step 4:** full suite → PASS.
- [ ] **Step 5:** commit + push `fix(spocklock): use mTLS with a stacked3 client certificate`

### Task 6: Block private addresses in the link checker (L1)

**Files:**
- Modify: `src-tauri/src/link_health.rs`

**Interfaces:**
- Produces: `fn is_blocked_ip(ip: std::net::IpAddr) -> bool`;
  `async fn host_is_private(url: &reqwest::Url) -> bool` (IP literal or `localhost` checked
  directly; otherwise `tokio::net::lookup_host((host, port))`, blocked if **any** address is).
  Redirect policy: the custom policy rejects redirect targets that are IP literals in blocked
  ranges or `localhost` (sync check); the initial URL gets the DNS check.
- [ ] **Step 1: Failing tests:** `blocks private ranges` (127.0.0.1, 10.1.2.3, 172.16.0.1,
  192.168.1.1, 169.254.169.254, 100.64.0.1, ::1, fe80::1, fc00::1, 0.0.0.0, 224.0.0.1 → true;
  1.1.1.1, 2606:4700::1111 → false); `check_link on localhost returns unknown`
  (`http://localhost:1/` → `Unknown`, reason `Private or local addresses are not checked`, no
  connection attempted).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** full suite → PASS (existing
  link-health tests that use a local HTTP fixture must inject an override: add
  `check_with_timeout_allowing_private(url, timeout)` as a `#[cfg(test)]`-only entry point).
- [ ] **Step 5:** commit + push `fix(links): do not probe private or local addresses`

### Task 7: Remove committed tool output (L3)

**Files:** `.gitignore`; untrack `.playwright-mcp/`.
- [ ] **Step 1:** `git rm -r --cached .playwright-mcp && echo '.playwright-mcp/' >> .gitignore`
- [ ] **Step 2:** `git ls-files .playwright-mcp | wc -l` → `0`. Full suite → PASS.
- [ ] **Step 3:** commit + push `chore: stop tracking Playwright MCP output`

### Task 8: Secrets guard (K1)

**Files:** Create `scripts/check-no-secrets.mjs`, `scripts/check-no-secrets.test.mjs`.

**Interfaces:**
- Produces: `export function findSecrets(files: {path: string, text: string}[]): string[]`
  (returns `path:line` entries) and a CLI that runs it over `git ls-files` (excluding
  `node_modules/`, `package-lock.json`, `src-tauri/Cargo.lock`) and exits 1 on hits.
- [ ] **Step 1: Failing tests:** `flags fake openrouter key` (`'sk-or-v1-' + 'a'.repeat(40)` →
  1 hit, output has no key text); `ignores placeholders` (`sk-or-v1-xxxx`); `repo is clean`
  (runs the CLI via `child_process.spawnSync('node', ['scripts/check-no-secrets.mjs'])` → exit 0).
- [ ] **Step 2:** `npx vitest run scripts/check-no-secrets.test.mjs` → FAIL. **Step 3:**
  implement with the patterns in spec K1. **Step 4:** full suite → PASS.
- [ ] **Step 5:** commit + push `chore: add a committed-secrets guard to the test suite`

## Finish

- [ ] Full suite green; `git status` clean; `git log origin/main..main` empty.
- [ ] Write and push `docs/superpowers/plans/2026-11-10-security-fixes-PROGRESS.md` (tasks,
  SHAs, test counts, open issues, and the reminder that Chas must create the `stacked3` client
  certificate). Do not build or install the app.
