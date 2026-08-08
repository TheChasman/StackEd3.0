import { describe, it, expect } from 'vitest';
import { buildBodyFromPreset, BUILT_IN_BODY_PRESETS, type BodyPreset } from './bodyPresets';

describe('bodyPresets', () => {
  it('exposes all four preset names in declared order', () => {
    expect(BUILT_IN_BODY_PRESETS).toEqual([
      'minimal-paragraph', 'paragraph-heading', 'multi-section', 'full-mirror',
    ]);
  });

  it('multi-section has 4 top-level nodes in the expected order', () => {
    const doc = buildBodyFromPreset('multi-section');
    expect(doc.type).toBe('doc');
    expect(doc.content.map(n => n.type)).toEqual(['paragraph', 'paragraph', 'heading', 'blockquote']);
  });

  it('multi-section paragraphs contain the expected body text', () => {
    const doc = buildBodyFromPreset('multi-section');
    const p1 = doc.content[0];
    const p2 = doc.content[1];
    expect(p1.content?.[0]).toMatchObject({ type: 'text', text: 'Body round-trip test — paragraph 1.' });
    expect(p2.content?.[0]).toMatchObject({ type: 'text', text: 'Body round-trip test — paragraph 2.' });
  });

  it('multi-section heading is H2 with the expected text', () => {
    const doc = buildBodyFromPreset('multi-section');
    const heading = doc.content[2];
    expect(heading).toMatchObject({ type: 'heading', attrs: { level: 2 } });
    expect(heading.content?.[0]).toMatchObject({ type: 'text', text: 'Section heading' });
  });

  it('multi-section blockquote first child is a paragraph', () => {
    const doc = buildBodyFromPreset('multi-section');
    const blockquote = doc.content[3];
    expect(blockquote.type).toBe('blockquote');
    expect(blockquote.content?.[0]?.type).toBe('paragraph');
    expect(blockquote.content?.[0]?.content?.[0]).toMatchObject({
      type: 'text', text: 'A quoted passage for testing blockquotes.',
    });
  });

  it('returns structurally-equal but distinct instances across calls', () => {
    const a = buildBodyFromPreset('multi-section');
    const b = buildBodyFromPreset('multi-section');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.content).not.toBe(b.content);
  });

  it('throws on unknown preset name', () => {
    expect(() => buildBodyFromPreset('bogus' as BodyPreset)).toThrow(/bogus/);
  });

  it('full-mirror stub returns the multi-section shape', () => {
    expect(buildBodyFromPreset('full-mirror')).toEqual(buildBodyFromPreset('multi-section'));
  });

  it('minimal-paragraph returns one paragraph with the body text', () => {
    const doc = buildBodyFromPreset('minimal-paragraph');
    expect(doc.content.map(n => n.type)).toEqual(['paragraph']);
    expect(doc.content[0].content?.[0]).toMatchObject({ type: 'text', text: 'Body round-trip test.' });
  });

  it('paragraph-heading returns a paragraph plus an H2', () => {
    const doc = buildBodyFromPreset('paragraph-heading');
    expect(doc.content.map(n => n.type)).toEqual(['paragraph', 'heading']);
    expect(doc.content[1]).toMatchObject({ type: 'heading', attrs: { level: 2 } });
  });
});
