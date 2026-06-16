# Install ccswitch On A VPS

After publishing the npm package:

```bash
npm install -g claudecode-switch-helper && ccswitch init
```

If the VPS does not have Node.js 18+:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.sh | sh
```

Install without launching the wizard:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.sh | CCSWITCH_RUN_INIT=0 sh
```

Install from this Git repository directly with npm:

```bash
npm install -g git+https://github.com/<owner>/<repo>.git && ccswitch init
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.ps1 | iex
```

After install:

```bash
ccswitch add glm
ccswitch run glm -- claude
```
