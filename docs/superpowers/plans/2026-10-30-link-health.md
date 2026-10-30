# Link Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the health of authored links and prevent sending a document to Substack unless every link verifies successfully.

**Architecture:** Rust checks HTTP destinations; a session service deduplicates checks and distributes statuses. An editor-only extension renders decorations, Finish explains blockers, and the publishing orchestrator validates a fixed document snapshot before any external operation.

**Tech Stack:** Existing Svelte 5, TypeScript, TipTap 3/ProseMirror, Tauri 2, Rust and reqwest; no additional dependencies.

**Spec:** [Link health design](../specs/2026-10-30-link-health-design.md).

## Global Constraints

- Keep ProseMirror JSON and the existing file format unchanged.
- Health data and styling never appear in saved/exported/published content.
- All-green gate has no override and applies to every Substack action.
- No secrets or browser cookies enter requests; no new secret configuration.
- Preserve offline editing, saving and copying.
- Keep one existing worktree and branch for plan ID `fix-link-dialog`.

## Review Focus

- A late reply for an old URL or another document must not approve current links.
- A host which rejects HEAD but serves GET must still verify successfully.
- A cached green or UI-disabled button must not bypass a fresh service-level gate.
- Nested links, image hrefs and custom buttons must not escape collection.
- Check results must not alter document JSON or exported HTML.

## Task 1: Backend checking and session health service

**Files:** Create `src-tauri/src/link_health.rs`, `src/lib/services/linkHealth.ts`, `src/lib/services/linkHealth.test.ts`; modify `src-tauri/src/lib.rs`.

**Interfaces:**
- Rust command `check_link(url: String) -> LinkCheckResult` serialises `{ status: 'working' | 'dead' | 'unknown', reason: string }`.
- TypeScript exports `LinkStatus`, `LinkCheckResult`, `collectLinks(body: PMDoc): string[]`, and a `LinkHealthService` with `check(url, { fresh? })`, `subscribe(listener)` and `get(url)`.
- Export one shared `linkHealth` instance; backend IPC is injected in tests.
- Validate fragments through `checkFragment(url: string, body: PMDoc): LinkCheckResult`, outside the shared HTTP cache: fragment targets depend on the current document, not just the URL.

- [ ] Write failing Rust tests against a local HTTP fixture: 200, redirect to 200, HEAD 405 then GET 200, 404, 410, 403, 429, 500, redirect loop and timeout. Assert green only on success; definite absence red; blocked/network failures unknown.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml link_health` and observe the expected failures.
- [ ] Implement the command with redirects limited to five, total timeout ten seconds, HEAD and GET fallback, no downloaded body consumption and HTTP(S) scheme validation.
- [ ] Write failing Vitest cases for nested marks, duplicate destinations, image href/custom button URL extraction, unsupported schemes, concurrent deduplication, forced refresh, TTL expiry, late responses and network rejection. Add fragment tests where the same `#target` exists in only one of two documents and where editing removes its target.
- [ ] Run `npm test -- src/lib/services/linkHealth.test.ts` and observe expected failures.
- [ ] Implement the service with at most four concurrent probes, a five-minute cache, status subscriptions and generation-safe updates. Checking results are observable immediately; rejected IPC becomes unknown.
- [ ] Verify both suites and commit `feat: check authored link destinations`.

## Task 2: Inline link states and Finish review

**Files:** Create `src/lib/components/editor/extensions/LinkHealth.ts`, its `.test.ts`, and `src/lib/components/finish/LinkHealthPanel.svelte` with its `.test.ts`; modify `src/lib/components/editor/Editor.svelte`, `src/lib/components/finish/FinishView.svelte`, and `src/lib/themes/catppuccin.css`.

**Interfaces:**
- `LinkHealth` editor extension consumes the shared service and produces only decorations, never marks/attributes in the document model. Authored image/custom-button atom nodes receive node decorations with a status class and tooltip; their node-view anchors inherit the status treatment. Test their actual rendered DOM as well as text links.
- `LinkHealthPanel` receives `body: PMDoc` and `onblockedchange(blocked: boolean)`; it lists all non-green destinations, exposes recheck and reports current blockers synchronously when the body changes.
- `FinishView` adds link blockers to action disabling and rechecks them in its click handler; the service guard in Task 3 remains authoritative.

- [ ] Write failing tests with a real editor and controlled checker results: adding/editing/pasting links starts checking, working/dead/unknown apply distinct classes and title text, editing removes the old result, switching/unmounting ignores old replies.
- [ ] Assert identical editor JSON, HTML and Markdown export before/after health results; the extension is mounted only in the live editor, never in the shared serialization schema.
- [ ] Run focused tests and observe expected failures.
- [ ] Implement subscription cleanup, editor decorations and Catppuccin green solid/red wavy/amber dotted underline rules, retaining normal checking styling.
- [ ] Write failing panel tests: all-green/no-link clears blockers; checking/dead/unknown blocks; changing the body blocks immediately; recheck retries failures; status reasons remain visible in text.
- [ ] Run focused tests, implement panel and Finish integration, then verify and commit `feat: show link health while writing and finishing`.

## Task 3: Enforce publication and verify the branch

**Files:** Modify `src/lib/services/substack/publisher.ts`, `src/lib/services/substack/publisher.test.ts`; add gate helpers/tests to `src/lib/services/linkHealth.ts` as needed.

**Interfaces:**
- `assertLinksGreen(body: PMDoc): Promise<void>` freshly checks every collected destination and throws an error listing non-green URLs/reasons.
- `publishToSubstack` snapshots its scaffold before awaiting anything, validates that snapshot before any Substack transport call, and publishes exactly the validated snapshot.
- Make `createDraft`, `scheduleDraft`, `publishDraft` and `createNote` private helpers so `publishToSubstack` is the only service entry point that can publish; no exported bypass remains.

- [ ] Write failing orchestrator tests: dead/unknown/checking link prevents every transport operation; cached green is rechecked; all-green/no-links permits the existing flow; scheduling and note publication have the same gate. Verify the public module exposes no unguarded publication helpers.
- [ ] Add a deferred-check test: mutating the original document during validation cannot change the body eventually sent to Substack.
- [ ] Run focused tests and observe expected failures.
- [ ] Implement the gate before byline lookup/image upload/draft creation and keep existing tag behaviour.
- [ ] Run `npm run format:check && npm run lint && npm run check && npm test`.
- [ ] Run `cargo fmt --manifest-path src-tauri/Cargo.toml --check` and `cargo test --manifest-path src-tauri/Cargo.toml`.
- [ ] Build the desktop app; manually check green, red, amber, recheck, URL edit and a disabled publication action. Use a local fixture for reproducible outcomes; never publish a real test article.
- [ ] Review `git diff --check`, status and full diff for secrets and export contamination. Commit `feat: require healthy links before publication`.
- [ ] Obtain independent read-only review of the committed branch and record its report outside the worktree through `agent-workflow review`.
- [ ] Hand back the validated branch for the user's integration choice; no push or installation is implied.
