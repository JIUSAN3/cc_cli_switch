import { spawn } from 'node:child_process';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { applyClaudeSettings, claudeSettingsPath, unapplyClaudeSettings } from './claude-settings.js';
import { loadConfig, removeProfile, saveConfig, setProfile, statePaths } from './config.js';
import { defaultShellTarget, installShellInit, renderShellInit } from './integration.js';
import { buildEnv, claudeEnvNames, redactProfile, validateProfile } from './profile.js';
import { detectShell, renderUnset, renderShellEnv } from './shell.js';
import { readSecret, secretLabel, writeSecret } from './secrets.js';

const helpText = `ccswitch - Claude Code API gateway switch helper

Usage:
  ccswitch init
  ccswitch add <name> [--base-url URL] [--api-key KEY] [--secret-ref env:NAME] [--auth-mode mode]
  ccswitch list [--json]
  ccswitch show <name> [--json] [--reveal-secret]
  ccswitch env <name> [--shell bash|zsh|sh|fish|powershell|cmd] [--no-secrets]
  ccswitch apply <name> [--yes]
  ccswitch unapply [--yes]
  ccswitch use <name> [--shell bash|zsh|sh|fish|powershell|cmd]
  ccswitch run <name> -- <command> [args...]
  ccswitch unset [--shell bash|zsh|sh|fish|powershell|cmd]
  ccswitch shell-init [--shell bash|zsh|fish|powershell|cmd]
  ccswitch install-shell [--shell bash|zsh|fish|powershell] [--target PATH] [--yes]
  ccswitch remove <name>
  ccswitch doctor [name] [--json] [--probe-models]

Examples:
  ccswitch init
  ccswitch add glm
  ccswitch apply glm
  eval "$(ccswitch env glm --shell bash)"
  ccswitch run glm -- claude
`;

export async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args.command) {
    console.log(helpText);
    return;
  }

  switch (args.command) {
    case 'init':
      await commandInit(args);
      return;
    case 'add':
    case 'profile-add':
      await commandAdd(args);
      return;
    case 'list':
      await commandList(args);
      return;
    case 'show':
      await commandShow(args);
      return;
    case 'env':
      await commandEnv(args);
      return;
    case 'apply':
      await commandApply(args);
      return;
    case 'unapply':
      await commandUnapply(args);
      return;
    case 'use':
      await commandUse(args);
      return;
    case 'unset':
      await commandUnset(args);
      return;
    case 'shell-init':
      await commandShellInit(args);
      return;
    case 'install-shell':
      await commandInstallShell(args);
      return;
    case 'run':
      await commandRun(args);
      return;
    case 'remove':
    case 'rm':
      await commandRemove(args);
      return;
    case 'doctor':
      await commandDoctor(args);
      return;
    default:
      throw userError(`unknown command "${args.command}". Run "ccswitch --help".`, 'UNKNOWN_COMMAND');
  }
}

function parseArgs(argv) {
  const result = {
    raw: argv,
    options: {},
    positionals: []
  };
  const separator = argv.indexOf('--');
  const before = separator >= 0 ? argv.slice(0, separator) : argv;
  result.afterSeparator = separator >= 0 ? argv.slice(separator + 1) : [];

  for (let i = 0; i < before.length; i += 1) {
    const token = before[i];
    if (token === '--help' || token === '-h') {
      result.help = true;
      continue;
    }
    if (token === '--json') {
      result.json = true;
      continue;
    }
    if (token.startsWith('--')) {
      const raw = token.slice(2);
      const eq = raw.indexOf('=');
      if (eq >= 0) {
        result.options[raw.slice(0, eq)] = raw.slice(eq + 1);
      } else {
        const next = before[i + 1];
        if (next && !next.startsWith('-')) {
          result.options[raw] = next;
          i += 1;
        } else {
          result.options[raw] = true;
        }
      }
      continue;
    }
    result.positionals.push(token);
  }

  result.command = result.positionals[0];
  result.name = result.positionals[1];
  result.extra = result.positionals.slice(2);
  return result;
}

