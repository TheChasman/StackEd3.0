import { describe, it, expect } from 'vitest';
import { parseMarkdownFile, serializeMarkdownFile } from './frontmatter';

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

  it('handles missing frontmatter gracefully', () => {
    const { frontmatter, body } = parseMarkdownFile('Just a body');
    expect(frontmatter.SPARK ?? '').toBe('');
    expect(body).toBe('Just a body');
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
});
