# Install ccswitch On A VPS

Install on a VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.sh | sh
```

If GitHub is slow from your region, try a proxy mirror:

```bash
curl -fsSL https://gh.llkk.cc/https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.sh | CCSWITCH_GITHUB_PROXY=https://gh.llkk.cc sh
```

Install without launching the wizard:

```bash
curl -fsSL https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.sh | CCSWITCH_RUN_INIT=0 sh
```

Install from this Git repository directly with npm and git:

```bash
npm install -g https://github.com/JIUSAN3/cc_cli_switch/archive/refs/heads/main.tar.gz && ccswitch init
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.ps1 | iex
```

After install:

```bash
ccswitch add glm
ccswitch apply glm
claude
```

Claude Code refuses `--dangerously-skip-permissions` when running as root. On a VPS, create a normal user for Claude Code if you need that flag.
