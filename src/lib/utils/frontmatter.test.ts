import { describe, it, expect } from 'vitest';
import { backfillArticleFrontmatter, parseMarkdownFile, serializeMarkdownFile } from './frontmatter';

const SAMPLE_WITH_FRONTMATTER = `---
TITLE: "Test Article"
created: "2026-05-22"
---

# HOOK
This is the hook section.

# LANDING
This is the landing section.
`;

const SAMPLE_NO_FRONTMATTER_WITH_SECTIONS = `# SPARK
Initial idea here.

# TITLE
My Article Title

# SUBTITLE
The subtitle or hook promise.

# HOOK
Refined opening for reader attention.

# LANDING
Closing thoughts.
`;

const SAMPLE_NO_FRONTMATTER_WITH_INLINE_LABELS = `SPARK: Initial idea here.
TITLE: My Article Title
SUBTITLE: The subtitle or hook promise.
HOOK: Refined opening for reader attention.

This remains article body copy, not part of HOOK.
`;

const SAMPLE_FLATTENED_INLINE_LABELS = 'SPARK: Partial Solution Partiality is easier to see than impartiality. Partiality is easy to spot: Two-Tier Policing by the bucket. TITLE: Partial Solution SUBTITLE: What does impartiality look like? HOOK: The oath taken by Police Officers in England & Wales was changed in 2002: Originally "without favour or affection, malice or ill will" Now: "with fairness"';

const EVERNOTE_TASKS_ARTIFACT = `Content not supported

This block is a placeholder for Tasks, which has been officially released on the newest version of Evernote and is no longer supported on this version. Deleting or moving this block may cause unexpected behavior in newer versions of Evernote.`;
const EVERNOTE_TASKS_HTML_ARTIFACT = `<!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note><div style="--en-task-group:true; --en-id:abc"><div style="font-weight:600">Content not supported</div><div>This block is a placeholder for Tasks, which has been officially released on the newest version of Evernote and is no longer supported on this version. Deleting or moving this block may cause unexpected behavior in newer versions of Evernote.</div></div><div>Real article text.</div></en-note>`;

