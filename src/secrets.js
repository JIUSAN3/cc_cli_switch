import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { safeName, statePaths } from './config.js';

export async function writeSecret(name, value) {
  const paths = statePaths();
  await mkdir(paths.secretsDir, { recursive: true, mode: 0o700 });
  const file = path.join(paths.secretsDir, `${safeName(name)}.secret`);
  await writeFile(file, `${String(value).trim()}\n`, { mode: 0o600 });
  await chmod(file, 0o600).catch(() => {});
  return `file:${name}`;
}

export async function readSecret(ref) {
  if (!ref) return '';
  if (ref.startsWith('env:')) {
    const key = ref.slice(4);
    const value = process.env[key];
    if (!value) throw new Error(`secret environment variable ${key} is not set`);
    return value;
  }
  if (ref.startsWith('file:')) {
    const name = ref.slice(5);
    const file = path.join(statePaths().secretsDir, `${safeName(name)}.secret`);
    return (await readFile(file, 'utf8')).trim();
  }
  if (ref.startsWith('plain:')) {
    return ref.slice(6);
  }
  throw new Error(`unsupported secret reference: ${secretLabel(ref)}`);
}

export function secretLabel(ref) {
  if (!ref) return 'missing';
  if (ref.startsWith('plain:')) return 'plain:***';
  return ref;
}
