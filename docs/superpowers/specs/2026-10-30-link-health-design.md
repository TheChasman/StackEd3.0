# Link health and publication gate

Status: user approved the four-state behaviour and required all-green publication, 2026-10-30.

StackEd checks a link after creation or editing so the writer can spot broken
references before sending an article to Substack. This extends the in-app Link
dialog already committed on this branch.

## Behaviour

- Working destinations: green text and a clean, solid underline.
- Dead destinations: red text and a wavy underline.
- Checking: ordinary link styling, with a checking tooltip.
- Unverified destinations (offline, timeout, blocked, unsupported): amber and a
  tooltip explaining why verification failed. They must never be labelled dead
  merely because verification was impossible.
- Check newly added, edited, pasted and loaded links. An edited destination loses
  the previous destination's result immediately. Duplicate URLs share a check.
- Results and visual markings are session data. They never change the manuscript,
  autosave dirty state, Markdown mirror, clipboard HTML or Substack payload.
- Finish lists links needing attention and provides an explicit recheck button.
- Every link must be green before an action sends the document to Substack.
  Checking, dead, unknown and stale statuses block; a document with no links
  passes this gate. Existing readiness checks still apply.
- The publishing service repeats validation against a fixed snapshot of the
  document, before its first Substack operation, so direct calls cannot bypass
  the Finish screen and an edit cannot inherit a previous snapshot's approval.
- Local editing, saving and copying remain available offline.

## Implementation decisions delegated to the builder

Use the existing Rust/reqwest backend for HTTP checks, avoiding WebView CORS
restrictions. Follow redirects with a finite limit; bound request duration and
parallelism. Use HEAD first and a minimal GET fallback when HEAD cannot establish
success. Successful final HTTP responses are green; confirmed missing resources
(404/410), malformed URLs and unsafe URL schemes are red. Authentication,
rate-limiting, server failures and network errors are unverified, with a reason.
Non-HTTP destinations must not become green without an applicable validator.

The scope is authored hyperlinks: text link marks, image hrefs, custom button
URLs and embedded publication URLs. Generated Substack actions and media source
URLs are not authored hyperlinks. For local fragments, approve only targets
preserved and rendered by the supported article schema; raw imported IDs do not
establish a target. The current schema has no authorable anchor IDs, so fragments
remain unverified. Do not share fragment results across documents. Do not send
email, launch applications, or follow non-HTTP schemes to test them.

Use editor-only ProseMirror inline decorations for text links and node
decorations/status treatment for linked image, custom-button and embedded
publication node views. Make publication helpers private so every service entry
point uses the gate. Use a shared session service for results. Use Catppuccin
green, red and yellow so all four flavours remain readable. Include status
words/reasons in tooltips and the Finish list; colour is accompanied by underline
style and explanatory text.

Cached results may support editing for up to five minutes. Entering Finish can
refresh them; publication always performs fresh checks. No override or bypass is
part of this feature.

## Verification

Tests cover HTTP outcomes, redirects, fallback, timeout, URL collection,
deduplication, stale responses, URL edits, document switches, editor-only styling,
export cleanliness and publication refusal before external side effects.
Run the project's four checks plus Rust tests/formatting and a desktop smoke test.
