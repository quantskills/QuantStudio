from __future__ import annotations

import getpass
import os
import subprocess
import sys
import time
from typing import Protocol

try:
    from .build_pit_panel import (
        MACOS_KEYCHAIN_PASSWORD_ACCOUNT,
        MACOS_KEYCHAIN_SERVICE,
        MACOS_KEYCHAIN_USERNAME_ACCOUNT,
        PitBuildError,
    )
except ImportError:
    from build_pit_panel import (
        MACOS_KEYCHAIN_PASSWORD_ACCOUNT,
        MACOS_KEYCHAIN_SERVICE,
        MACOS_KEYCHAIN_USERNAME_ACCOUNT,
        PitBuildError,
    )


class PandaDataClient(Protocol):
    def get_trade_cal(self, **kwargs: object) -> object: ...


SUCCESS_CLOSE_DELAY_SECONDS = 3


def normalize_username(value: str) -> str:
    """Normalize Panda Data account input to the required 86-prefixed form."""
    username = value.strip()
    return username if not username or username.startswith("86") else f"86{username}"


def initialize_client(username: str, password: str) -> PandaDataClient:
    """Authenticate with Panda Data using credentials held only in process memory."""
    try:
        import panda_data
    except ModuleNotFoundError as exc:
        raise PitBuildError("panda_data is not installed in the active Python environment.") from exc
    panda_data.init_token(username, password)
    return panda_data


def verify_connection(client: PandaDataClient) -> None:
    """Make one small authenticated query to verify the token and service reachability."""
    calendar = client.get_trade_cal(
        start_date="20240102", end_date="20240110", exchange="SH", is_trading_day=1
    )
    if getattr(calendar, "empty", False):
        raise PitBuildError("Panda Data returned no trading-calendar records during connectivity validation.")


def persist_windows_user_credentials(username: str, password: str) -> None:
    """Persist credentials under the current Windows user only after validation succeeds."""
    if sys.platform != "win32":
        raise PitBuildError("Interactive credential persistence is currently supported on Windows only.")
    try:
        import winreg

        environment_key = winreg.CreateKeyEx(
            winreg.HKEY_CURRENT_USER, "Environment", 0, winreg.KEY_SET_VALUE
        )
        try:
            winreg.SetValueEx(environment_key, "PANDA_DATA_USERNAME", 0, winreg.REG_SZ, username)
            winreg.SetValueEx(environment_key, "PANDA_DATA_PASSWORD", 0, winreg.REG_SZ, password)
        finally:
            winreg.CloseKey(environment_key)
    except OSError as exc:
        raise PitBuildError("Could not save Panda Data credentials to Windows user environment variables.") from exc

    os.environ["PANDA_DATA_USERNAME"] = username
    os.environ["PANDA_DATA_PASSWORD"] = password


def persist_macos_keychain_credentials(username: str, password: str) -> None:
    """Store validated credentials in the current user's macOS login keychain."""
    if sys.platform != "darwin":
        raise PitBuildError("macOS keychain persistence requires macOS.")

    for account, secret in (
        (MACOS_KEYCHAIN_USERNAME_ACCOUNT, username),
        (MACOS_KEYCHAIN_PASSWORD_ACCOUNT, password),
    ):
        result = subprocess.run(
            [
                "security",
                "add-generic-password",
                "-U",
                "-s",
                MACOS_KEYCHAIN_SERVICE,
                "-a",
                account,
                "-w",
                secret,
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise PitBuildError("Could not save Panda Data credentials to the macOS login keychain.")

    os.environ["PANDA_DATA_USERNAME"] = username
    os.environ["PANDA_DATA_PASSWORD"] = password


def persist_credentials(username: str, password: str) -> str:
    """Persist validated credentials using the operating system's native user store."""
    if sys.platform == "win32":
        persist_windows_user_credentials(username, password)
        return "Windows user environment"
    if sys.platform == "darwin":
        persist_macos_keychain_credentials(username, password)
        return "macOS login keychain"
    raise PitBuildError("Interactive credential persistence is supported on Windows and macOS only.")


def login_interactively() -> int:
    print("Panda Data 登录")
    print("请输入账号和密码。账号没有以 86 开头时，系统会自动补全。\n")
    while True:
        username = normalize_username(input("账号: "))
        password = getpass.getpass("密码: ")
        if not username or not password:
            print("账号和密码不能为空，请重新输入。\n")
            continue

        try:
            client = initialize_client(username, password)
            verify_connection(client)
            credential_store = persist_credentials(username, password)
        except PitBuildError as exc:
            if "not installed" in str(exc):
                print(f"登录环境配置失败: {exc}")
                return 1
            print("登录或接口连通性验证失败，请检查账号、密码或网络后重试。\n")
            continue
        except Exception:
            print("登录或接口连通性验证失败，请检查账号、密码或网络后重试。\n")
            continue

        print("Panda Data 登录成功，接口连通性验证通过。")
        print(
            f"登录凭证已保存至 {credential_store}。"
        )
        print(
            "下一步：返回 Skill 对话，选择“构建可信回测数据”或“审计已有回测”。"
        )
        print(
            f"此终端将在 {SUCCESS_CLOSE_DELAY_SECONDS} 秒后自动关闭。"
        )
        time.sleep(SUCCESS_CLOSE_DELAY_SECONDS)
        return 0


def main() -> None:
    try:
        raise SystemExit(login_interactively())
    except KeyboardInterrupt:
        print("\n已取消登录。")
        raise SystemExit(130)


if __name__ == "__main__":
    main()
