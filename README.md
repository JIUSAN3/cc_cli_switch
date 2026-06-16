# Claude Code Switch Helper

`ccswitch` is an interactive CLI helper for quickly switching Claude Code API gateway profiles. It is designed for local terminals, remote VPS boxes, and CI-like shell sessions where you want to choose your own API base URL, API key, and Claude Code model mappings.

The shape is inspired by helpers such as `npx @z_ai/coding-helper`: run the command, answer the prompts, then use the generated profile from your favorite shell.

## Quick Start

Every VPS can install and start the assistant from GitHub with:

```bash
curl -fsSL https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.sh | sh
```

If this package is published to npm later, this shorter command will also work:

```bash
npm install -g claudecode-switch-helper && ccswitch init
```

The installer checks for Node.js 18+, installs a portable Node.js under `~/.local/share/ccswitch/node` if needed, downloads this repository into `~/.local/share/ccswitch/app`, installs `ccswitch` into `~/.local/bin`, then starts `ccswitch init`.

If GitHub is slow from your region, try a proxy mirror:

```bash
curl -fsSL https://gh.llkk.cc/https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.sh | CCSWITCH_GITHUB_PROXY=https://gh.llkk.cc sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.ps1 | iex
```

Batch deploy without launching the interactive wizard:

```bash
curl -fsSL https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.sh | CCSWITCH_RUN_INIT=0 sh
```

From this repository during development:

```bash
npm install
npm link
ccswitch init
```

Add a profile:

```bash
ccswitch add glm
```

For headless VPS or CI usage, keep the key in your own environment and store only a reference:

```bash
export GLM_API_KEY=sk-your-key
ccswitch add glm --base-url https://gateway.example.com --auth-mode bearer --secret-ref env:GLM_API_KEY --model sonnet --sonnet gateway-sonnet
```

Use it for the current shell:

```bash
eval "$(ccswitch env glm --shell bash)"
claude
```

Or run Claude Code without changing the parent shell:

```bash
ccswitch run glm -- claude
```

Claude Code refuses `--dangerously-skip-permissions` when running as root/sudo. On a VPS, create a normal user for Claude Code if you need that flag.

## Commands

```bash
ccswitch init
ccswitch add <name> [--base-url URL] [--api-key KEY] [--secret-ref env:NAME]
ccswitch list
ccswitch show <name>
ccswitch env <name> --shell bash|zsh|sh|fish|powershell|cmd
ccswitch use <name> --shell auto
ccswitch run <name> -- claude
ccswitch unset --shell bash|zsh|sh|fish|powershell|cmd
ccswitch shell-init --shell bash|zsh|fish|powershell
ccswitch install-shell --shell bash|zsh|fish|powershell
ccswitch remove <name>
ccswitch doctor [name]
```

`env` prints shell code. A child process cannot directly mutate the parent shell, so use `eval`, `source`, `Invoke-Expression`, or prefer `run`.

## Shell Examples

Bash, zsh, sh:

```bash
eval "$(ccswitch env glm --shell bash)"
```

Fish:

```fish
ccswitch env glm --shell fish | source
```

PowerShell:

```powershell
Invoke-Expression (& ccswitch env glm --shell powershell)
```

Windows cmd:

```cmd
for /f "delims=" %i in ('ccswitch env glm --shell cmd') do %i
```

Install a small shell helper so you can type `ccuse glm` and `ccunset`:

```bash
ccswitch install-shell --shell bash
source ~/.bashrc
ccuse glm
```

For zsh, fish, and PowerShell, change the `--shell` value. The installer writes a managed block that can be safely replaced by running the command again.

## Claude Code Variables

Profiles render a conservative Claude Code environment map:

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN` for bearer tokens, or `ANTHROPIC_API_KEY` for API key auth
- `ANTHROPIC_MODEL`
- `ANTHROPIC_DEFAULT_SONNET_MODEL`
- `ANTHROPIC_DEFAULT_OPUS_MODEL`
- `ANTHROPIC_DEFAULT_HAIKU_MODEL`
- `ANTHROPIC_DEFAULT_FABLE_MODEL`
- `ANTHROPIC_CUSTOM_MODEL_OPTION*`
- `API_TIMEOUT_MS`
- `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`
- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`

These are based on Claude Code's documented environment-variable and model-configuration behavior. They are stored as a profile template, not as a claim that every gateway supports every variable. Use `show`, edit `~/.ccswitch/config.json`, and re-run `env` when your gateway needs custom values.

See [examples/config.example.json](examples/config.example.json) for a profile that keeps the secret in `GLM_API_KEY`.

## Config And Secrets

Config is stored at:

```text
~/.ccswitch/config.json
```

Secrets are stored separately at:

```text
~/.ccswitch/secrets/<profile>.secret
```

On Unix-like systems the helper asks Node to create config directories with `0700` and secret files with `0600`. On headless VPS boxes this is the simplest portable default, but it is still plaintext on disk. Do not commit `~/.ccswitch`, paste secrets into issue logs, or pass API keys as command-line flags on shared machines.

If you use `--secret-ref env:NAME`, no key is written by `ccswitch`; the profile only records which environment variable to read at runtime.

## Useful References

- [Claude Code environment variables](https://docs.anthropic.com/en/docs/claude-code/env-vars)
- [Claude Code model configuration](https://docs.anthropic.com/en/docs/claude-code/model-config)
- [Claude Code settings](https://docs.anthropic.com/en/docs/claude-code/settings)

## JSON Output

Use `--json` for automation:

```bash
ccswitch --json doctor
ccswitch --json list
```

Errors under `--json` are machine-readable and do not include secret values.