async function commandInit(args) {
  const config = await loadConfig();
  if (Object.keys(config.profiles).length > 0) {
    printHuman(args, `Config already exists at ${statePaths().configFile}`);
    return;
  }
  if (isInteractive()) {
    await commandAdd({ ...args, command: 'add', name: args.name || undefined });
    return;
  }
  await saveConfig(config);
  printHuman(args, `Created ${statePaths().configFile}`);
}

async function commandAdd(args) {
  const config = await loadConfig();
  const rl = isInteractive() ? createInterface({ input, output }) : null;
  try {
    const name = args.name || await askRequired(rl, 'Profile name');
    const baseUrl = args.options['base-url'] || await askRequired(rl, 'API base URL, for example https://gateway.example.com');
    const authMode = args.options['auth-mode'] || await askChoice(rl, 'Auth mode', ['bearer', 'api-key', 'none'], 'bearer');
    const model = args.options.model || await askDefault(rl, 'Claude Code session model', 'sonnet');

    const models = {
      sonnet: await optionOrAskOptional(args.options.sonnet, rl, 'Sonnet model mapping, blank keeps Claude Code default'),
      opus: await optionOrAskOptional(args.options.opus, rl, 'Opus model mapping, blank keeps Claude Code default'),
      haiku: await optionOrAskOptional(args.options.haiku, rl, 'Haiku model mapping, blank keeps Claude Code default'),
      fable: await optionOrAskOptional(args.options.fable, rl, 'Fable model mapping, blank keeps Claude Code default')
    };

    let secretRef = null;
    if (authMode !== 'none') {
      if (args.options['secret-ref']) {
        secretRef = args.options['secret-ref'];
      } else {
        const key = args.options['api-key'] || await askSecretLike(rl, 'API key/token');
        secretRef = `file:${name}`;
        await writeSecret(name, key);
      }
    }

    const profile = {
      baseUrl,
      authMode,
      secretRef,
      model,
      models: Object.fromEntries(Object.entries(models).filter(([, value]) => value)),
      env: {
        API_TIMEOUT_MS: '1200000',
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
        CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1'
      }
    };

    const errors = validateProfile(profile);
    if (errors.length > 0) {
      throw userError(`invalid profile: ${errors.join('; ')}`, 'INVALID_PROFILE');
    }

    await setProfile(config, name, profile);
    printJsonOrHuman(args, { ok: true, profile: name, config: statePaths().configFile }, `Saved profile "${name}" at ${statePaths().configFile}`);
  } finally {
    rl?.close();
  }
}

async function commandList(args) {
  const config = await loadConfig();
  const profiles = Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    active: config.active === name,
    baseUrl: profile.baseUrl,
    authMode: profile.authMode,
    model: profile.model
  }));
  printJsonOrHuman(args, { ok: true, active: config.active || null, profiles }, formatProfileList(profiles));
}

async function commandShow(args) {
  const name = requireName(args);
  const config = await loadConfig();
  const profile = config.profiles[name];
  if (!profile) throw userError(`profile "${name}" does not exist`, 'PROFILE_NOT_FOUND');
  let shown = redactProfile(profile);
  if (args.options['reveal-secret']) {
    shown = { ...shown, secret: await readSecret(profile.secretRef) };
  }
  printJsonOrHuman(args, { ok: true, name, profile: shown }, JSON.stringify({ name, profile: shown }, null, 2));
}

async function commandEnv(args) {
  const name = requireName(args);
  const shell = normalizeShell(args.options.shell || detectShell());
  const env = await envForProfile(name, { includeSecrets: !args.options['no-secrets'] });
  process.stdout.write(renderShellEnv(env, shell));
}

async function commandApply(args) {
  const name = requireName(args);
  const config = await loadConfig();
  const profile = config.profiles[name];
  if (!profile) throw userError(`profile "${name}" does not exist`, 'PROFILE_NOT_FOUND');

  if (!args.options.yes && isInteractive()) {
    const ok = await confirm(`Apply profile "${name}" to ${claudeSettingsPath()}? This writes API credentials into Claude Code settings. [y/N]: `);
    if (!ok) {
      printHuman(args, 'Cancelled.');
      return;
    }
  }

  const env = await buildEnv(profile, { includeSecrets: true });
  const result = await applyClaudeSettings(env);
  config.active = name;
  await saveConfig(config);
  printJsonOrHuman(args, { ok: true, profile: name, ...result }, `Applied profile "${name}" to ${result.file}${result.backup ? ` (backup: ${result.backup})` : ''}`);
}

