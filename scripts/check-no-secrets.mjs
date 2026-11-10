#!/usr/bin/env node
// Committed-secrets guard (K1). Scans tracked files for credential-shaped
// strings and prints `path:line` only — never the matched text.
import { execSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PATTERNS = [
  /sk-or-v1-[0-9a-f]{20,}/,
  /sk-ant-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /AIza[0-9A-Za-z_-]{35}/,
];

export function findSecrets(files) {
  const hits = [];
  for (const { path, text } of files) {
    text.split('\n').forEach((line, index) => {
      if (PATTERNS.some((pattern) => pattern.test(line))) {
        hits.push(`${path}:${index + 1}`);
      }
    });
  }
  return hits;
}

const EXCLUDED = new Set(['package-lock.json', 'src-tauri/Cargo.lock']);

function trackedFiles() {
  // -z: NUL-separated, so tracked names with special characters survive.
  return execSync('git ls-files -z', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    .split('\0')
    .filter((path) => path && !path.startsWith('node_modules/') && !EXCLUDED.has(path));
}

const invokedAs = process.argv[1] ? realpathSync(process.argv[1]) : '';
if (invokedAs === fileURLToPath(import.meta.url)) {
  const files = trackedFiles().map((path) => ({ path, text: readFileSync(path, 'utf8') }));
  const hits = findSecrets(files);
  if (hits.length > 0) {
    console.error(hits.join('\n'));
    process.exit(1);
  }
}
