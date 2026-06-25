import { describe, expect, test } from 'vitest';
import { assertDeployable, getDeployBlockers, readGitDeployState } from './deploy-guard.mjs';

describe('deploy guard', () => {
  test('allows deployment only from a clean pushed checkout', () => {
    expect(getDeployBlockers({
      status: '',
      upstream: 'origin/main',
      aheadBehind: '0 0',
    })).toEqual([]);
  });

  test('blocks deployment with uncommitted changes', () => {
    expect(getDeployBlockers({
      status: ' M src/App.svelte',
      upstream: 'origin/main',
      aheadBehind: '0 0',
    })).toContain('Working tree is not clean. Commit or discard local changes before deploy.');
  });

  test('blocks deployment when local commits are not pushed', () => {
    expect(getDeployBlockers({
      status: '',
      upstream: 'origin/main',
      aheadBehind: '0 2',
    })).toContain('Branch is ahead of upstream by 2 commit(s). Push before deploy so the build label points at a remote commit.');
  });

  test('blocks deployment when the branch is behind upstream', () => {
    expect(getDeployBlockers({
      status: '',
      upstream: 'origin/main',
      aheadBehind: '2 0',
    })).toContain('Branch is behind upstream by 2 commit(s). Pull/rebase before deploy.');
  });

  test('throws a readable error for unsafe deploy state', () => {
    expect(() => assertDeployable({
      status: '?? src/new-file.ts',
      upstream: 'origin/main',
      aheadBehind: '0 0',
    })).toThrow('Deploy blocked');
  });

  test('reads missing upstream as an empty upstream instead of throwing', () => {
    const execFileSyncImpl = (_, args) => {
      if (args.includes('@{u}')) throw new Error('no upstream');
      if (args.includes('--porcelain')) return '';
      return '0 0';
    };

    expect(readGitDeployState(execFileSyncImpl)).toEqual({
      status: '',
      upstream: '',
      aheadBehind: '0 0',
    });
  });
});
