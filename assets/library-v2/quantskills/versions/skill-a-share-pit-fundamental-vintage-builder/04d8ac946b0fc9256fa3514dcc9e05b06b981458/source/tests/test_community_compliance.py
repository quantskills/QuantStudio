"""Regression checks for QuantSkills repository admission requirements."""

from __future__ import annotations

import unittest
from pathlib import Path



ROOT = Path(__file__).resolve().parents[1]


class CommunityComplianceTests(unittest.TestCase):
    def test_declares_gpl_v3_only_and_includes_full_license_text(self) -> None:
        metadata_text = (ROOT / "skill.yml").read_text(encoding="utf-8")
        license_text = (ROOT / "LICENSE").read_text(encoding="utf-8")

        self.assertEqual(metadata_text.count("license: GPL-3.0-only"), 2)
        self.assertIn("GNU GENERAL PUBLIC LICENSE", license_text)
        self.assertIn("Version 3, 29 June 2007", license_text)

    def test_provides_cursor_runtime_entrypoint(self) -> None:
        cursor_rule = (ROOT / "agents" / "cursor-rule.mdc").read_text(encoding="utf-8")

        self.assertIn("description:", cursor_rule)
        self.assertIn("SKILL.md", cursor_rule)

    def test_provides_portable_hermes_and_openclaw_entrypoint(self) -> None:
        loader = (ROOT / "agents" / "portable-loader.md").read_text(encoding="utf-8")

        self.assertIn("Hermes", loader)
        self.assertIn("OpenClaw", loader)
        self.assertIn("SKILL.md", loader)

    def test_provides_openai_runtime_metadata(self) -> None:
        adapter_text = (ROOT / "agents" / "openai.yaml").read_text(encoding="utf-8")

        self.assertIn("allow_implicit_invocation: true", adapter_text)
        self.assertIn("$skill-a-share-pit-fundamental-vintage-builder", adapter_text)

    def test_declares_localized_quant_skills_card_metadata(self) -> None:
        skill_text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        frontmatter = skill_text.split("---", 2)[1]

        self.assertIn("quantSkills:", frontmatter)
        self.assertIn("category: tooling", frontmatter)
        self.assertIn("summary_zh:", frontmatter)
        self.assertIn("summary_en:", frontmatter)
        self.assertIn("构建并审计 A 股财务因子 PIT 输入", frontmatter)
        self.assertIn("Build and audit A-share PIT financial inputs", frontmatter)
        self.assertIn("platforms:", frontmatter)
        self.assertIn("status: active", frontmatter)
        self.assertIn("validation_level: listed", frontmatter)
        self.assertIn("maintainer_type: community", frontmatter)

    def test_uses_chinese_for_user_facing_skill_instructions(self) -> None:
        skill_text = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        body = skill_text.split("---", 2)[2]

        self.assertIn("# A 股财务因子回测防前视助手", body)
        self.assertIn("## 首次交互", body)
        self.assertIn("## 批量调仓工作流", body)
        self.assertNotIn("# A-Share Financial Factor Backtest Anti-Lookahead Assistant", body)
        self.assertNotIn("## First Interaction", body)


if __name__ == "__main__":
    unittest.main()
