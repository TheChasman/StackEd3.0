// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml';

describe('sanitizeHtml', () => {
  it('strips event handler attributes', () => {
    const out = sanitizeHtml('<p onclick="alert(1)" onmouseover="x()">hi</p>');
    expect(out).toContain('hi');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('onmouseover');
  });

  it('drops script and iframe elements', () => {
    const out = sanitizeHtml(
      '<p>a</p><script>alert(1)</script><iframe src="https://x.test"></iframe>',
    );
    expect(out).toContain('<p>a</p>');
    expect(out).not.toContain('script');
    expect(out).not.toContain('iframe');
    expect(out).not.toContain('alert');
  });

  it('drops object embed style link meta base form elements', () => {
    const out = sanitizeHtml(
      '<object data="x"></object><embed src="x"><style>body{color:red}</style>' +
        '<link rel="stylesheet" href="x"><meta charset="utf-8"><base href="x"><form action="x"><p>kept</p></form>',
    );
    expect(out).not.toContain('<object');
    expect(out).not.toContain('<embed');
    expect(out).not.toContain('<style');
    expect(out).not.toContain('<link');
    expect(out).not.toContain('<meta');
    expect(out).not.toContain('<base');
    expect(out).not.toContain('<form');
    expect(out).toContain('<p>kept</p>');
  });

  it('removes javascript and vbscript urls', () => {
    for (const scheme of [
      'javascript:alert(1)',
      ' JAVASCRIPT:alert(1)',
      '\t javascript:alert(1)',
      'vbscript:x',
    ]) {
      const out = sanitizeHtml(`<a href="${scheme}">b</a>`);
      expect(out).not.toContain('javascript');
      expect(out).not.toContain('vbscript');
      expect(out).not.toContain('href');
    }
  });

  it('removes data urls except data:image src on img', () => {
    expect(sanitizeHtml('<a href="data:text/html,x">b</a>')).not.toContain('href');
    expect(sanitizeHtml('<img src="data:image/png;base64,AAAA">')).toContain(
      'src="data:image/png;base64,AAAA"',
    );
    expect(sanitizeHtml('<img src="data:text/html,x">')).not.toContain('src');
  });

  it('keeps normal formatting', () => {
    const html = '<p><strong>a</strong> <a href="https://x.test">b</a></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });
});
