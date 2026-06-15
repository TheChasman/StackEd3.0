import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = resolve(dirname(scriptPath), '..');

function toJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export function bumpPatchVersionString(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid semver version: ${version}`);
  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10) + 1;
  return `${major}.${minor}.${patch}`;
}

export async function applyPatchVersionBump({
  packagePath = join(projectRoot, 'package.json'),
  packageLockPath = join(projectRoot, 'package-lock.json'),
  tauriConfigPath = join(projectRoot, 'src-tauri', 'tauri.conf.json'),
} = {}) {
  const [packageJson, packageLockJson, tauriConfigJson] = await Promise.all([
    readJson(packagePath),
    readJson(packageLockPath),
    readJson(tauriConfigPath),
  ]);

  const nextVersion = bumpPatchVersionString(packageJson.version);
  packageJson.version = nextVersion;
  packageLockJson.version = nextVersion;
  if (packageLockJson.packages?.['']) {
    packageLockJson.packages[''].version = nextVersion;
  }
  tauriConfigJson.version = nextVersion;

  await Promise.all([
    writeFile(packagePath, toJson(packageJson)),
    writeFile(packageLockPath, toJson(packageLockJson)),
    writeFile(tauriConfigPath, toJson(tauriConfigJson)),
  ]);

  return nextVersion;
}

function stageVersionFiles() {
  execFileSync(
    'git',
    ['add', 'package.json', 'package-lock.json', 'src-tauri/tauri.conf.json'],
    { stdio: 'inherit' },
  );
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const shouldStage = process.argv.includes('--stage');
  const version = await applyPatchVersionBump();
  if (shouldStage) {
    stageVersionFiles();
  }
  process.stdout.write(`Bumped version to ${version}\n`);
}
