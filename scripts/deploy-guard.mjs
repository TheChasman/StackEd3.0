import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);

function gitOutput(args, execFileSyncImpl = execFileSync) {
  return execFileSyncImpl('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function optionalGitOutput(args, execFileSyncImpl = execFileSync) {
  try {
    return gitOutput(args, execFileSyncImpl);
  } catch {
    return '';
  }
}

export function getDeployBlockers({ status, upstream, aheadBehind }) {
  const blockers = [];
  if (status.trim()) {
    blockers.push('Working tree is not clean. Commit or discard local changes before deploy.');
  }
  if (!upstream.trim()) {
    blockers.push('Current branch has no upstream. Push with upstream before deploy.');
  }

  const [behindRaw, aheadRaw] = aheadBehind.trim().split(/\s+/);
  const ahead = Number.parseInt(aheadRaw || '0', 10);
  const behind = Number.parseInt(behindRaw || '0', 10);
  if (ahead > 0) {
    blockers.push(
      `Branch is ahead of upstream by ${ahead} commit(s). Push before deploy so the build label points at a remote commit.`,
    );
  }
  if (behind > 0) {
    blockers.push(`Branch is behind upstream by ${behind} commit(s). Pull/rebase before deploy.`);
  }
  return blockers;
}

export function assertDeployable(state) {
  const blockers = getDeployBlockers(state);
  if (blockers.length) {
    throw new Error(`Deploy blocked:\n- ${blockers.join('\n- ')}`);
  }
}

export function readGitDeployState(execFileSyncImpl = execFileSync) {
  const upstream = optionalGitOutput(
    ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
    execFileSyncImpl,
  );
  return {
    status: gitOutput(['status', '--porcelain'], execFileSyncImpl),
    upstream,
    aheadBehind: upstream
      ? gitOutput(['rev-list', '--left-right', '--count', `${upstream}...HEAD`], execFileSyncImpl)
      : '0 0',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  try {
    assertDeployable(readGitDeployState());
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
