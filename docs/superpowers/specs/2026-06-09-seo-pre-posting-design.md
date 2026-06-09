# StackEd SEO Pre-Posting Gate — Spec

**Date:** 2026-06-09
**Status:** Approved
**Scope:** StackEd-owned SEO metadata generation and review before export/posting.

---

## Problem

StackPipe is no longer part of the workflow. StackEd now owns the article flow from Markdown editing through pre-posting preparation.

The current StackEd frontmatter schema is focused on the article scaffold:

```yaml
IMAGE: ""
SPARK: ""
TITLE: ""
SUBTITLE: ""
HOOK: ""
LANDING: ""
created: ""
updated: ""
```

Older StackEd/StackPipe notes referenced an SEO stage and SEO fields, but those fields are not in the current live schema or YAML panel. Before posting, StackEd needs to create SEO metadata in the same YAML-first workflow used for the manuscript.

---

## Design Summary

Add a pre-posting SEO gate inside StackEd.

StackEd will extend the YAML frontmatter with four SEO fields:

```yaml
SEO_TITLE: ""
SEO_DESCRIPTION: ""
SEO_SLUG: ""
SEO_TAGS: []
```

When the user starts export/posting, StackEd checks these fields. If any are blank, StackEd uses the configured AI provider to generate draft values from the current article, writes those values into YAML, marks the article dirty, and stops the export/posting flow. The user reviews and edits the generated fields in the existing YAML side panel. Export/posting can continue only after the SEO fields are present.

---

## Goals

- Keep SEO inside the existing StackEd workflow.
- Store SEO metadata in YAML frontmatter, not a sidecar file.
- Use AI to draft SEO fields before export/posting.
- Let the author edit generated SEO in the existing YAML panel.
- Avoid rebuilding the old StackPipe stage machinery.

---

## Non-Goals

- No external StackPipe dependency.
- No standalone SEO dashboard.
- No keyword-density analyser, SERP simulator, or ranking score in this pass.
- No automatic posting to Substack in this spec.
- No background generation on every save.

---

## Frontmatter Schema

The `ArticleFrontmatter` type gains these fields:

```ts
SEO_TITLE: string;
SEO_DESCRIPTION: string;
SEO_SLUG: string;
SEO_TAGS: string[];
```

The default field order becomes:

```yaml
IMAGE: ""
SPARK: ""
TITLE: ""
SUBTITLE: ""
HOOK: ""
LANDING: ""
SEO_TITLE: ""
SEO_DESCRIPTION: ""
SEO_SLUG: ""
SEO_TAGS: []
created: ""
updated: ""
```

Existing Markdown files that do not have these fields are normalised in memory on open, marked dirty, and saved back using the normal StackEd save path.

---

## YAML Panel

The existing YAML side panel gets a new **SEO** section directly after **Article Structure**. The current **Metadata** section can remain at the top.

Fields:

| Field | Control | Notes |
|---|---|---|
| `SEO_TITLE` | textarea, 2 rows | Search/social title draft |
| `SEO_DESCRIPTION` | textarea, 3 rows | Search/social description |
| `SEO_SLUG` | text input | URL-safe slug |
| `SEO_TAGS` | text input or textarea | Stored as string array in YAML |

`SEO_TAGS` may be edited as comma-separated text in the UI, but it must serialise as a YAML array.

All four SEO fields are author-editable after generation. AI owns the first draft, not the final value.

---

## AI Generation

The existing AI adapter layer is extended with an SEO generation method.

Input:

- Current frontmatter
- Current Markdown body
- Current file path, if available

Output:

```ts
interface SeoDraft {
  SEO_TITLE: string;
  SEO_DESCRIPTION: string;
  SEO_SLUG: string;
  SEO_TAGS: string[];
}
```

Prompt constraints:

- Preserve the article’s actual angle and voice.
- Do not rewrite `TITLE`, `SUBTITLE`, `HOOK`, or manuscript body.
- `SEO_TITLE` should be compelling but not clickbait.
- `SEO_DESCRIPTION` should be one concise search/social summary.
- `SEO_SLUG` should be lowercase, hyphenated, and URL-safe.
- `SEO_TAGS` should be 3–8 short topical tags.

The provider is whichever is already configured in Settings: Claude or OpenAI.

---

## Pre-Posting Gate

The gate runs when the user starts export/posting.

Flow:

1. User starts export/posting.
2. StackEd checks `SEO_TITLE`, `SEO_DESCRIPTION`, `SEO_SLUG`, and `SEO_TAGS`.
3. If all fields are present, continue export/posting.
4. If any field is blank:
   - require a valid AI API key
   - generate SEO draft values
   - patch the YAML frontmatter
   - mark the document dirty
   - stop the export/posting flow
   - show a message telling the user to review and save the SEO fields
5. User reviews/edits SEO fields in the YAML panel.
6. User saves.
7. User starts export/posting again; the gate passes.

This avoids hidden changes being posted without review.

---

## Error Handling

- If no file is open, export/posting remains unavailable.
- If the AI key is missing, show: `Add an AI API key in Settings before generating SEO.`
- If generation fails, leave existing YAML unchanged and show the provider error.
- If the AI returns invalid JSON or missing fields, reject the result and show a concise failure message.
- If only some SEO fields are blank, generation may replace only blank fields; existing author-edited SEO fields are preserved.

---

## Testing

Unit tests:

- frontmatter defaults include all four SEO fields.
- legacy files without SEO fields normalise correctly and are marked dirty.
- serialisation preserves `SEO_TAGS` as a YAML array.
- SEO completeness check returns false when any field is blank.
- SEO completeness check returns true when all fields are populated.
- AI SEO response parser rejects malformed or incomplete output.

Component tests:

- YAML panel renders the SEO section.
- Editing SEO fields marks the document dirty.
- Editing `SEO_TAGS` writes an array back to frontmatter.

Service tests:

- pre-posting gate skips AI when SEO is complete.
- pre-posting gate calls AI when SEO is incomplete.
- generated fields are patched into frontmatter.
- existing non-empty SEO fields are preserved when filling blanks.

---

## Acceptance Criteria

- A new or legacy article opens with SEO fields available in YAML.
- Starting export/posting with blank SEO fields generates AI draft SEO metadata and stops before export/posting.
- Generated SEO appears in the YAML panel and can be edited.
- Saving writes SEO fields into the Markdown frontmatter.
- Starting export/posting again proceeds when all SEO fields are present.
- No StackPipe concepts are required for this workflow.
