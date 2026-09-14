from __future__ import annotations

import ast
import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _literal_assignment(relative: str, name: str) -> str:
    tree = ast.parse((ROOT / relative).read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            if any(
                isinstance(target, ast.Name) and target.id == name
                for target in node.targets
            ):
                return ast.literal_eval(node.value)
    raise AssertionError(f"{name} not found in {relative}")


def _metadata_value(name: str) -> str:
    text = (ROOT / "skill.yml").read_text(encoding="utf-8")
    match = re.search(
        rf"^  {re.escape(name)}:\s*(.+?)\s*$", text, re.MULTILINE
    )
    if not match:
        raise AssertionError(f"{name} not found in skill.yml metadata")
    return match.group(1).strip("\"'")


def test_release_versions_and_quantskills_metadata_are_consistent():
    project = tomllib.loads(
        (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    )
    version = project["project"]["version"]
    assert _literal_assignment("scripts/cli.py", "SKILL_VERSION") == version
    assert _literal_assignment("scripts/__init__.py", "__version__") == version
    assert _metadata_value("organization") == "QuantSkills"
    assert _metadata_value("repository") == "skill-dalio-all-weather"
    assert _metadata_value("repository_url").endswith(
        "/skill-dalio-all-weather"
    )
    assert _metadata_value("status") == "beta"
    assert _metadata_value("validation_level") == "conditional"
    assert _metadata_value("maintainer_type") == "community"
