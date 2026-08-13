import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');

export function getDefaultSourceApp(root = projectRoot) {
  return join(
    root,
    'src-tauri',
    'target',
    'aarch64-apple-darwin',
    'release',
    'bundle',
    'macos',
    'StackEd.app',
  );
}

export function getDefaultDestinationApp() {
  return '/Applications/StackEd.app';
}

// Match the running process by its bundle path rather than process name:
// the bundle is StackEd.app but its executable is `stacked`, and the comm
// name varies by launch context. The full path is unambiguous.
const PROCESS_MATCH = 'StackEd.app/Contents/MacOS/';

export function isStackEdRunning(execFileSyncImpl = execFileSync) {
  try {
    execFileSyncImpl('pgrep', ['-f', PROCESS_MATCH], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Tidy leftover artifacts from previous builds: detach any orphaned StackEd
// disk images and delete the `rw.*.dmg` temp files that killed DMG builds
// leave behind in the bundle directory.
export async function tidyPreviousBuild(sourceApp, log = console.log) {
  // Detach orphaned StackEd disk images (force, ignore failures).
  try {
    const info = execFileSync('hdiutil', ['info'], { encoding: 'utf8' });
    const devices = new Set();
    let currentDevice = null;
    for (const line of info.split('\n')) {
      const dev = line.match(/^(\/dev\/disk\d+)\b/);
      if (dev) currentDevice = dev[1];
      if (/image-path.*StackEd/i.test(line) && currentDevice) devices.add(currentDevice);
    }
    for (const dev of devices) {
      try {
        execFileSync('hdiutil', ['detach', dev, '-force'], { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
    }
    if (devices.size) log(`Detached ${devices.size} orphaned disk image(s).`);
  } catch {
    /* hdiutil unavailable; skip */
  }

  // Remove stray rw.*.dmg temp files from the macos bundle directory.
  const bundleDir = dirname(sourceApp);
  const entries = await readdir(bundleDir).catch(() => []);
  const strays = entries.filter((name) => /^rw\..*\.dmg$/.test(name));
  for (const name of strays) {
    await rm(join(bundleDir, name), { force: true });
  }
  if (strays.length) log(`Removed ${strays.length} stray DMG temp file(s).`);
}

export async function installMacosApp({
  sourceApp = getDefaultSourceApp(),
  destinationApp = getDefaultDestinationApp(),
  isAppRunning = isStackEdRunning,
  log = console.log,
} = {}) {
  const sourceStats = await stat(sourceApp).catch(() => null);
  if (!sourceStats?.isDirectory()) {
    throw new Error(`Built app not found: ${sourceApp}`);
  }

  await tidyPreviousBuild(sourceApp, log);

  if (isAppRunning()) {
    log('Quitting running StackEd…');
    try {
      execFileSync('pkill', ['-f', PROCESS_MATCH]);
    } catch {
      /* already gone */
    }
    await new Promise((r) => setTimeout(r, 300));
    if (isAppRunning()) {
      throw new Error('Quit StackEd before installing');
    }
  }

  const destinationParent = dirname(destinationApp);
  const tempApp = join(destinationParent, `.StackEd.app.installing-${process.pid}-${Date.now()}`);

  await mkdir(destinationParent, { recursive: true });
  await rm(tempApp, { recursive: true, force: true });

  try {
    await cp(sourceApp, tempApp, { recursive: true });
    await rm(destinationApp, { recursive: true, force: true });
    await rename(tempApp, destinationApp);
  } catch (error) {
    await rm(tempApp, { recursive: true, force: true });
    throw error;
  }

  log(`Installed ${destinationApp}`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  installMacosApp().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