async function commandUnapply(args) {
  if (!args.options.yes && isInteractive()) {
    const ok = await confirm(`Remove ccswitch Claude Code env values from ${claudeSettingsPath()}? [y/N]: `);
    if (!ok) {
      printHuman(args, 'Cancelled.');
      return;
    }
  }
  const result = await unapplyClaudeSettings();
  printJsonOrHuman(args, { ok: true, ...result }, `Removed ccswitch env values from ${result.file}${result.backup ? ` (backup: ${result.backup})` : ''}`);
}

async function commandUse(args) {
  const name = requireName(args);
  const shell = normalizeShell(args.options.shell || detectShell());
  const config = await loadConfig();
  const profile = config.profiles[name];
  if (!profile) throw userError(`profile "${name}" does not exist`, 'PROFILE_NOT_FOUND');
  config.active = name;
  await saveConfig(config);
  const env = await buildEnv(profile, { includeSecrets: true });
  process.stdout.write(renderShellEnv(env, shell));
}

async function commandUnset(args) {
  const shell = normalizeShell(args.options.shell || detectShell());
  process.stdout.write(renderUnset(claudeEnvNames, shell));
}

async function commandShellInit(args) {
  const shell = normalizeShell(args.options.shell || detectShell());
  process.stdout.write(`${renderShellInit(shell)}\n`);
}

async function commandInstallShell(args) {
  const shell = normalizeShell(args.options.shell || detectShell());
  const target = args.options.target || defaultShellTarget(shell);
  if (!target) throw userError('cmd shell integration cannot be installed automatically; use ccswitch run <profile> -- claude', 'UNSUPPORTED_INSTALL_TARGET');
  if (!args.options.yes && isInteractive()) {
    const rl = createInterface({ input, output });
    try {
      const answer = (await rl.question(`Install ccswitch shell integration to ${target}? [y/N]: `)).trim().toLowerCase();
      if (answer !== 'y' && answer !== 'yes') {
        printHuman(args, 'Cancelled.');
        return;
      }
    } finally {
      rl.close();
    }
  }
  const file = await installShellInit(shell, target);
  printJsonOrHuman(args, { ok: true, shell, target: file }, `Installed shell integration to ${file}`);
}

async function commandRun(args) {
  const name = requireName(args);
  const command = args.afterSeparator[0] || args.extra[0];
  const commandArgs = args.afterSeparator.length > 0 ? args.afterSeparator.slice(1) : args.extra.slice(1);
  if (!command) throw userError('run requires a command after "--", for example: ccswitch run glm -- claude', 'MISSING_RUN_COMMAND');
  const env = await envForProfile(name, { includeSecrets: true });
  await runChild(command, commandArgs, { ...process.env, ...env });
}

async function commandRemove(args) {
  const name = requireName(args);
  const config = await loadConfig();
  await removeProfile(config, name);
  printJsonOrHuman(args, { ok: true, removed: name }, `Removed profile "${name}"`);
}

async function commandDoctor(args) {
  const config = await loadConfig();
  const name = args.name || config.active;
  const paths = statePaths();
  const checks = [
    { name: 'config_dir', ok: true, detail: paths.configDir },
    { name: 'config_file', ok: true, detail: paths.configFile },
    { name: 'profiles', ok: Object.keys(config.profiles).length > 0, detail: `${Object.keys(config.profiles).length} configured` }
  ];

  if (name && config.profiles[name]) {
    const profile = config.profiles[name];
    checks.push(...validateProfile(profile).map((message) => ({ name: 'profile', ok: false, detail: message })));
    checks.push({ name: 'base_url', ok: /^https?:\/\//.test(profile.baseUrl), detail: profile.baseUrl });
    checks.push({ name: 'secret', ok: profile.authMode === 'none' || Boolean(await readSecret(profile.secretRef).catch(() => '')), detail: secretLabel(profile.secretRef) });
    if (args.options['probe-models']) {
      checks.push(await probeModels(profile));
    }
  } else if (name) {
    checks.push({ name: 'active_profile', ok: false, detail: `profile "${name}" not found` });
  } else {
    checks.push({ name: 'active_profile', ok: false, detail: 'no active profile' });
  }

  const ok = checks.every((check) => check.ok);
  printJsonOrHuman(args, { ok, active: config.active || null, checks }, formatChecks(checks));
  if (!ok) process.exitCode = 1;
}

async function envForProfile(name, options) {
  const config = await loadConfig();
  const profile = config.profiles[name];
  if (!profile) throw userError(`profile "${name}" does not exist`, 'PROFILE_NOT_FOUND');
  return buildEnv(profile, options);
}

async function runChild(command, args, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env,
      shell: process.platform === 'win32'
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(userError(`command terminated by ${signal}`, 'RUN_SIGNAL'));
      } else {
        process.exitCode = code || 0;
        resolve();
      }
    });
  });
}

