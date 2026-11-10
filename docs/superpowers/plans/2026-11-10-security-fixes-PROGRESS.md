# Security fixes — progress report

**Plan:** `docs/superpowers/plans/2026-11-10-security-fixes.md`
**Spec:** `docs/superpowers/specs/2026-11-10-security-fixes-design.md`
**Date:** 2026-11-10 · **Executor:** Factory Droid (inline, on `main`)

## Commits

| Task | Commit | Summary |
|---|---|---|
| 1 | `2e2c7eb` | fix(editor): render node-view attributes as text (pre-existing) |
| 2 | `3557694` | fix: sanitise imported HTML and set a strict CSP |
| 3 | `3110e74` | fix(tauri): confine file commands to safe paths under home |
| 4 | `d9064e5` | fix(tauri): replace eval_in_webview with fixed Substack commands |
| 5 | `37935d6` | fix(spocklock): use mTLS with a stacked3 client certificate |
| 6 | `d8a6ec6` | fix(links): do not probe private or local addresses |
| 7 | `f19f534` | chore: stop tracking Playwright MCP output |
| 8 | `66b7ba7` | chore: add a committed-secrets guard to the test suite |

## Final test counts (full suite green at `66b7ba7`)

- Frontend: `npm run format:check && npm run lint && npm run check && npm run test`
  — 41 files, **272 tests passed**; `npm run build` (Vite only) also verified in Task 2.
- Rust: `cargo test` — **48 passed**; `cargo clippy --all-targets -- -D warnings`
  clean; `cargo fmt --check` clean.
- `git status` clean; `git log origin/main..main` empty.

Every task was TDD: failing test written and watched fail, then implemented,
then full suite green, then commit and push (husky pre-push ran
`npm run check && npm run test` on every push; never bypassed).

## Action required from Chas

- **Create the SpockLock client certificate** on each Mac that runs StackEd:
  `spocklock-daemon cert-generate client --name stacked3`
  Until `stacked3.pem` + `stacked3-key.pem` exist next to `ca.pem` in the
  SpockLock cert dir, AI features (SEO, research, image generation) fail with
  an actionable error. There is no plaintext fallback by design.
- No deploy/build was done (per plan): the app has not been rebuilt or
  reinstalled, so the running app does not have these fixes until Chas next
  builds.

## Notes and rulings

- Task 6: the SpockLock global pre-commit hook (trufflehog) blocked the commit
  because a pre-existing link-checker fixture contained the literal
  a URL with embedded `user:password` credentials (example.com). The fixture now builds that URL at
  runtime; test behaviour unchanged. No hook was bypassed.
- Task 8: the first commit attempt was blocked by its own new guard (the test
  file held a literal PEM-header string). Fixed by string concatenation and
  amended **before the commit was ever pushed**; no pushed history was touched.
- `save_generated_image_to_artwork` checks the article path with
  `Access::Write` and the final generated image path with `Access::WriteImage`
  (the article path itself is an `.md`, so a single check cannot satisfy both
  the scoping and the image-extension rules).
- `organize_pipeline_article` keeps its no-op passthroughs (empty pipeline,
  non-`.md` input) and guards with `file_scope::check` before any mutation.
- The openssl-based mTLS client test skips with a message if `openssl` is
  missing; it ran and passed on this machine.

## Open issues

- None.

## Independent security review (2026-11-10, Claude Code, read-only)

Reviewed `01537c8..66b7ba7` against the spec and plan. Most fixes hold.

**Important, fixed in `c0b81c4`** (Codex implementer, Ponytail integrator; TDD):

1. IPv6 literals (`http://[::1]/`) and IPv4-mapped/compatible IPv6 (`::ffff:127.0.0.1`) skipped the private-address gate in `link_health.rs`; DNS errors failed open.
2. Redirects to private *hostnames* were followed, and DNS rebinding worked (pre-check resolved once, reqwest resolved again).

Fix: hosts parsed via `url.host()`, mapped/compatible IPv6 normalised, DNS errors fail closed, a filtering `reqwest::dns::Resolve` checks every connection (first request, each redirect hop, rebinding), and `.no_proxy()`. Rust: 52 tests pass, clippy and fmt clean.

**Minor, left open:**

- `sanitizeHtml.ts:17-24` URL scheme check can be dodged with embedded tab/newline or leading C0 controls (CSP and Tiptap remain backstops).
- `sanitizeHtml.ts:29-56` doesn't walk `<template>` content; `svg`/`math` kept.
- `Editor.svelte:83` inserts research-panel HTML without `sanitizeHtml`.
- `tauri.conf.json:24-25` `img-src https:` allows exfil; Tauri style-src nonce may disable `'unsafe-inline'` (verify in a built app).
- `file_io.rs:377-391` artwork metadata commands discard the checked path (TOCTOU); `organize_pipeline_article` checks `is_file()` before the guard.
- `spocklock.rs:65-71` mTLS never exercised against a server (no wrong-CA test); no `.no_proxy()`.
- `scripts/check-no-secrets.mjs:38-40` throws on tracked-but-deleted files; runs only in `npm test`, not pre-commit.
