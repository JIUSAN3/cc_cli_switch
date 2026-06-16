import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { claudeEnvNames } from './profile.js';

export function claudeSettingsPath() {
  if (process.env.CCSWITCH_CLAUDE_SETTINGS) return process.env.CCSWITCH_CLAUDE_SETTINGS;
  return path.join(homedir(), '.claude', 'settings.json');
}

export async function applyClaudeSettings(env, options = {}) {
  const file = options.file || claudeSettingsPath();
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const current = await readJsonFile(file);
  const backup = await backupSettings(file);
  const next = {
    ...current,
    env: {
      ...(current.env && typeof current.env === 'object' ? current.env : {}),
      ...env
    }
  };
  await writeJsonAtomic(file, next);
  return { file, backup, envNames: Object.keys(env) };
}

export async function unapplyClaudeSettings(options = {}) {
  const file = options.file || claudeSettingsPath();
  const current = await readJsonFile(file);
  const backup = await backupSettings(file);
  const nextEnv = { ...(current.env && typeof current.env === 'object' ? current.env : {}) };
  for (const name of claudeEnvNames) delete nextEnv[name];

  const next = { ...current };
  if (Object.keys(nextEnv).length > 0) next.env = nextEnv;
  else delete next.env;

  await writeJsonAtomic(file, next);
  return { file, backup, removed: claudeEnvNames };
}

async function readJsonFile(file) {
  try {
    const text = await readFile(file, 'utf8');
    if (!text.trim()) return {};
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${file} must contain a JSON object`);
    }
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    if (error instanceof SyntaxError) {
      const wrapped = new Error(`${file} contains invalid JSON: ${error.message}`);
      wrapped.code = 'INVALID_JSON';
      throw wrapped;
    }
    throw error;
  }
}

async function backupSettings(file) {
  try {
    await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const backup = `${file}.ccswitch-backup-${timestamp()}`;
  await copyFile(file, backup);
  return backup;
}

async function writeJsonAtomic(file, value) {
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, file);
}

function timestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}
