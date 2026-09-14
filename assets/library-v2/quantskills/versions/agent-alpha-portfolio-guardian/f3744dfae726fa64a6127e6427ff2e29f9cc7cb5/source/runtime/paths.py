# -*- coding: utf-8 -*-
"""产物包内路径约定：相对 run_dir，整包可复制、与机器无关。"""
from __future__ import annotations

from pathlib import Path
from typing import Union


def pack_rel(path: Union[str, Path], pack_root: Union[str, Path]) -> str:
    """返回 path 相对产物根（run_dir）的 posix 路径。"""
    p = Path(path)
    root = Path(pack_root)
    try:
        return p.resolve().relative_to(root.resolve()).as_posix()
    except (ValueError, OSError):
        return p.name


def portable_ref(path: Union[str, Path, None], *, missing: str = "") -> str:
    """仓外引用（如 portfolio 配置）：保留相对入参；绝对路径只留文件名。"""
    if path is None or path == "":
        return missing
    p = Path(path)
    if not p.is_absolute():
        return p.as_posix()
    return p.name
