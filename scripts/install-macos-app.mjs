import { execFileSync } from 'node:child_process';
import { cp, mkdir, rename, rm, stat } from 'node:fs/promises';
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

export function isStackEdRunning(execFileSyncImpl = execFileSync) {
  try {
    execFileSyncImpl('pgrep', ['-x', 'StackEd'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
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

  if (isAppRunning()) {
    throw new Error('Quit StackEd before installing the new build.');
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