describe('parseMarkdownFile', () => {
  it('parses TITLE from frontmatter', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    expect(frontmatter.TITLE).toBe('Test Article');
  });

  it('parses created timestamp', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    expect(frontmatter.created).toBe('2026-05-22');
  });

  it('extracts HOOK from body when YAML field is blank', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    expect(frontmatter.HOOK).toContain('This is the hook section');
  });

  it('extracts all sections from body when YAML is empty', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_NO_FRONTMATTER_WITH_SECTIONS);
    expect(String(frontmatter.SPARK)).toContain('Initial idea here');
    expect(String(frontmatter.TITLE)).toContain('My Article Title');
    expect(String(frontmatter.SUBTITLE)).toContain('The subtitle or hook promise');
    expect(String(frontmatter.HOOK)).toContain('Refined opening for reader attention');
    expect(String(frontmatter.LANDING)).toContain('Closing thoughts');
  });

  it('extracts StackEd fields from inline body labels when YAML is empty', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_NO_FRONTMATTER_WITH_INLINE_LABELS);
    expect(frontmatter.SPARK).toBe('Initial idea here.');
    expect(frontmatter.TITLE).toBe('My Article Title');
    expect(frontmatter.SUBTITLE).toBe('The subtitle or hook promise.');
    expect(frontmatter.HOOK).toBe('Refined opening for reader attention.');
  });

  it('extracts StackEd fields from flattened inline body labels when YAML is empty', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE_FLATTENED_INLINE_LABELS);
    expect(frontmatter.SPARK).toBe('Partial Solution Partiality is easier to see than impartiality. Partiality is easy to spot: Two-Tier Policing by the bucket.');
    expect(frontmatter.TITLE).toBe('Partial Solution');
    expect(frontmatter.SUBTITLE).toBe('What does impartiality look like?');
    expect(frontmatter.HOOK).toBe('The oath taken by Police Officers in England & Wales was changed in 2002: Originally "without favour or affection, malice or ill will" Now: "with fairness"');
  });

  it('parses body content', () => {
    const { body } = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    expect(body).toContain('# HOOK');
    expect(body).toContain('# LANDING');
  });

  it('captures field order', () => {
    const { fieldOrder } = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    expect(fieldOrder[0]).toBe('TITLE');
    expect(fieldOrder[1]).toBe('created');
  });

  it('reports whether YAML frontmatter was present', () => {
    expect(parseMarkdownFile(SAMPLE_WITH_FRONTMATTER).hasFrontmatter).toBe(true);
    expect(parseMarkdownFile('Just a body').hasFrontmatter).toBe(false);
  });

  it('handles missing frontmatter gracefully', () => {
    const { frontmatter, body } = parseMarkdownFile('Just a body');
    expect(frontmatter.SPARK ?? '').toBe('');
    expect(body).toBe('Just a body');
  });

  it('removes Evernote Tasks ETL artifacts from the body', () => {
    const { body, removedArtifacts } = parseMarkdownFile(`# Title

Before.

${EVERNOTE_TASKS_ARTIFACT}

After.
`);

    expect(removedArtifacts).toBe(true);
    expect(body).toContain('Before.');
    expect(body).toContain('After.');
    expect(body).not.toContain('Content not supported');
    expect(body).not.toContain('placeholder for Tasks');
  });

  it('removes Evernote Tasks HTML artifacts and unwraps ENML', () => {
    const { body, removedArtifacts } = parseMarkdownFile(EVERNOTE_TASKS_HTML_ARTIFACT);

    expect(removedArtifacts).toBe(true);
    expect(body).toContain('Real article text.');
    expect(body).not.toContain('Content not supported');
    expect(body).not.toContain('placeholder for Tasks');
    expect(body).not.toContain('<en-note>');
  });

  it('does not override explicit YAML values with body sections', () => {
    const content = `---
TITLE: "Explicit Title"
HOOK: "Explicit hook"
---

# TITLE
Body title should not override YAML.

# HOOK
Body hook should not override YAML.
`;
    const { frontmatter } = parseMarkdownFile(content);
    expect(frontmatter.TITLE).toBe('Explicit Title');
    expect(frontmatter.HOOK).toBe('Explicit hook');
  });
});

describe('serializeMarkdownFile', () => {
  it('round-trips a file preserving explicit field order', () => {
    const sample = `---
TITLE: "Test"
created: "2026-05-22"
---

Some body content without section headings.
`;
    const parsed = parseMarkdownFile(sample);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.fieldOrder).toEqual(parsed.fieldOrder);
  });

  it('round-trips field values correctly', () => {
    const parsed = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.TITLE).toBe('Test Article');
    expect(reparsed.frontmatter.created).toBe('2026-05-22');
  });

  it('writes an updated field value', () => {
    const parsed = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    const updated = { ...parsed.frontmatter, TITLE: 'Updated Title' };
    const serialized = serializeMarkdownFile(updated as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.TITLE).toBe('Updated Title');
  });

  it('preserves body exactly', () => {
    const parsed = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.body).toBe(parsed.body);
  });

  it('serializes multiline strings with literal block scalar', () => {
    const parsed = parseMarkdownFile(SAMPLE_WITH_FRONTMATTER);
    const updated = {
      ...parsed.frontmatter,
      SPARK: 'This is a\nmultiline\ntext block',
    };
    const serialized = serializeMarkdownFile(updated as any, parsed.fieldOrder, parsed.body);
    expect(serialized).toContain('SPARK: |');
    const reparsed = parseMarkdownFile(serialized);
    // YAML loader may add trailing newline for block scalars
    expect(String(reparsed.frontmatter.SPARK).trim()).toBe('This is a\nmultiline\ntext block');
  });

  it('serializes SEO_TAGS as a YAML array', () => {
    const serialized = serializeMarkdownFile(
      {
        SEO_TAGS: ['policing', 'justice', 'civil liberties'],
      },
      ['SEO_TAGS'],
      '',
    );

    expect(serialized).toContain('SEO_TAGS:\n  - "policing"\n  - "justice"\n  - "civil liberties"');
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.SEO_TAGS).toEqual(['policing', 'justice', 'civil liberties']);
  });
});

