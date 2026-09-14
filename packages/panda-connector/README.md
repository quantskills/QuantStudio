# @deepseek-ai/dsh-panda-connector

English | [中文](README.zh.md)

Host-side PandaData authentication and managed runtime for the Web application. The package registers `ctx.pandaConnector`, exposes generated Typert Remotes for inspection, release checks, installation, update, repair, rollback, login, and logout, and runs every SDK operation in a private one-shot Python worker through `ctx.subprocess`.

## Managed runtime

The connector owns `$DSH_HOME/runtimes/pandadata`. Each installation creates a new immutable environment, records its Python and PandaData versions, public-callable fingerprint, required capability flags, and creation time, then changes `active.json` only after the candidate passes validation. The active environment is never modified in place. A rollback target exists only after a successful activation replaces an existing verified environment; the initial activation has none. Older retained environments remain isolated for Sessions that already reference them.

Connector construction inspects the active environment and replays an OS-keyring credential in a new worker when one exists; it does not install or update software by itself. The QuantSkills Client then issues one idempotent preparation request when the application mounts: it bootstraps only when no active environment exists, and otherwise checks for a compatible update. A release check reads the configured HTTPS PyPI JSON endpoint and accepts only a compatibility-matrix release whose exact universal wheel URL and SHA-256 digest match the pinned record. A candidate must expose all required authentication, market, index, and margin capabilities; an update must also preserve every public callable exposed by the active SDK. A failed download, install, authentication replay, bounded read, or execution probe leaves `active.json` unchanged, reports its exact safe failure code, and removes the uncommitted candidate. Runtime inspection also removes unreferenced candidate directories whose connector-owned names prove that they are safe to delete; active, rollback, and Session-retained environments are never cleanup targets. The Host retains the most recent operation failure through ordinary inspection and release checks, and clears it only after the corresponding operation succeeds.

An explicitly configured absolute Python path remains authoritative. Otherwise the connector checks the Host's active `VIRTUAL_ENV`, conventional `.venv`, `.ven`, and `venv` directories at the QuantSkills project root, and then the configured launcher name. Windows resolves `Scripts/python.exe`; macOS and Linux resolve `bin/python`. The selected interpreter must satisfy the SDK compatibility range and is used only to create the connector-owned immutable runtime. The connector never installs PandaData into a discovered project environment. When no local launcher resolves, or the selected interpreter is unsupported, the connector downloads the platform-specific pinned `uv` archive, verifies its fixed SHA-256 digest, and uses it to install Python 3.12 under the connector-owned runtime directory with `UV_PYTHON_INSTALL_DIR`; it does not run an online installer script, change PATH, or modify a system Python installation. The same compatibility record pins PandaData 0.0.14 to its exact universal wheel URL and SHA-256 digest. Unsupported platforms or failed verified downloads fail visibly as `python-unavailable`.

An existing `$DSH_HOME/runtimes/panda-data-0.0.12` environment can be adopted only when no activation file exists and its installed distribution matches the recorded legacy release. A malformed, unsupported, or path-escaping activation file fails loud instead of falling back to the legacy environment.

## Authentication

`login` accepts an explicit account union:

- `phone`: `countryCallingCode` and `nationalNumber`; an omitted calling code defaults to `+86`, visual separators are removed from the national number, and the combined value is checked against E.164 length.
- `email`: trimmed and validated as an email address, without adding a calling code.
- `username`: trimmed and passed unchanged, without adding a calling code.

The password exists only in the Remote request and one one-shot stdin JSON document sent to the private worker. It is never placed in argv, environment variables, a temporary file, Cordis settings, session events, connector state, logs, or telemetry. Responses contain only a fixed error code/message and safe SDK state; neither upstream exception text nor an account identifier is reflected.

The connector stores normalized account and password replay material in the operating-system credential store: Windows Credential Manager, macOS Keychain, or Linux Secret Service. If the keyring is unavailable, a successful login remains usable only in Host memory for the current DSH run and the UI reports that limitation. Network failures retain the saved credential for retry; rejected credentials are removed and require a new login.

An explicit login calls `panda_data.init_token`, verifies `is_authenticated()`, executes the compatibility matrix's bounded read-only market-data call, and completes a bounded script execution probe through the managed sandbox and private bootstrap before storing the credential. Authentication, data, and execution readiness are independent: `connected` reports only authenticated credential replay, while QuantSkills work starts only after the bounded read and execution probe have also succeeded for the active environment. Startup, focus, network recovery, and every QuantSkills Session preflight replay the OS credential in a new worker and restore those readiness checks without installing or updating software. Every login worker and `quantskills_panda_python` runner invokes the SDK's declared `clear_auth()` before exit, so the SDK-generated `user.json` is not a second credential store. Logout deletes the keyring entry and clears every retained SDK environment, but it does not claim server-side token revocation.

The execution probe and `quantskills_panda_python` use the isolation result returned by the standard sandbox capability. A trustworthy backend may report `full` or `partial`; the connector records the backend and actual level and exposes them to the Client instead of upgrading `partial` to `full`. Windows ACL confinement is therefore executable as `partial`, while macOS Seatbelt and Linux bwrap or Landlock report their actual level. A missing backend, a failed confinement operation, or an unusable Python launcher produces `execution-unavailable` and stops the task. The connector never starts an unconfined fallback process.

All lifecycle operations share one serialized queue. Cancellation or disposal aborts active work, terminates the managed process tree through `ctx.subprocess`, waits for tree exit, and drains the queue before completing.

## Configuration

The Cordis plugin accepts `pythonCommand`, `pythonArgs`, `managedPythonVersion`, `dshHome`, `baseURL`, `releaseIndexURL`, `releaseTimeoutMs`, `operationTimeoutMs`, `bootstrapTimeoutMs`, `terminateGraceMs`, and `maxOutputBytes`. `baseURL` defaults to `http://pandadata.pandaaiquant.com`; `releaseIndexURL` defaults to the official PandaData PyPI JSON endpoint; managed Python defaults to `3.12`. URLs, durations, output bounds, and interpreter settings are validated at plugin load. The QuantSkills bundle mounts the Host service, while [`api-remotes`](../../api/remotes/README.md) mounts its generated Client contribution.

## Model Experience

None, as this Host-only connector adds no tool, prompt, message, or model-provider request.

#### KV Cache effect

Authentication and runtime state never enter model input. Client UI invokes only Remote methods. Every QuantSkills Session receives an exact logged runtime binding and executes authorized scripts through `quantskills_panda_python`; credentials reach only the private bootstrap over stdin. Native DSH Sessions do not receive this binding.

## Known Limitations and Deferred Work

- **Linux keyring availability** — OS persistence requires an available Secret Service implementation. Headless Linux environments without one use session-only Host memory and require login again after DSH exits.
- **Read and execution validation require service access** — the first explicit login is stored only after the compatibility-matrix read and bounded script probe complete. Network, account-entitlement, sandbox, or Python failures keep the current runtime unchanged and leave no saved credential.
- **Windows isolation is partial** — the standard Windows ACL backend cannot fully isolate paths writable by Everyone or NTFS hard links. The connector discloses that level and still fails closed when the backend itself is unavailable.
- **No server-side token revocation** — the SDK logout operation clears local authentication state only. PandaData exposes no documented revocation endpoint, so the connector does not claim to revoke a server token.
