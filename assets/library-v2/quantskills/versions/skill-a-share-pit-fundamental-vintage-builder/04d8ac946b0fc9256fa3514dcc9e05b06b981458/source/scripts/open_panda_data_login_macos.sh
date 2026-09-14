#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This launcher requires macOS."
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

osascript - "$script_dir" <<'APPLESCRIPT'
on run argv
  set scriptDir to item 1 of argv
  tell application "Terminal"
    activate
    do script "cd " & quoted form of scriptDir & " && bash run_panda_data_login_macos.sh"
  end tell
end run
APPLESCRIPT