describe('backfillArticleFrontmatter', () => {
  it('fills blank StackEd fields from body sections on save', () => {
    const frontmatter = {
      IMAGE: '',
      SPARK: '',
      TITLE: '',
      SUBTITLE: '',
      HOOK: '',
      LANDING: '',
      SEO_TITLE: '',
      SEO_DESCRIPTION: '',
      SEO_SLUG: '',
      SEO_TAGS: [],
      created: '2026-06-04T00:00:00.000Z',
      updated: '2026-06-04T00:00:00.000Z',
    };

    const backfilled = backfillArticleFrontmatter(frontmatter, SAMPLE_NO_FRONTMATTER_WITH_SECTIONS);

    expect(backfilled.SPARK).toBe('Initial idea here.');
    expect(backfilled.TITLE).toBe('My Article Title');
    expect(backfilled.SUBTITLE).toBe('The subtitle or hook promise.');
    expect(backfilled.HOOK).toBe('Refined opening for reader attention.');
    expect(backfilled.LANDING).toBe('Closing thoughts.');
  });

  it('fills blank StackEd fields from inline body labels on save', () => {
    const frontmatter = {
      IMAGE: '',
      SPARK: '',
      TITLE: '',
      SUBTITLE: '',
      HOOK: '',
      LANDING: '',
      SEO_TITLE: '',
      SEO_DESCRIPTION: '',
      SEO_SLUG: '',
      SEO_TAGS: [],
      created: '2026-06-04T00:00:00.000Z',
      updated: '2026-06-04T00:00:00.000Z',
    };

    const backfilled = backfillArticleFrontmatter(frontmatter, SAMPLE_NO_FRONTMATTER_WITH_INLINE_LABELS);

    expect(backfilled.SPARK).toBe('Initial idea here.');
    expect(backfilled.TITLE).toBe('My Article Title');
    expect(backfilled.SUBTITLE).toBe('The subtitle or hook promise.');
    expect(backfilled.HOOK).toBe('Refined opening for reader attention.');
  });

  it('fills blank StackEd fields from flattened inline body labels on save', () => {
    const frontmatter = {
      IMAGE: '',
      SPARK: '',
      TITLE: '',
      SUBTITLE: '',
      HOOK: '',
      LANDING: '',
      SEO_TITLE: '',
      SEO_DESCRIPTION: '',
      SEO_SLUG: '',
      SEO_TAGS: [],
      created: '2026-06-04T00:00:00.000Z',
      updated: '2026-06-04T00:00:00.000Z',
    };

    const backfilled = backfillArticleFrontmatter(frontmatter, SAMPLE_FLATTENED_INLINE_LABELS);

    expect(backfilled.SPARK).toBe('Partial Solution Partiality is easier to see than impartiality. Partiality is easy to spot: Two-Tier Policing by the bucket.');
    expect(backfilled.TITLE).toBe('Partial Solution');
    expect(backfilled.SUBTITLE).toBe('What does impartiality look like?');
    expect(backfilled.HOOK).toBe('The oath taken by Police Officers in England & Wales was changed in 2002: Originally "without favour or affection, malice or ill will" Now: "with fairness"');
  });

  it('does not overwrite populated StackEd fields on save', () => {
    const frontmatter = {
      IMAGE: '',
      SPARK: '',
      TITLE: 'Manual title',
      SUBTITLE: '',
      HOOK: '',
      LANDING: '',
      SEO_TITLE: '',
      SEO_DESCRIPTION: '',
      SEO_SLUG: '',
      SEO_TAGS: [],
      created: '2026-06-04T00:00:00.000Z',
      updated: '2026-06-04T00:00:00.000Z',
    };

    const backfilled = backfillArticleFrontmatter(frontmatter, SAMPLE_NO_FRONTMATTER_WITH_SECTIONS);

    expect(backfilled.TITLE).toBe('Manual title');
    expect(backfilled.SUBTITLE).toBe('The subtitle or hook promise.');
  });
});