async function probeModels(profile) {
  const base = profile.baseUrl.endsWith('/') ? profile.baseUrl : `${profile.baseUrl}/`;
  const url = new URL('v1/models', base);
  try {
    const headers = {};
    if (profile.authMode !== 'none') {
      const secret = await readSecret(profile.secretRef);
      if (profile.authMode === 'bearer') headers.Authorization = `Bearer ${secret}`;
      if (profile.authMode === 'api-key') headers['X-Api-Key'] = secret;
    }
    const response = await fetch(url, { headers });
    return { name: 'models_probe', ok: response.ok, detail: `${response.status} ${response.statusText}` };
  } catch (error) {
    return { name: 'models_probe', ok: false, detail: error.message };
  }
}

function formatProfileList(profiles) {
  if (profiles.length === 0) return 'No profiles yet. Run: ccswitch add <name>';
  return profiles.map((profile) => {
    const marker = profile.active ? '*' : ' ';
    return `${marker} ${profile.name}  ${profile.authMode}  ${profile.model}  ${profile.baseUrl}`;
  }).join('\n');
}

function formatChecks(checks) {
  return checks.map((check) => `${check.ok ? 'OK ' : 'ERR'} ${check.name}: ${check.detail}`).join('\n');
}

function printJsonOrHuman(args, value, text) {
  if (args.json) console.log(JSON.stringify(value, null, 2));
  else console.log(text);
}

function printHuman(args, text) {
  if (!args.json) console.log(text);
}

function requireName(args) {
  if (!args.name) throw userError(`${args.command} requires a profile name`, 'MISSING_PROFILE_NAME');
  return args.name;
}

function normalizeShell(shell) {
  const value = String(shell || '').toLowerCase();
  if (value === 'auto') return detectShell();
  if (value === 'pwsh') return 'powershell';
  if (value === 'bash' || value === 'zsh' || value === 'sh' || value === 'fish' || value === 'powershell' || value === 'cmd') return value;
  throw userError(`unsupported shell "${shell}"`, 'UNSUPPORTED_SHELL');
}

function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function askRequired(rl, label) {
  if (!rl) throw userError(`missing required value: ${label}`, 'MISSING_REQUIRED_VALUE');
  while (true) {
    const answer = (await rl.question(`${label}: `)).trim();
    if (answer) return answer;
  }
}

async function askDefault(rl, label, defaultValue) {
  if (!rl) return defaultValue;
  const answer = (await rl.question(`${label} [${defaultValue}]: `)).trim();
  return answer || defaultValue;
}

async function askOptional(rl, label) {
  if (!rl) return '';
  return (await rl.question(`${label}: `)).trim();
}

async function optionOrAskOptional(value, rl, label) {
  if (value !== undefined && value !== true) return String(value);
  return askOptional(rl, label);
}

async function askChoice(rl, label, choices, defaultValue) {
  if (!rl) return defaultValue;
  const answer = (await rl.question(`${label} (${choices.join('/')}) [${defaultValue}]: `)).trim();
  return answer || defaultValue;
}

async function askSecretLike(rl, label) {
  if (!rl) throw userError(`missing required value: ${label}`, 'MISSING_REQUIRED_VALUE');
  return askRequired(rl, label);
}

async function confirm(question) {
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

function userError(message, code) {
  const error = new Error(message);
  error.code = code;
  error.exitCode = 1;
  return error;
}
