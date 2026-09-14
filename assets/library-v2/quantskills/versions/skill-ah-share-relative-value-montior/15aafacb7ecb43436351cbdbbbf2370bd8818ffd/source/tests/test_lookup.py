import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from ah_lookup import resolve_best_match


class TestAHLookup(unittest.TestCase):
    def test_resolves_company_name(self):
        rows = [
            {"名称": "中国平安", "A股代码": "601318", "H股代码": "02318"},
            {"名称": "中国银行", "A股代码": "601988", "H股代码": "03988"},
        ]
        best, _ = resolve_best_match("中国平安", rows)
        self.assertEqual(best.a_code, "601318")
        self.assertEqual(best.h_code, "02318")

    def test_resolves_h_code(self):
        rows = [
            {"名称": "中国平安", "A股代码": "601318", "H股代码": "02318"},
            {"名称": "中国银行", "A股代码": "601988", "H股代码": "03988"},
        ]
        best, _ = resolve_best_match("02318", rows)
        self.assertEqual(best.company, "中国平安")

    def test_ambiguous_short_name_raises(self):
        rows = [
            {"名称": "中国平安", "A股代码": "601318", "H股代码": "02318"},
            {"名称": "平安银行", "A股代码": "000001", "H股代码": "00001"},
        ]
        with self.assertRaises(ValueError):
            resolve_best_match("平安", rows)


if __name__ == "__main__":
    unittest.main()
