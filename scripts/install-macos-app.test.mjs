import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { installMacosApp } from './install-macos-app.mjs';

const tempDirs = [];

async function createTempDir() {
  const dir = await mkdtemp(join(tmpdir(), 'stacked-install-'));
  tempDirs.push(dir);
  return dir;
}

async function createAppBundle(path, marker) {
  await mkdir(join(path, 'Contents', 'Resources'), { recursive: true });
  await writeFile(join(path, 'Contents', 'Resources', 'marker.txt'), marker);
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('installMacosApp', () => {
  test('replaces the installed app with the freshly built bundle', async () => {
    const root = await createTempDir();
    const sourceApp = join(root, 'target', 'StackEd.app');
    const destinationApp = join(root, 'Applications', 'StackEd.app');
    await createAppBundle(sourceApp, 'fresh build');
    await createAppBundle(destinationApp, 'stale build');

    await installMacosApp({
      sourceApp,
      destinationApp,
      isAppRunning: () => false,
      log: () => {},
    });

    await expect(readFile(join(destinationApp, 'Contents', 'Resources', 'marker.txt'), 'utf8'))
      .resolves.toBe('fresh build');
  });

  test('fails before copying when the built app is missing', async () => {
    const root = await createTempDir();

    await expect(installMacosApp({
      sourceApp: join(root, 'missing', 'StackEd.app'),
      destinationApp: join(root, 'Applications', 'StackEd.app'),
      isAppRunning: () => false,
      log: () => {},
    })).rejects.toThrow('Built app not found');
  });

  test('refuses to replace the app while StackEd is running', async () => {
    const root = await createTempDir();
    const sourceApp = join(root, 'target', 'StackEd.app');
    const destinationApp = join(root, 'Applications', 'StackEd.app');
    await createAppBundle(sourceApp, 'fresh build');

    await expect(installMacosApp({
      sourceApp,
      destinationApp,
      isAppRunning: () => true,
      log: () => {},
    })).rejects.toThrow('Quit StackEd before installing');
  });
});
