import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { detectShell } from './shell.js';

const begin = '# >>> ccswitch shell integration >>>';
const end = '# <<< ccswitch shell integration <<<';

export function renderShellInit(shell) {
  if (shell === 'fish') {
    return [
      'function ccuse',
      '  ccswitch env $argv[1] --shell fish | source',
      'end',
      '',
      'function ccunset',
      '  ccswitch unset --shell fish | source',
      'end'
    ].join('\n');
  }

  if (shell === 'powershell') {
    return [
      'function ccuse($name) {',
      '  Invoke-Expression (& ccswitch env $name --shell powershell)',
      '}',
      '',
      'function ccunset {',
      '  Invoke-Expression (& ccswitch unset --shell powershell)',
      '}'
    ].join('\n');
  }

  if (shell === 'cmd') {
    return [
      '@echo off',
      'echo Use: for /f "delims=" %%i in (\'ccswitch env PROFILE --shell cmd\') do %%i'
    ].join('\n');
  }

  const envShell = shell === 'zsh' ? 'zsh' : 'bash';
  return [
    'ccuse() {',
    `  eval "$(ccswitch env "$1" --shell ${envShell})"`,
    '}',
    '',
    'ccunset() {',
    `  eval "$(ccswitch unset --shell ${envShell})"`,
    '}'
  ].join('\n');
}

export function managedShellBlock(shell) {
  return `${begin}\n${renderShellInit(shell)}\n${end}\n`;
}

export function defaultShellTarget(shell = detectShell()) {
  const home = homedir();
  if (shell === 'zsh') return path.join(home, '.zshrc');
  if (shell === 'fish') return path.join(home, '.config', 'fish', 'conf.d', 'ccswitch.fish');
  if (shell === 'powershell') return path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1');
  if (shell === 'cmd') return null;
  return path.join(home, '.bashrc');
}

export async function installShellInit(shell, target) {
  const file = target || defaultShellTarget(shell);
  if (!file) {
    const error = new Error('cmd shell integration is not installed automatically; use ccswitch run <profile> -- claude');
    error.code = 'UNSUPPORTED_INSTALL_TARGET';
    throw error;
  }

  await mkdir(path.dirname(file), { recursive: true });
  const block = managedShellBlock(shell);
  let existing = '';
  try {
    existing = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const pattern = new RegExp(`${escapeRegExp(begin)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, 'm');
  const next = pattern.test(existing)
    ? existing.replace(pattern, block)
    : `${existing.replace(/\s*$/, '')}${existing.trim() ? '\n\n' : ''}${block}`;
  await writeFile(file, next, 'utf8');
  return file;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
