# -*- coding: utf-8 -*-
"""规则引擎单测：python scripts/test_rules.py"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from runtime.rules import FactorEvidence, decide_factor, map_crowding_scenario


def test_keep():
    d = decide_factor(
        FactorEvidence(
            factor_id="A",
            factor_name="mom",
            primary_score=0.5,
            rank_ic=0.03,
            half_life=8,
            eval_ok=True,
            decay_ok=True,
            ic_by_horizon={1: 0.03, 20: 0.01},
        ),
        {},
    )
    assert d.signal == "keep"


def test_retire_high_to():
    d = decide_factor(
        FactorEvidence(
            factor_id="B",
            factor_name="noise",
            primary_score=0.2,
            rank_ic=0.02,
            half_life=1.0,
            turnover=0.8,
            eval_ok=True,
            decay_ok=True,
            ic_by_horizon={1: 0.02, 20: 0.01},
        ),
        {},
    )
    assert d.signal == "retire_candidate"


def test_rebuild_sign_reversal():
    d = decide_factor(
        FactorEvidence(
            factor_id="C",
            factor_name="mix",
            primary_score=0.3,
            rank_ic=-0.02,
            half_life=6,
            sign_reversal=True,
            eval_ok=True,
            decay_ok=True,
            ic_by_horizon={1: -0.02, 20: 0.02},
        ),
        {},
    )
    assert d.signal == "rebuild_candidate"


def test_crowding_map():
    assert map_crowding_scenario("延续", "") == "info"
    assert map_crowding_scenario("crowding-watch", "高关注") == "critical"


if __name__ == "__main__":
    test_keep()
    test_retire_high_to()
    test_rebuild_sign_reversal()
    test_crowding_map()
    print("[OK] test_rules passed")
