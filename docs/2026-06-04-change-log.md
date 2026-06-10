# 2026-06-04 Change Log

Chronological notes for the recent StackEd changes. Times are local session times.

## 12:12 — Seven-field YAML frontmatter

- Replaced the older publishing-oriented YAML schema with the current article scaffold:
  `SPARK`, `TITLE`, `SUBTITLE`, `HOOK`, `LANDING`, `created`, and `updated`.
- Added body-section extraction so blank YAML fields can be populated from matching Markdown headings.
- Simplified the YAML side panel and document store around the new schema.

## 12:16 — Droid model default

- Updated the local Droid settings so new sessions default to `gpt-5.5`.

## 12:29 — Rebuild after YAML UI change

- Rebuilt and reinstalled `/Applications/StackEd.app` so the installed app reflected the new YAML panel.

## 14:44 — Header logo

- Replaced the `StackEd` text in the app header with the StackEd app icon.
- Added `public/stacked-icon.png` for the header image.

## 14:49 — Return to Markdown files

- Removed `.sub` file handling from StackEd source and tests.
- Restored `.md` as the only article file extension for open/save and command-line file handoff.
- Changed the macOS bundle file association to register StackEd as an alternate editor for Markdown documents.

## 14:55 — Markdown normalization on open

- Files opened without YAML frontmatter are normalised into the current seven-field schema in memory and marked dirty for saving.
- Legacy lower-case fields are migrated when possible:
  - `title` → `TITLE`
  - `subtitle` → `SUBTITLE`
  - `spark_notes` → `SPARK`
  - `hook` / `opening` → `HOOK`
- Missing `created` and `updated` values are populated with the current ISO timestamp.
- Evernote Tasks ETL placeholder blocks are removed from opened Markdown bodies and mark the document dirty.

## 15:02 — Dirty normalized files still render body text

- Fixed editor reload behaviour so Markdown body content is loaded whenever a file is opened, even if the file is immediately marked dirty by schema normalization or ETL artifact cleanup.
- Added HTML ENML cleanup for Evernote exports:
  - unwraps the outer `<!DOCTYPE en-note ...><en-note>...</en-note>` shell
  - removes the HTML form of the Evernote Tasks “Content not supported” placeholder
- This fixes files like `Douglas Adams was right as usual.md`, where old frontmatter plus Evernote export HTML caused StackEd to mark the document dirty before the editor body was rendered.

## 15:14 — Saved state button styling

- Updated the header `Save` button so the disabled/saved state remains dimmed but uses green styling.
