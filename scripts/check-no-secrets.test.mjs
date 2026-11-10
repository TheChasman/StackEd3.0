import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { findSecrets } from './check-no-secrets.mjs';

describe('check-no-secrets', () => {
  it('flags fake openrouter key', () => {
    const fakeKey = 'sk-or-v1-' + 'a'.repeat(40);
    const hits = findSecrets([{ path: 'src/x.ts', text: `const k = '${fakeKey}';\n` }]);
    expect(hits).toEqual(['src/x.ts:1']);
    expect(JSON.stringify(hits)).not.toContain(fakeKey);
  });

  it('flags each pattern family', () => {
    const cases = [
      'sk-ant-' + 'b'.repeat(30),
      'ghp_' + 'c'.repeat(36),
      '-----BEGIN ' + 'PRIVATE KEY-----',
      'AIza' + 'd'.repeat(35),
    ];
    for (const value of cases) {
      expect(findSecrets([{ path: 'f', text: value }]).length).toBe(1);
    }
  });

  it('ignores placeholders', () => {
    expect(findSecrets([{ path: 'f', text: 'sk-or-v1-xxxx' }])).toEqual([]);
    expect(findSecrets([{ path: 'f', text: 'OPENROUTER_KEY goes here' }])).toEqual([]);
  });

  it('repo is clean', () => {
    const run = spawnSync('node', ['scripts/check-no-secrets.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(0);
  });
});
