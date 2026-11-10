import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));

describe('CSP', () => {
  it('sets a strict csp', () => {
    const csp = conf.app.security.csp;
    expect(typeof csp).toBe('string');
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-eval');
    const scriptSrc = csp.split(';').find((d: string) => d.trim().startsWith('script-src'));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('devCsp differs only in connect-src', () => {
    const dev = conf.app.security.devCsp;
    expect(typeof dev).toBe('string');
    expect(dev).toContain('ws://localhost:5173');
    expect(dev).toContain("script-src 'self'");
    expect(dev).not.toContain('unsafe-eval');
    const scriptSrc = dev.split(';').find((d: string) => d.trim().startsWith('script-src'));
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });
});
