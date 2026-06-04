import { describe, expect, it } from 'vitest';
import { formatBuildLabel } from './buildInfo';

describe('formatBuildLabel', () => {
  it('formats a development SemVer label with commit metadata', () => {
    expect(formatBuildLabel({
      version: '0.1.1',
      commit: 'abc1234',
      builtAt: '20260604215041',
      dev: true,
    })).toBe('v0.1.1-dev+abc1234');
  });

  it('uses build time metadata when commit is unavailable', () => {
    expect(formatBuildLabel({
      version: '0.1.1',
      commit: '',
      builtAt: '20260604215041',
      dev: true,
    })).toBe('v0.1.1-dev+20260604215041');
  });
});
