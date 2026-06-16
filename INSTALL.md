# Install ccswitch On A VPS

Install from the GitHub repository:

```bash
npm install -g https://github.com/JIUSAN3/cc_cli_switch/archive/refs/heads/main.tar.gz && ccswitch init
```

If the VPS does not have Node.js 18+:

```bash
curl -fsSL https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.sh | sh
```

Install without launching the wizard:

```bash
curl -fsSL https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.sh | CCSWITCH_RUN_INIT=0 sh
```

Install from this Git repository directly with npm and git:

```bash
npm install -g git+https://github.com/JIUSAN3/cc_cli_switch.git && ccswitch init
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/JIUSAN3/cc_cli_switch/main/scripts/install.ps1 | iex
```

After install:

```bash
ccswitch add glm
ccswitch run glm -- claude
```

Claude Code refuses `--dangerously-skip-permissions` when running as root. On a VPS, create a normal user for Claude Code if you need that flag.
