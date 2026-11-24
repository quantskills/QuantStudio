# QuantStudio installation

See [Get started](../README.en.md#get-started) for the stable release commands. Use the prompts below with an agent that can operate your local terminal and files.

## Troubleshooting and local data

**Corepack problems?** First verify the pinned pnpm version inside the repository. See the [official Corepack instructions](https://github.com/nodejs/corepack#how-to-install) for installation, updates and Windows installer conflicts. This project uses pnpm 11.7.0 rather than whichever major version the [general installation page](https://pnpm.io/installation) currently defaults to. In PowerShell, use `corepack.cmd` in place of `corepack` in the README installation commands.

Open the URL printed in the terminal, such as `http://127.0.0.1:3198/`. Configure a model in Settings and start a conversation. Tasks using existing materials do not require a market-data connection.

New installations store configuration and credentials in `~/.dsh-quantstudio` and use a dedicated `quantstudio` profile, leaving the ordinary DSH `web` profile unchanged. A recognized older QuantStudio launcher keeps using its existing `~/.dsh` data directory, preserving sessions and model settings; its original `web` profile is retained.

Override the data directory with `DSH_HOME` and the profile name with `QUANTSKILLS_PROFILE`. Plugin installation calls the project's pinned pnpm 11.7.0 directly, prepares a staging profile, and switches only after installation succeeds. Previous profiles are backed up under `profiles/.qs-backups/` in the data directory. Failed startup restores the previous profile. Start with `corepack pnpm run web` to use these checks and recovery.

Select your workspace in Settings. Stop the local service with `Ctrl+C`, then run the startup command again to continue. On Windows, prefer a short installation path to avoid system path-length limits. OS metadata files (`.DS_Store`, `Thumbs.db`, `desktop.ini`) no longer block managed installation or updates. Actual source changes still select development mode; the terminal reports the source directory used.

Local conversations, configuration and files remain on your computer; configured model and data services use the network. Shared deployments can share workspaces and files, but **do not isolate data between members**.

## Install with an agent

### macOS

```text
Install, verify and start QuantStudio on this Mac. Leave a working local service running when finished.
Official repository: https://github.com/quantskills/QuantStudio.git
Mirror: https://gitee.com/quantskills/QuantStudio.git

1. Inspect the system and tools.
   Identify Apple Silicon or Intel and record macOS, Git, Node.js, npm and Corepack versions and paths.
   Read README.md, engines/packageManager in package.json, and the installation scripts.
   Current requirements are Node.js 22.19+ in the 22.x line or 24+, and pnpm 11.7.0.
   Install missing tools through official installers or an existing package manager, matching the architecture.
   Preserve runtimes used by other projects.
   Explain any required system authorization.

2. Check out the stable v0.1.36 tag in a short, writable directory.
   Run git clone -c core.longpaths=true --branch v0.1.36 https://github.com/quantskills/QuantStudio.git
   If GitHub is unavailable, use the Gitee mirror above with the same tag and report the choice.
   Reuse a directory only if it is clean, has the expected remote and is already checked out at v0.1.36. Otherwise choose a new directory and preserve the existing checkout.

3. Pin the package manager.
   In the repository, run corepack enable and corepack pnpm --version.
   Verify the version matches package.json (currently 11.7.0).
   If Corepack is missing or reports an outdated entry point/signature error, follow https://github.com/nodejs/corepack to install or update it, then retry.
   Do not switch to pnpm@latest or change packageManager/the lockfile to bypass errors.
   Do not run an unpinned pnpm installation outside the repository.

4. Run corepack pnpm install --frozen-lockfile from the repository root.
   Check the exit code.
   Diagnose network, Node, permissions or dependency errors before continuing; retain the lockfile and do not report a failed installation as complete.

5. Run corepack pnpm run check, corepack pnpm run test, and corepack pnpm run test:update in sequence.
   Report each result.
   Investigate failures instead of skipping or weakening checks.
   Keep installation logs and scratch files outside the repository so untracked files do not cause first launch to select development mode.

6. Preserve existing data.
   Let the app resolve its data directory: a new installation defaults to ~/.dsh-quantstudio with the quantstudio profile; a recognized older QuantStudio installation may retain ~/.dsh.
   Inspect and report existing DSH_HOME/QUANTSKILLS_PROFILE overrides before changing them.
   Do not delete sessions, keys or plugins, or manually rewrite ordinary DSH's web profile.

7. Start from the repository using corepack pnpm run web through the normal launcher.
   Do not bypass installation by invoking dsh directly.
   Inspect existing services and occupied ports; do not terminate unrelated processes.
   Select an available port if needed and record it.
   Use a persistent terminal or managed background process, keeping logs and a documented stop procedure.

8. Verify the address actually printed in the startup log rather than assuming a port.
   Check HTTP, then open the QuantStudio home and Settings in a browser and check for startup errors.
   Without browser access, explicitly report HTTP-only verification and give manual UI checks.
   If it runs from a development checkout, report that rather than claiming managed installation.
   Resolve actual filesystem paths when troubleshooting /tmp versus /private/tmp.

9. Report the source directory, commit, actual runtime directory, DSH_HOME, profile, Node/pnpm versions, check results, URL, logs, and commands to stop and start next time.
   Leave the service running.
   I will enter model keys in Settings → Model services; do not expose credentials in logs or replies.
   Do not connect trading accounts or start trading as part of installation.
   A working macOS workspace does not establish that every trading runtime is supported or prepared; report module-specific requirements separately.
```

### Windows

```text
Use PowerShell to install, verify and start QuantStudio on this Windows computer. Leave a working local service running when finished.
Official repository: https://github.com/quantskills/QuantStudio.git
Mirror: https://gitee.com/quantskills/QuantStudio.git

1. Inspect Windows version, x64/ARM64 architecture, and Git, Node.js, npm and Corepack versions and paths.
   Use Get-Command/where.exe to detect competing PATH entries.
   Read README.md, engines/packageManager in package.json, and installation scripts.
   Current requirements are Node.js 22.19+ in the 22.x line or 24+, and pnpm 11.7.0.
   Install missing tools through official installers or an existing package manager, refresh the process PATH and verify again.
   Do not require the whole app to run as administrator by default.

2. Check out the stable v0.1.36 tag in a short, writable directory.
   Run git clone -c core.longpaths=true --branch v0.1.36 https://github.com/quantskills/QuantStudio.git.
   If GitHub is unavailable, use the Gitee mirror above with the same tag and report the choice.
   Reuse a directory only if it is clean, has the expected remote and is already checked out at v0.1.36. Otherwise choose a new directory and preserve the existing checkout. On Windows, avoid OneDrive directories.

3. Pin the package manager.
   In the repository root run corepack.cmd enable and corepack.cmd pnpm --version.
   Verify the package.json version (currently 11.7.0).
   Use .cmd entry points to avoid PowerShell .ps1 execution-policy conflicts.
   If Corepack is missing, outdated or conflicts with the Node Windows installer, follow the Windows instructions at https://github.com/nodejs/corepack.
   Explain any required administrator step without disabling system security policy.
   Do not switch to pnpm@latest or change packageManager/the lockfile to bypass errors.

4. Run corepack.cmd pnpm install --frozen-lockfile.
   Check $LASTEXITCODE after each external command and stop dependent steps on failure.
   Prefer a shorter path for path-length failures and diagnose connectivity before changing network settings.
   Retain the lockfile and fixed dependency versions.

5. Run corepack.cmd pnpm run check, corepack.cmd pnpm run test, and corepack.cmd pnpm run test:update in sequence, recording each exit code and result.
   Diagnose failures rather than skipping or weakening checks.
   Store logs and scratch files outside the repository so they do not cause first launch to select development mode.

6. Preserve existing data.
   New installations default to %USERPROFILE%\.dsh-quantstudio and the quantstudio profile; a recognized older QuantStudio installation may retain %USERPROFILE%\.dsh.
   Inspect DSH_HOME/QUANTSKILLS_PROFILE before changing them.
   Do not remove existing sessions, keys or plugins, or manually rewrite ordinary DSH's web profile.
   Record source and data directories separately.

7. Run corepack.cmd pnpm run web through the normal launcher.
   Do not invoke dsh directly to bypass preparation.
   Inspect existing services and ports without terminating unrelated processes.
   If changing the port, check the supported launcher arguments first.
   Prefer a persistent terminal; when using Start-Process for a background service, include -WindowStyle Hidden, handle paths containing spaces correctly, retain logs and record the PID and stop procedure.

8. Use the URL printed in the startup log, not a hard-coded port such as 3198.
   Check HTTP with Invoke-WebRequest, then verify the QuantStudio home and Settings in a browser and inspect startup errors.
   Without browser access, report HTTP-only verification and provide manual UI checks.
   Confirm the actual runtime directory and distinguish a development checkout from managed installation.
   If a desktop shortcut was created, inspect its target rather than assuming it works.

9. Report source directory, commit, actual runtime directory, DSH_HOME, profile, Node/pnpm versions, check results, URL, logs, PID, and commands to stop and start next time.
   Leave the service running.
   I will enter model keys in Settings → Model services; do not expose credentials in logs or replies.
   Do not connect trading accounts or start trading as part of installation.
   Prepare AI Trader's Python environment separately through its UI when needed; the base workspace does not require Blender.
```
