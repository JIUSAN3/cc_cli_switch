import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

const appName = 'ccswitch';

export function statePaths() {
  const root = process.env.CCSWITCH_HOME || path.join(homedir(), `.${appName}`);
  return {
    configDir: root,
    configFile: path.join(root, 'config.json'),
    secretsDir: path.join(root, 'secrets')
  };
}

export async function loadConfig() {
  const paths = statePaths();
  await mkdir(paths.configDir, { recursive: true, mode: 0o700 });
  await mkdir(paths.secretsDir, { recursive: true, mode: 0o700 });
  try {
    const text = await readFile(paths.configFile, 'utf8');
    const config = JSON.parse(text);
    return normalizeConfig(config);
  } catch (error) {
    if (error.code === 'ENOENT') return normalizeConfig({});
    throw error;
  }
}

export async function saveConfig(config) {
  const paths = statePaths();
  await mkdir(paths.configDir, { recursive: true, mode: 0o700 });
  const tmp = `${paths.configFile}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(normalizeConfig(config), null, 2)}\n`, { mode: 0o600 });
  await rename(tmp, paths.configFile);
}

export async function setProfile(config, name, profile) {
  const normalized = normalizeConfig(config);
  normalized.profiles[name] = profile;
  normalized.active = name;
  await saveConfig(normalized);
}

export async function removeProfile(config, name) {
  const normalized = normalizeConfig(config);
  if (!normalized.profiles[name]) {
    const error = new Error(`profile "${name}" does not exist`);
    error.code = 'PROFILE_NOT_FOUND';
    throw error;
  }
  delete normalized.profiles[name];
  if (normalized.active === name) {
    normalized.active = Object.keys(normalized.profiles)[0] || null;
  }
  await saveConfig(normalized);
  await rm(path.join(statePaths().secretsDir, `${safeName(name)}.secret`), { force: true });
}

export function safeName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function normalizeConfig(config) {
  return {
    version: 1,
    active: config.active || null,
    profiles: config.profiles && typeof config.profiles === 'object' ? config.profiles : {}
  };
}
