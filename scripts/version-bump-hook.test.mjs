import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { bumpPatchVersionString, applyPatchVersionBump } from './version-bump-hook.mjs';

const tempDirs = [];

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'stacked-version-hook-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('version bump hook', () => {
  test('bumps semver patch string', () => {
    expect(bumpPatchVersionString('0.1.1')).toBe('0.1.2');
    expect(bumpPatchVersionString('1.9.9')).toBe('1.9.10');
  });

  test('applies patch bump to package, lock, and tauri config', async () => {
    const root = await createTempDir();
    const packagePath = join(root, 'package.json');
    const packageLockPath = join(root, 'package-lock.json');
    const tauriPath = join(root, 'src-tauri', 'tauri.conf.json');
    await mkdir(join(root, 'src-tauri'), { recursive: true });
    await writeFile(packagePath, JSON.stringify({
      name: 'stacked',
      version: '0.1.1',
      scripts: {},
    }, null, 2));
    await writeFile(packageLockPath, JSON.stringify({
      name: 'stacked',
      version: '0.1.1',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'stacked',
          version: '0.1.1',
        },
      },
    }, null, 2));
    await writeFile(tauriPath, JSON.stringify({
      productName: 'StackEd',
      version: '0.1.1',
    }, null, 2));

    const nextVersion = await applyPatchVersionBump({
      packagePath,
      packageLockPath,
      tauriConfigPath: tauriPath,
    });

    expect(nextVersion).toBe('0.1.2');
    await expect(readFile(packagePath, 'utf8')).resolves.toContain('"version": "0.1.2"');
    await expect(readFile(packageLockPath, 'utf8')).resolves.toContain('"version": "0.1.2"');
    await expect(readFile(tauriPath, 'utf8')).resolves.toContain('"version": "0.1.2"');
  });
});
