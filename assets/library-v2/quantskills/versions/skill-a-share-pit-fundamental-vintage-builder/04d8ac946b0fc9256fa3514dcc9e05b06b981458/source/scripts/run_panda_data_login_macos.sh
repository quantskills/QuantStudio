#!/usr/bin/env bash
set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

python3 login_panda_data.py
status=$?

if [[ "$status" -eq 0 ]]; then
  terminal_tty="$(tty)"
  osascript - "$terminal_tty" <<'APPLESCRIPT'
on run argv
  set targetTty to item 1 of argv
  tell application "Terminal"
    repeat with aWindow in windows
      repeat with aTab in tabs of aWindow
        if tty of aTab is targetTty then
          close aTab saving no
          return
        end if
      end repeat
    end repeat
  end tell
end run
APPLESCRIPT
fi

exit "$status"
