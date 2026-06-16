export function detectShell() {
  if (process.platform === 'win32') {
    const parent = (process.env.ComSpec || '').toLowerCase();
    if (parent.includes('cmd.exe')) return 'cmd';
    return 'powershell';
  }
  const shell = (process.env.SHELL || '').toLowerCase();
  if (shell.includes('fish')) return 'fish';
  if (shell.includes('zsh')) return 'zsh';
  return 'bash';
}

export function renderShellEnv(env, shell) {
  const lines = Object.entries(env).map(([key, value]) => renderSet(key, value, shell));
  return `${lines.join('\n')}\n`;
}

export function renderUnset(keys, shell) {
  return `${keys.map((key) => renderRemove(key, shell)).join('\n')}\n`;
}

function renderSet(key, value, shell) {
  if (shell === 'fish') return `set -gx ${key} ${quoteFish(value)};`;
  if (shell === 'powershell') return `$env:${key} = ${quotePowerShell(value)}`;
  if (shell === 'cmd') return `set "${key}=${quoteCmdValue(value)}"`;
  return `export ${key}=${quotePosix(value)}`;
}

function renderRemove(key, shell) {
  if (shell === 'fish') return `set -e ${key};`;
  if (shell === 'powershell') return `Remove-Item Env:${key} -ErrorAction SilentlyContinue`;
  if (shell === 'cmd') return `set "${key}="`;
  return `unset ${key}`;
}

function quotePosix(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function quoteFish(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function quotePowerShell(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function quoteCmdValue(value) {
  return String(value)
    .replace(/\^/g, '^^')
    .replace(/%/g, '^%')
    .replace(/!/g, '^^!')
    .replace(/"/g, '""');
}
