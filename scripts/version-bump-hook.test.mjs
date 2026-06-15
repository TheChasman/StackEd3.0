import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { bumpPatchVersionString, bumpCargoTomlVersion, applyPatchVersionBump } from './version-bump-hook.mjs';

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

  test('bumps Cargo.toml version in [package] section', () => {
    const input = `[package]
name = "stacked"
version = "0.1.1"
description = "Test"
edition = "2021"

[dependencies]
tauri = { version = "2.11.2" }
`;
    const result = bumpCargoTomlVersion(input, '0.1.2');
    expect(result).toContain('version = "0.1.2"');
    expect(result).not.toContain('version = "0.1.1"');
    // Should not touch dependency versions
    expect(result).toContain('tauri = { version = "2.11.2" }');
  });

  test('applies patch bump to package, lock, tauri config, and Cargo.toml', async () => {
    const root = await createTempDir();
    const packagePath = join(root, 'package.json');
    const packageLockPath = join(root, 'package-lock.json');
    const tauriPath = join(root, 'src-tauri', 'tauri.conf.json');
    const cargoPath = join(root, 'src-tauri', 'Cargo.toml');
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
    await writeFile(cargoPath, `[package]
name = "stacked"
version = "0.1.1"
edition = "2021"

[dependencies]
tauri = { version = "2.11.2" }
`);

    const nextVersion = await applyPatchVersionBump({
      packagePath,
      packageLockPath,
      tauriConfigPath: tauriPath,
      cargoTomlPath: cargoPath,
    });

    expect(nextVersion).toBe('0.1.2');
    await expect(readFile(packagePath, 'utf8')).resolves.toContain('"version": "0.1.2"');
    await expect(readFile(packageLockPath, 'utf8')).resolves.toContain('"version": "0.1.2"');
    await expect(readFile(tauriPath, 'utf8')).resolves.toContain('"version": "0.1.2"');
    const cargoResult = await readFile(cargoPath, 'utf8');
    expect(cargoResult).toContain('version = "0.1.2"');
    expect(cargoResult).toContain('tauri = { version = "2.11.2" }');
  });
});
