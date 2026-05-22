import { describe, it, expect } from 'vitest';
import { parseMarkdownFile, serializeMarkdownFile } from './frontmatter';

const SAMPLE = `---
title: "Test Article"
guid: "abc-123"
pipeline_stage: writing
content_locked: false
overrides: []
substack_tags: []
send_email: true
---

# Body here

Some paragraph.
`;

describe('parseMarkdownFile', () => {
  it('parses title from frontmatter', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE);
    expect(frontmatter.title).toBe('Test Article');
  });

  it('parses body content', () => {
    const { body } = parseMarkdownFile(SAMPLE);
    expect(body.trim()).toContain('# Body here');
  });

  it('parses boolean fields', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE);
    expect(frontmatter.send_email).toBe(true);
    expect(frontmatter.content_locked).toBe(false);
  });

  it('parses empty array', () => {
    const { frontmatter } = parseMarkdownFile(SAMPLE);
    expect(frontmatter.overrides).toEqual([]);
  });

  it('captures field order', () => {
    const { fieldOrder } = parseMarkdownFile(SAMPLE);
    expect(fieldOrder[0]).toBe('title');
    expect(fieldOrder[1]).toBe('guid');
  });

  it('handles missing frontmatter gracefully', () => {
    const { frontmatter, body } = parseMarkdownFile('Just a body');
    expect(frontmatter).toEqual({});
    expect(body).toBe('Just a body');
  });
});

describe('serializeMarkdownFile', () => {
  it('round-trips a file without changing field order', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(Object.keys(reparsed.frontmatter)).toEqual(Object.keys(parsed.frontmatter));
  });

  it('round-trips field values correctly', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.title).toBe('Test Article');
    expect(reparsed.frontmatter.guid).toBe('abc-123');
    expect(reparsed.frontmatter.send_email).toBe(true);
  });

  it('writes an updated field value', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const updated = { ...parsed.frontmatter, title: 'Updated Title' };
    const serialized = serializeMarkdownFile(updated as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.title).toBe('Updated Title');
    expect(reparsed.frontmatter.guid).toBe('abc-123'); // unchanged
  });

  it('serializes a non-empty array in block style', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const updated = { ...parsed.frontmatter, substack_tags: ['paris', 'architecture'] };
    const serialized = serializeMarkdownFile(updated as any, parsed.fieldOrder, parsed.body);
    expect(serialized).toContain('- "paris"');
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.frontmatter.substack_tags).toEqual(['paris', 'architecture']);
  });

  it('serializes an empty array as []', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    expect(serialized).toContain('overrides: []');
  });

  it('preserves body exactly', () => {
    const parsed = parseMarkdownFile(SAMPLE);
    const serialized = serializeMarkdownFile(parsed.frontmatter as any, parsed.fieldOrder, parsed.body);
    const reparsed = parseMarkdownFile(serialized);
    expect(reparsed.body).toBe(parsed.body);
  });
});
